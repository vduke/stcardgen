// Persona manager: the editor's quality tools for personas that are already installed, bulk reviews,
// and cleanup of duplicate copies (e.g. a card imported three times).

import { getRequestHeaders, saveSettingsDebounced, getThumbnailUrl } from '../../../../script.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../popup.js';
import { power_user } from '../../../power-user.js';
import { user_avatar, getUserAvatars } from '../../../personas.js';
import { reviewCard, scoreClass } from './quality.js';
import { startTask, exclusive, guardClosing } from './tasks.js';

let api = null;

/** Helpers from index.js, injected to avoid circular imports. */
export function initManager(helpers) {
    api = helpers;
}

// ---------------------------------------------------------------------------
// Persona data
// ---------------------------------------------------------------------------

export function personaAvatarPath(avatarId) {
    return `User Avatars/${encodeURIComponent(avatarId)}`;
}

/** The persona as editor data. */
export function personaData(avatarId) {
    const descriptor = power_user.persona_descriptions?.[avatarId] || {};
    return {
        name: String(power_user.personas?.[avatarId] ?? ''),
        title: String(descriptor.title || ''),
        description: String(descriptor.description || ''),
        image_prompt: '',
    };
}

/** FNV-1a, enough to notice that text or an image changed. */
function fnv1a(input) {
    let hash = 0x811c9dc5;
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    for (let i = 0; i < bytes.length; i++) {
        hash ^= bytes[i];
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

function personaHash(data) {
    return fnv1a(`${data.name}\n${data.title}\n${data.description}`);
}

/**
 * The stored review of an installed persona.
 * @returns {{review: object, stale: boolean}|null} stale when the persona was edited after the review
 */
export function getPersonaReview(avatarId) {
    const stored = api.settings().personaReviews?.[avatarId];
    if (!stored?.review) return null;
    return { review: stored.review, stale: stored.hash !== personaHash(personaData(avatarId)) };
}

export function setPersonaReview(avatarId, data, review) {
    const s = api.settings();
    s.personaReviews ??= {};
    if (review) s.personaReviews[avatarId] = { hash: personaHash(data), review };
    else delete s.personaReviews[avatarId];
    saveSettingsDebounced();
}

function listPersonaIds() {
    return Object.keys(power_user.personas || {});
}

function normalize(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Same name (any case) and same description (any whitespace). */
function duplicateKey(avatarId) {
    const data = personaData(avatarId);
    return `${normalize(data.name).toLowerCase()}\u0000${normalize(data.description)}`;
}

/** @returns {string[][]} Groups of avatar ids with the same text; not yet duplicates until the avatars match too */
function findTextGroups() {
    const groups = new Map();
    for (const id of listPersonaIds()) {
        if (!normalize(personaData(id).name)) continue;
        const key = duplicateKey(id);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(id);
    }
    return [...groups.values()].filter(group => group.length > 1);
}

// ---------------------------------------------------------------------------
// Avatar similarity
// ---------------------------------------------------------------------------

/** @type {Map<string, Promise<object|null>>} Cleared each time the manager opens. */
const signatures = new Map();

/**
 * A small perceptual fingerprint of a persona's avatar. SillyTavern crops, resizes and renames every
 * upload, so the same picture uploaded twice has different bytes and file names; this still matches it.
 */
function avatarSignature(avatarId) {
    if (!signatures.has(avatarId)) signatures.set(avatarId, computeSignature(avatarId));
    return signatures.get(avatarId);
}

async function computeSignature(avatarId) {
    try {
        const response = await fetch(getThumbnailUrl('persona', avatarId), { cache: 'no-cache' });
        if (!response.ok) return null;
        const bitmap = await createImageBitmap(await response.blob());
        const grayscale = (width, height) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(bitmap, 0, 0, width, height);
            const { data } = ctx.getImageData(0, 0, width, height);
            return Float32Array.from({ length: width * height }, (_, i) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
        };
        // Difference hash: is each pixel darker than its right neighbour, on a 9x8 version.
        const tiny = grayscale(9, 8);
        const hash = Array.from({ length: 64 }, (_, i) => tiny[Math.floor(i / 8) * 9 + (i % 8)] < tiny[Math.floor(i / 8) * 9 + (i % 8) + 1]);
        const signature = { aspect: bitmap.width / bitmap.height, hash, gray: grayscale(16, 16) };
        bitmap.close();
        return signature;
    } catch (error) {
        console.warn('[stcardgen] Could not read avatar', avatarId, error);
        return null;
    }
}

/**
 * 'identical' (the same picture, re-encoded or resized), 'similar' (e.g. cropped a little differently),
 * or null. An avatar that could not be read never matches.
 * Measured on 2:3 portraits: a smaller JPEG re-encode was 1 bit / 1.3 gray apart, a 6% re-crop
 * 17 bits / 25 gray, and different pictures 24-39 bits / 61-83 gray. Similar copies are never ticked
 * for deletion automatically, so that threshold can be generous.
 */
function compareAvatars(a, b) {
    if (!a || !b || Math.abs(a.aspect - b.aspect) > 0.05) return null;
    const bits = a.hash.reduce((n, bit, i) => n + Number(bit !== b.hash[i]), 0);
    const gray = a.gray.reduce((sum, v, i) => sum + Math.abs(v - b.gray[i]), 0) / a.gray.length;
    if (bits <= 4 && gray <= 6) return 'identical';
    if (bits <= 20 && gray <= 35) return 'similar';
    return null;
}

/**
 * Duplicate sets: personas with the same name and description whose avatars show the same picture.
 * Unnamed personas (same "[Unnamed Persona]" name, empty description) are told apart by their avatar alone.
 * @returns {Promise<{sets: string[][], sigs: Map<string, object|null>}>}
 */
async function findDuplicateSets(task = null) {
    const groups = findTextGroups();
    const ids = groups.flat();
    const sigs = new Map();
    let done = 0;
    task?.update({ total: ids.length, done: 0, detail: `Comparing ${ids.length} avatars…` });
    await Promise.all(ids.map(async id => {
        sigs.set(id, await avatarSignature(id));
        task?.update({ done: ++done });
    }));

    const sets = [];
    for (const group of groups) {
        // Union-find: copies chain together through any matching pair.
        const parent = new Map(group.map(id => [id, id]));
        const root = id => (parent.get(id) === id ? id : root(parent.get(id)));
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                if (compareAvatars(sigs.get(group[i]), sigs.get(group[j]))) parent.set(root(group[j]), root(group[i]));
            }
        }
        const clusters = new Map();
        for (const id of group) {
            const key = root(id);
            if (!clusters.has(key)) clusters.set(key, []);
            clusters.get(key).push(id);
        }
        sets.push(...[...clusters.values()].filter(cluster => cluster.length > 1));
    }
    return { sets, sigs };
}

// ---------------------------------------------------------------------------
// Bulk review
// ---------------------------------------------------------------------------

function reviewPersonas(ids, onChange) {
    return exclusive('persona-review', async () => {
        const controller = new AbortController();
        const task = startTask(`Reviewing ${ids.length} persona${ids.length === 1 ? '' : 's'}`, { total: ids.length, onStop: () => controller.abort() });
        let done = 0;
        let failed = 0;
        for (const id of ids) {
            if (controller.signal.aborted) break;
            const data = personaData(id);
            task.update({ detail: `Reviewing "${data.name}"…` });
            try {
                const review = await reviewCard({ type: 'persona', data, signal: controller.signal });
                setPersonaReview(id, data, review);
            } catch (error) {
                if (controller.signal.aborted) break;
                console.error('[stcardgen]', error);
                failed++;
            }
            task.update({ done: ++done });
            onChange();
        }
        const summary = controller.signal.aborted ? `Stopped after ${done}.` : `Reviewed ${done - failed}${failed ? `, ${failed} failed` : ''}.`;
        task.finish(summary, { error: failed > 0 });
    });
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

async function post(url, body) {
    const response = await fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
    return await response.json();
}

/** The persona file a message's force_avatar points at ("/thumbnail?type=persona&file=x.png" or "User Avatars/x.png"). */
function avatarFromUrl(value) {
    const text = String(value || '');
    try {
        const file = new URL(text, location.origin).searchParams.get('file');
        if (file) return file;
    } catch { /* not a URL */ }
    try {
        return decodeURIComponent(text.split('?')[0].split('/').pop() || '');
    } catch {
        return text.split('/').pop() || '';
    }
}

/**
 * Counts, for each persona id, the chats that use it: chats where it sent a message (messages keep the
 * persona's avatar) or that are locked to it. Reads every character and group chat once.
 * @returns {Promise<Map<string, number>>}
 */
async function countChatsByPersona(ids, task) {
    const wanted = new Set(ids);
    const counts = new Map(ids.map(id => [id, 0]));
    const context = SillyTavern.getContext();
    const loaders = [];

    const characters = context.characters.filter(c => c?.avatar);
    for (const [index, character] of characters.entries()) {
        task.update({ detail: `Listing chats (${index + 1}/${characters.length} characters)…` });
        try {
            const chats = await post('/api/chats/search', { avatar_url: character.avatar });
            for (const chat of Array.isArray(chats) ? chats : []) {
                loaders.push(() => post('/api/chats/get', { ch_name: character.name, file_name: chat.file_name, avatar_url: character.avatar }));
            }
        } catch (error) {
            // Without the full picture nothing may be deleted, so a failed listing aborts the scan.
            throw new Error(`Could not list the chats of ${character.name}: ${error.message}`);
        }
    }
    for (const group of context.groups || []) {
        for (const chatId of group.chats || []) loaders.push(() => post('/api/chats/group/get', { id: chatId }));
    }

    task.update({ total: loaders.length, done: 0, detail: `Scanning ${loaders.length} chats for persona use…` });
    let done = 0;
    const tally = (chat) => {
        if (!Array.isArray(chat)) return;
        const used = new Set();
        const locked = chat[0]?.chat_metadata?.persona;
        if (wanted.has(locked)) used.add(locked);
        for (const message of chat) {
            if (!message?.is_user || !message.force_avatar) continue;
            const id = avatarFromUrl(message.force_avatar);
            if (wanted.has(id)) used.add(id);
        }
        for (const id of used) counts.set(id, counts.get(id) + 1);
    };
    const worker = async () => {
        while (loaders.length) {
            const load = loaders.shift();
            tally(await load());
            task.update({ done: ++done });
        }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    return counts;
}

/** Why a persona must be kept, if anything ties it to a chat or a setting. */
function keepReasons(avatarId, chatCount) {
    const reasons = [];
    const descriptor = power_user.persona_descriptions?.[avatarId];
    if (avatarId === user_avatar) reasons.push('current persona');
    if (avatarId === power_user.default_persona) reasons.push('default persona');
    if (chatCount) reasons.push(`${chatCount} chat${chatCount === 1 ? '' : 's'}`);
    if (descriptor?.connections?.length) reasons.push(`linked to ${descriptor.connections.length} character${descriptor.connections.length === 1 ? '' : 's'}`);
    if (descriptor?.lorebook) reasons.push('has a lorebook');
    return reasons;
}

/** Ids created by SillyTavern or this extension start with a timestamp. */
function creationStamp(id) {
    return Number(/^(\d{10,})/.exec(id)?.[1]) || Number.MAX_SAFE_INTEGER;
}

/** Oldest first. */
function creationOrder(ids) {
    const order = listPersonaIds();
    return [...ids].sort((a, b) => creationStamp(a) - creationStamp(b) || order.indexOf(a) - order.indexOf(b));
}

/** Thumbnail URL; the cache buster is fixed per popup so re-renders don't reload every image. */
function thumbnail(id, bust) {
    return `${getThumbnailUrl('persona', id)}&t=${bust}`;
}

/**
 * Plans which copies to remove from each duplicate set. Copies that are in use are always kept; when
 * none is, the oldest copy is kept. Only copies showing the identical picture as a kept copy are ticked;
 * merely similar ones (a different crop, say) are listed for you to decide.
 */
async function planDuplicates(sets, sigs, task) {
    const counts = await countChatsByPersona(sets.flat(), task);
    const rank = { identical: 2, similar: 1 };
    return sets.map(set => {
        const members = creationOrder(set).map(id => ({ id, reasons: keepReasons(id, counts.get(id) || 0) }));
        const inUse = members.filter(m => m.reasons.length);
        const kept = inUse.length ? inUse : [members[0]];
        for (const member of members) {
            member.locked = member.reasons.length > 0;
            member.keep = kept.includes(member);
            // The closest match among the kept copies.
            member.match = member.keep ? null : kept
                .map(k => compareAvatars(sigs.get(member.id), sigs.get(k.id)))
                .sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0] ?? null;
            member.remove = !member.keep && member.match === 'identical';
        }
        return { name: personaData(set[0]).name, members };
    });
}

/** Lets the user check the plan. Resolves to the ids to delete, or null. */
async function confirmDuplicates(plans) {
    const esc = api.escapeHtml;
    const root = document.createElement('div');
    root.classList.add('stcg-dupes');
    root.innerHTML = `
        <h3>Remove duplicate personas</h3>
        <p>Each group below is one persona saved more than once: same name, same description, and the same avatar picture (even when SillyTavern resized and renamed the file). Ticked copies are deleted. Copies used in a chat, linked to a character, holding a lorebook, or set as current/default are always kept.</p>
        ${plans.map((plan, g) => `
            <div class="stcg-dupe-group">
                <h4>${esc(plan.name)} <small>(${plan.members.length} copies)</small></h4>
                ${plan.members.map(m => `
                    <label class="stcg-dupe-row${m.locked ? ' locked' : ''}">
                        <input type="checkbox" data-group="${g}" data-id="${esc(m.id)}" ${m.remove ? 'checked' : ''} ${m.locked ? 'disabled' : ''}>
                        <img data-thumb="${esc(m.id)}" alt="" loading="lazy">
                        <span class="stcg-dupe-id">${esc(m.id)}</span>
                        <span class="stcg-dupe-notes">
                            ${m.locked ? `<span class="stcg-badge stcg-badge-keep">Kept: ${esc(m.reasons.join(', '))}</span>` : ''}
                            ${!m.locked && m.keep ? '<span class="stcg-badge stcg-badge-keep">Kept: oldest copy</span>' : ''}
                            ${m.match === 'identical' ? '<span class="stcg-badge">Same picture</span>' : ''}
                            ${m.match === 'similar' ? '<span class="stcg-badge stcg-badge-overused" title="Close but not identical, e.g. cropped differently. Compare the thumbnails before ticking.">Similar picture, check it</span>' : ''}
                            ${!m.keep && !m.match ? '<span class="stcg-badge stcg-badge-overused" title="It matches another copy in this group, not the kept one.">Matches another copy, check it</span>' : ''}
                        </span>
                    </label>`).join('')}
            </div>`).join('')}`;

    const $root = $(root);
    const bust = Date.now();
    $root.find('img[data-thumb]').each((_, img) => { img.src = thumbnail(img.getAttribute('data-thumb'), bust); });
    const checked = () => $root.find('input[type=checkbox]:checked:not(:disabled)').toArray();
    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Delete ticked copies',
        cancelButton: 'Cancel',
        wide: true,
        allowVerticalScrolling: true,
        leftAlign: true,
        onClosing: guardClosing(async (p) => {
            if (p.result !== POPUP_RESULT.AFFIRMATIVE) return true;
            const ticked = checked();
            if (!ticked.length) { toastr.info('Nothing is ticked.', 'Card Generator'); return false; }
            // Every group must keep at least one copy.
            for (const [g, plan] of plans.entries()) {
                const removing = ticked.filter(el => Number(el.getAttribute('data-group')) === g).length;
                if (removing >= plan.members.length) { toastr.warning(`Keep at least one "${plan.name}".`, 'Card Generator'); return false; }
            }
            return true;
        }),
    });
    const result = await popup.show();
    return result === POPUP_RESULT.AFFIRMATIVE ? checked().map(el => String(el.getAttribute('data-id'))) : null;
}

async function deletePersonas(ids, task) {
    const context = SillyTavern.getContext();
    let deleted = 0;
    const failed = [];
    task.update({ total: ids.length, done: 0 });
    for (const id of ids) {
        const name = power_user.personas?.[id] || id;
        task.update({ detail: `Deleting ${id}…` });
        // Last line of defense; the plan already keeps these.
        if (id === user_avatar || id === power_user.default_persona) { failed.push(`${name} (in use)`); continue; }
        try {
            const response = await fetch('/api/avatars/delete', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ avatar: id }),
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            delete power_user.personas[id];
            delete power_user.persona_descriptions[id];
            signatures.delete(id);
            setPersonaReview(id, null, null);
            await context.eventSource.emit(context.eventTypes.PERSONA_DELETED, { avatarId: id, name });
            deleted++;
        } catch (error) {
            console.error('[stcardgen]', error);
            failed.push(`${name} (${error.message})`);
        }
        task.update({ done: deleted + failed.length });
    }
    saveSettingsDebounced();
    await getUserAvatars(true, user_avatar);
    return { deleted, failed };
}

/** Deletes the personas you picked, after a confirmation. The current and default personas are skipped. */
function deleteSelected(ids, onChange) {
    return exclusive('persona-delete', async () => {
        const esc = api.escapeHtml;
        const isProtected = id => id === user_avatar || id === power_user.default_persona;
        const targets = ids.filter(id => !isProtected(id));
        const skipped = ids.filter(isProtected);
        const nameList = list => {
            const names = list.map(id => esc(personaData(id).name || id));
            return names.length > 15 ? `${names.slice(0, 15).join(', ')} and ${names.length - 15} more` : names.join(', ');
        };
        if (!targets.length) {
            toastr.warning('The current and default personas can\'t be deleted here. Switch to another persona first.', 'Card Generator');
            return;
        }
        const ok = await Popup.show.confirm(
            `Delete ${targets.length} persona${targets.length === 1 ? '' : 's'}?`,
            `${nameList(targets)}<br><br>Their avatars and descriptions are removed for good. Chats are kept, but messages sent as these personas lose their avatar.`
            + (skipped.length ? `<br><br>Skipped (current or default persona): ${nameList(skipped)}` : ''),
        );
        if (!ok) return;
        const task = startTask(`Deleting ${targets.length} persona${targets.length === 1 ? '' : 's'}`, { total: targets.length });
        const { deleted, failed } = await deletePersonas(targets, task);
        task.finish(`Deleted ${deleted}${failed.length ? `, failed ${failed.length}` : ''}.`, { error: failed.length > 0 });
        if (deleted) toastr.success(`Deleted ${deleted} persona${deleted === 1 ? '' : 's'}.`, 'Card Generator');
        if (failed.length) toastr.warning(`Not deleted: ${failed.join(', ')}`, 'Card Generator', { timeOut: 10000 });
        onChange();
    });
}

function removeDuplicates(onChange) {
    return exclusive('dedupe', async () => {
        if (!findTextGroups().length) {
            toastr.success('No duplicate personas found.', 'Card Generator');
            return;
        }
        const task = startTask('Looking for duplicate personas');
        let plans;
        try {
            const { sets, sigs } = await findDuplicateSets(task);
            if (!sets.length) {
                task.finish('No duplicates: personas that share a name and description have different pictures.');
                toastr.success('No duplicate personas found.', 'Card Generator');
                return;
            }
            const copies = sets.reduce((sum, set) => sum + set.length, 0);
            task.update({ label: `Checking ${copies} duplicate personas`, detail: 'Finding which copies are used in chats…' });
            plans = await planDuplicates(sets, sigs, task);
        } catch (error) {
            console.error('[stcardgen]', error);
            task.finish(`Error: ${error.message}`, { error: true });
            toastr.error(String(error.message), 'Card Generator');
            return;
        }
        task.finish('Scan complete. Waiting for your confirmation.');
        const ids = await confirmDuplicates(plans);
        if (!ids?.length) return;
        const deleting = startTask(`Deleting ${ids.length} duplicate persona${ids.length === 1 ? '' : 's'}`, { total: ids.length });
        const { deleted, failed } = await deletePersonas(ids, deleting);
        deleting.finish(`Deleted ${deleted}${failed.length ? `, failed ${failed.length}` : ''}.`, { error: failed.length > 0 });
        if (deleted) toastr.success(`Deleted ${deleted} duplicate persona${deleted === 1 ? '' : 's'}.`, 'Card Generator');
        if (failed.length) toastr.warning(`Not deleted: ${failed.join(', ')}`, 'Card Generator', { timeOut: 10000 });
        onChange();
    });
}

// ---------------------------------------------------------------------------
// Manager popup
// ---------------------------------------------------------------------------

export async function openPersonaManager() {
    const esc = api.escapeHtml;
    const selected = new Set();
    let query = '';
    const root = document.createElement('div');
    root.classList.add('stcg-drafts', 'stcg-personas');
    root.innerHTML = `
        <h3>Personas</h3>
        <div class="stcg-drafts-toolbar">
            <input type="search" class="text_pole stcg-pm-search" placeholder="Search personas…">
            <label class="checkbox_label"><input type="checkbox" class="stcg-select-all"> Select all</label>
            <div class="menu_button stcg-pm-review-selected" title="Score the selected personas against the rubric (nothing is changed)"><i class="fa-solid fa-clipboard-check"></i> Review selected</div>
            <div class="menu_button stcg-pm-dedupe" title="Find personas with the same name, description and avatar picture, and delete the extra copies. Copies used in chats are kept."><i class="fa-solid fa-clone"></i> Remove duplicates</div>
            <div class="menu_button stcg-pm-delete-selected" title="Delete the selected personas (asks first; the current and default personas are skipped)"><i class="fa-solid fa-trash"></i> Delete selected</div>
        </div>
        <div class="stcg-drafts-summary"></div>
        <div class="stcg-drafts-grid"></div>`;

    const $root = $(root);
    const $grid = $root.find('.stcg-drafts-grid');
    let bust = Date.now();
    // Duplicate badges need the avatars compared, which is async; null until that finishes.
    /** @type {Map<string, number>|null} */
    let dupes = null;
    let dupeSets = [];
    signatures.clear();

    async function refreshDuplicates() {
        try {
            const many = findTextGroups().flat().length > 12;
            const task = many ? startTask('Comparing persona avatars') : null;
            dupeSets = (await findDuplicateSets(task)).sets;
            task?.finish(`${dupeSets.length} duplicate persona${dupeSets.length === 1 ? '' : 's'} found.`);
        } catch (error) {
            console.error('[stcardgen]', error);
            dupeSets = [];
        }
        dupes = new Map(dupeSets.flatMap(set => set.map(id => [id, set.length])));
        render();
    }

    function visible() {
        const q = query.trim().toLowerCase();
        return listPersonaIds()
            .map(id => ({ id, ...personaData(id) }))
            .filter(p => !q || `${p.name} ${p.title} ${p.description}`.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name) || creationStamp(a.id) - creationStamp(b.id));
    }

    function render() {
        const ids = new Set(listPersonaIds());
        for (const id of [...selected]) if (!ids.has(id)) selected.delete(id);
        // Reviews of deleted personas are dropped.
        const reviews = api.settings().personaReviews || {};
        for (const id of Object.keys(reviews)) if (!ids.has(id)) delete reviews[id];

        const sets = dupeSets.map(set => set.filter(id => ids.has(id))).filter(set => set.length > 1);
        const extra = sets.reduce((sum, set) => sum + set.length - 1, 0);
        const dupeText = dupes === null
            ? ' — checking for duplicates…'
            : extra ? ` — ${extra} extra cop${extra === 1 ? 'y' : 'ies'} of ${sets.length} persona${sets.length === 1 ? '' : 's'} (Remove duplicates cleans them up)` : '';
        $root.find('.stcg-drafts-summary').text(`${ids.size} persona${ids.size === 1 ? '' : 's'}${dupeText}`);

        $grid.empty();
        const list = visible();
        if (!list.length) $grid.append('<div class="stcg-empty">No personas here.</div>');
        for (const persona of list) {
            const stored = getPersonaReview(persona.id);
            const score = stored?.review?.overall
                ? `<span class="stcg-badge stcg-badge-score stcg-score-${stored.stale ? 'none' : scoreClass(stored.review.overall)}" title="${esc(stored.stale ? 'Edited since this review' : (stored.review.summary || 'Quality score'))}">★ ${stored.review.overall}${stored.stale ? ' (old)' : ''}</span>`
                : '';
            const overused = api.findOverusedParts(persona.name);
            const $card = $(`
                <div class="stcg-draft">
                    <label class="stcg-draft-check"><input type="checkbox"></label>
                    <div class="stcg-draft-img"><img src="${thumbnail(persona.id, bust)}" alt="" loading="lazy"></div>
                    <div class="stcg-draft-body">
                        <div class="stcg-draft-head">
                            <span class="stcg-badge stcg-badge-persona">Persona</span>
                            ${persona.id === user_avatar ? '<span class="stcg-badge stcg-badge-keep">Current</span>' : ''}
                            ${persona.id === power_user.default_persona ? '<span class="stcg-badge stcg-badge-keep">Default</span>' : ''}
                            ${score}
                            ${dupes?.has(persona.id) ? `<span class="stcg-badge stcg-badge-conflict" title="Same name, description and picture as other personas">Duplicate ×${dupes.get(persona.id)}</span>` : ''}
                            ${overused.length ? `<span class="stcg-badge stcg-badge-overused" title="On the overused names list">Overused: ${esc(overused.join(', '))}</span>` : ''}
                        </div>
                        <div class="stcg-draft-name">${esc(persona.name || '(unnamed)')}${persona.title ? ` <small>${esc(persona.title)}</small>` : ''}</div>
                        <div class="stcg-draft-preview">${esc(persona.description.slice(0, 220)) || '<i>No description</i>'}</div>
                        <div class="stcg-draft-buttons">
                            <div class="menu_button stcg-p-edit" title="Review, fix, enhance or optimize this persona"><i class="fa-solid fa-pen-to-square"></i> Review &amp; edit</div>
                            <div class="menu_button stcg-p-world" title="Create a sandbox world around this persona"><i class="fa-solid fa-earth-americas"></i></div>
                        </div>
                    </div>
                </div>`);
            $card.find('input[type=checkbox]').prop('checked', selected.has(persona.id)).on('change', e => {
                if ($(e.target).prop('checked')) selected.add(persona.id); else selected.delete(persona.id);
            });
            $card.find('.stcg-p-edit').on('click', async () => {
                await api.openEditor({ type: 'persona', personaId: persona.id });
                // The text or the avatar may have changed.
                bust = Date.now();
                signatures.delete(persona.id);
                render();
                refreshDuplicates();
            });
            $card.find('.stcg-p-world').on('click', () => api.openWorldBuilder({ personaId: persona.id }));
            $grid.append($card);
        }
    }

    $root.find('.stcg-pm-search').on('input', e => { query = String($(e.target).val()); render(); });
    $root.find('.stcg-select-all').on('change', e => {
        selected.clear();
        if ($(e.target).prop('checked')) visible().forEach(p => selected.add(p.id));
        render();
    });
    $root.find('.stcg-pm-review-selected').on('click', () => {
        if (!selected.size) { toastr.info('Tick the personas to review first.', 'Card Generator'); return; }
        reviewPersonas([...selected], render);
    });
    $root.find('.stcg-pm-dedupe').on('click', () => removeDuplicates(refreshDuplicates));
    $root.find('.stcg-pm-delete-selected').on('click', () => {
        if (!selected.size) { toastr.info('Tick the personas to delete first.', 'Card Generator'); return; }
        deleteSelected([...selected], () => {
            $root.find('.stcg-select-all').prop('checked', false);
            refreshDuplicates();
        });
    });
    render();
    refreshDuplicates();

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Close',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
    });
    await popup.show();
}
