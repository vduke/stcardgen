import { saveWorldInfo, updateWorldInfoList, world_names, createWorldInfoEntry, getFreeWorldName, world_info_logic, world_info_position } from '../../../world-info.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../popup.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';

export const DEFAULT_WORLD_PROMPT = `You are a world-builder for SillyTavern roleplay. You turn a user persona into a living sandbox: a world/narrator character card plus a lorebook (World Info) that makes the setting feel real and reactive.

The persona is the character the USER plays. Refer to them as {{user}} everywhere. The sandbox card ({{char}}) is not one person: it is the narrator / game master who describes the world and voices every NPC.

Build the world around who {{user}} is. Work out what their life needs and fill it in:
- Home and family: where they live, parents/siblings/partner, household dynamics.
- Work or school: the institution, its culture, bosses/teachers/classmates/crew.
- Social circle: friends, rivals, love interests, enemies, each with their own goals.
- Places: hangouts, hot spots, the wider city/region/star system, and what happens there.
- Organizations: factions, alliances, companies, gangs, clubs, governments, and where {{user}} stands with them.
- Daily life: routines, hobbies, events, customs, slang, technology or magic rules.
- Hooks: tensions, secrets and upcoming events that can start stories.
Examples: a college student needs the campus, their dorm or apartment, parents, roommate, friend group, professors, a part-time job, parties and local spots. A starship captain needs the ship, the crew, the star system being traveled, political powers and alliances, rivals, ports of call and the current mission.

Sandbox card:
- description: setting overview, tone, and the narrator's role (voices all NPCs, describes the world, keeps continuity, lets {{user}} drive). 300-600 words.
- scenario: where {{user}}'s story starts.
- first_mes: an immersive opening scene addressed to {{user}} in second person, ending on an open situation. Never act or speak for {{user}}.
- system_prompt: short narrator instructions (optional).
- tags: 3-8 genre/setting tags.

Lorebook entries:
- One topic per entry (one NPC, one place, one faction, one custom...). 50-180 words each, factual reference style, present tense. Refer to the persona as {{user}}.
- NPC entries: full name, age, role, relationship to {{user}}, appearance, personality, speech style, current goal.
- keys: 2-6 specific trigger words people would actually type in chat: names, nicknames, surnames, place names, distinctive terms, plus short/lowercase forms. Avoid generic words (the, home, he, she, mom when there are several moms) that would fire constantly.
- secondary_keys: optional. When set, the entry only fires if a primary key AND a secondary key appear. Use them to disambiguate.
- constant: true only for 1-3 essential entries (core world rules, {{user}}'s immediate circumstances). Everything else is keyword-triggered.
- priority: 1-10. High for people and places central to {{user}}'s life, low for background flavor.
- position: "before_char" for foundational lore, "after_char" for most entries, "at_depth" for things that must feel immediate (current events, the active mission).
- probability: 100 normally; 20-60 for random flavor (rumors, random encounters, weather).
- Mention other entries' names inside content so related entries chain together.
- Invent original, fitting names.`;

export const DEFAULT_WORLD_FORMAT = `Respond ONLY with one JSON object and nothing else (no commentary, no markdown outside the JSON). Use exactly these keys (use \\n for line breaks inside strings):
{
  "name": "name of the world / sandbox card",
  "description": "",
  "scenario": "",
  "first_mes": "",
  "alternate_greetings": ["array of strings"],
  "system_prompt": "",
  "creator_notes": "",
  "tags": ["array of strings"],
  "entries": [
    {
      "title": "short entry name",
      "category": "Person | Place | Faction | Item | Event | Custom | Lore",
      "keys": ["array of strings"],
      "secondary_keys": ["array of strings"],
      "content": "",
      "constant": false,
      "priority": 5,
      "position": "before_char | after_char | at_depth",
      "depth": 4,
      "probability": 100
    }
  ]
}`;

const WORLD_IMAGE_PROMPT_INSTRUCTION = `No image was provided for the sandbox card. Add one extra key to the JSON: "image_prompt", a prompt for an AI image generator (Stable Diffusion / ComfyUI) for the card's key art: an establishing scene of the world's signature location. Comma-separated descriptive tags, most important first: place, architecture or technology, environment details, time of day, weather, lighting, mood, art style, wide shot, 2:3 portrait. No names, no text, no {{user}}/{{char}} macros.`;

// Models drift toward stock names in long outputs; repeating this at the end of the request helps.
const BAN_REMINDER = 'Before answering, double-check every NPC, family member and place name: none may use a banned name as a first name or surname.';

const POSITIONS = {
    before_char: { label: 'Before character', value: world_info_position.before },
    after_char: { label: 'After character', value: world_info_position.after },
    at_depth: { label: '@ Depth', value: world_info_position.atDepth },
};

const CARD_FIELDS = [
    { key: 'name', label: 'World / card name', rows: 1 },
    { key: 'description', label: 'Description (setting + narrator role)', rows: 12 },
    { key: 'scenario', label: 'Scenario', rows: 3 },
    { key: 'first_mes', label: 'First message', rows: 8 },
    { key: 'alternate_greetings', label: 'Alternate greetings (separate with a line containing only ---)', rows: 5, list: true },
    { key: 'system_prompt', label: 'System prompt override', rows: 3 },
    { key: 'tags', label: 'Tags (comma-separated)', rows: 1, tags: true },
    { key: 'creator_notes', label: "Creator's notes", rows: 2 },
    { key: 'image_prompt', label: 'Image prompt (for ComfyUI, not saved to the card)', rows: 4, imagePrompt: true },
];

/** Helpers shared with index.js, injected by initWorld() to avoid a circular import. */
let api = null;

export function initWorld(helpers) {
    api = helpers;
}

function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function asBool(value) {
    return value === true || String(value).toLowerCase() === 'true';
}

function keyList(value) {
    return api.toStringList(value).flatMap(k => k.split(',')).map(k => k.trim()).filter(Boolean);
}

function normalizeEntry(e = {}) {
    const position = String(e.position || '').toLowerCase().replace(/[^a-z_]/g, '');
    return {
        title: api.asText(e.title ?? e.name ?? e.comment).trim(),
        category: api.asText(e.category).trim(),
        keys: keyList(e.keys ?? e.key),
        secondary_keys: keyList(e.secondary_keys ?? e.keysecondary),
        content: api.asText(e.content).trim(),
        constant: asBool(e.constant),
        priority: clampInt(e.priority, 1, 10, 5),
        position: POSITIONS[position] ? position : 'after_char',
        depth: clampInt(e.depth, 0, 999, 4),
        probability: clampInt(e.probability, 1, 100, 100),
    };
}

export function normalizeWorld(obj = {}) {
    const str = v => api.asText(v).trim();
    return {
        name: str(obj.name ?? obj.world_name),
        description: str(obj.description),
        scenario: str(obj.scenario),
        first_mes: str(obj.first_mes ?? obj.first_message),
        alternate_greetings: api.toStringList(obj.alternate_greetings),
        system_prompt: str(obj.system_prompt),
        creator_notes: str(obj.creator_notes),
        tags: keyList(obj.tags),
        image_prompt: str(obj.image_prompt),
        entries: Array.isArray(obj.entries) ? obj.entries.map(normalizeEntry).filter(e => e.title || e.content) : [],
    };
}

function emptyWorld() {
    return normalizeWorld({});
}

// ---------------------------------------------------------------------------
// Persona sources
// ---------------------------------------------------------------------------

function listPersonas() {
    return Object.entries(power_user.personas || {})
        .map(([id, name]) => ({ id, name: String(name || '') }))
        .filter(p => p.name && p.name !== '[Unnamed Persona]')
        .sort((a, b) => a.name.localeCompare(b.name));
}

function personaSource(id) {
    const name = power_user.personas?.[id];
    if (!name) return null;
    const descriptor = power_user.persona_descriptions?.[id] || {};
    return { personaId: id, name: String(name), title: descriptor.title || '', description: descriptor.description || '' };
}

function sourceBlock(source) {
    return [
        `Persona name: ${source.name}`,
        source.title ? `Persona title: ${source.title}` : '',
        `Persona description:\n${source.description || '(none provided)'}`,
    ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** The filled-in ban instruction, minus the persona's own name. */
function banText(source, excludeDraftId) {
    const s = api.settings();
    const ownName = source.name.trim().toLowerCase();
    const banned = api.getBannedNames({ excludeDraftId }).filter(n => n.toLowerCase() !== ownName);
    if (!banned.length || !s.banPrompt) return '';
    return s.banPrompt
        .replace(/{{bannedNames}}/g, banned.join(', '))
        .replace(/{{type}}/g, "world's NPCs, places and factions");
}

function buildSystem({ includeImagePrompt, source, excludeDraftId }) {
    const s = api.settings();
    const parts = [s.worldPrompt.trim(), s.worldFormat.trim(), banText(source, excludeDraftId)];
    if (includeImagePrompt) parts.push(WORLD_IMAGE_PROMPT_INSTRUCTION);
    return parts.filter(Boolean).join('\n\n');
}

async function userContent(text, imageBlob) {
    if (!imageBlob) return text;
    const url = await api.imageToPromptDataUrl(imageBlob);
    return [{ type: 'text', text: `${text}\n\nThe attached image is reference art for the world; use it for mood, setting and visual details.` }, { type: 'image_url', image_url: { url } }];
}

async function request(messages, signal) {
    const result = await api.sendMessages(messages, signal, { maxTokens: api.settings().worldMaxTokens });
    const raw = String(result?.content ?? '');
    if (!raw.trim()) throw new Error('The model returned an empty response. Try raising "World max tokens".');
    return raw;
}

/**
 * Generates a full world (sandbox card + lorebook) for a persona.
 * @returns {Promise<{data: object, raw: string}>}
 */
export async function generateWorld({ source, imageBlob = null, details = '', excludeDraftId = null, signal = null }) {
    if (!source?.name) throw new Error('Pick a persona to build the world around.');
    const s = api.settings();
    const count = clampInt(s.worldEntryCount, 3, 80, 20);
    const text = [
        `Build a living sandbox world around this persona.\n\n${sourceBlock(source)}`,
        details?.trim() ? `World notes from the user (these take priority):\n${details.trim()}` : '',
        `Create around ${count} lorebook entries.`,
        BAN_REMINDER,
        'Reply with the JSON object only.',
    ].filter(Boolean).join('\n\n');

    const messages = [
        { role: 'system', content: buildSystem({ includeImagePrompt: !imageBlob && s.suggestImagePrompt, source, excludeDraftId }) },
        { role: 'user', content: await userContent(text, imageBlob) },
    ];
    const raw = await request(messages, signal);
    const data = normalizeWorld(api.parseJsonLoose(raw));
    if (!data.entries.length) throw new Error('The model returned no lorebook entries. Check the raw output, or raise "World max tokens".');
    return { data, raw: api.stripReasoning(raw) };
}

/** Asks for additional entries that fill gaps in an existing world. */
async function generateMoreEntries({ source, world, details, count, excludeDraftId, signal }) {
    const existing = world.entries.map(e => `- ${e.title} [${e.category}] keys: ${e.keys.join(', ')}`).join('\n');
    const text = [
        `This world already exists for the persona below. Add ${count} NEW lorebook entries that fill gaps: more NPCs, places, factions, customs, events and story hooks. Do not repeat or rewrite existing topics, but you may connect new entries to them.`,
        sourceBlock(source),
        `World name: ${world.name}\nWorld description:\n${world.description}`,
        `Existing entries:\n${existing || '(none)'}`,
        details?.trim() ? `World notes from the user (these take priority):\n${details.trim()}` : '',
        BAN_REMINDER,
        'Reply with a JSON object of the form {"entries": [...]} only, each entry using the same fields as before.',
    ].filter(Boolean).join('\n\n');

    const messages = [
        { role: 'system', content: buildSystem({ includeImagePrompt: false, source, excludeDraftId }) },
        { role: 'user', content: text },
    ];
    const raw = await request(messages, signal);
    const parsed = api.parseJsonLoose(raw);
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : []).map(normalizeEntry).filter(e => e.title || e.content);
    if (!entries.length) throw new Error('The model returned no new entries.');
    const known = new Set(world.entries.map(e => e.title.toLowerCase()));
    return { entries: entries.filter(e => !known.has(e.title.toLowerCase())), raw: api.stripReasoning(raw) };
}

/** Entry titles (usually NPC names) that contain a word from the overused names list. */
function overusedTitles(world) {
    return world.entries
        .map(e => ({ title: e.title, parts: api.findOverusedParts(e.title) }))
        .filter(x => x.parts.length);
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replaces a name everywhere in the world: card text, entry titles, keys and content. */
function applyRename(world, oldName, newName) {
    const pairs = [[oldName, newName]];
    // Also map word by word ("Vance" -> "Okafor") so surname-only mentions are caught.
    const oldWords = oldName.split(/\s+/);
    const newWords = newName.split(/\s+/);
    if (oldWords.length === newWords.length) {
        oldWords.forEach((word, i) => { if (word !== newWords[i]) pairs.push([word, newWords[i]]); });
    }
    const replace = text => pairs.reduce((acc, [from, to]) => acc
        .replace(new RegExp(`\\b${escapeRegex(from)}\\b`, 'g'), to)
        .replace(new RegExp(`\\b${escapeRegex(from.toLowerCase())}\\b`, 'g'), to.toLowerCase()), String(text ?? ''));

    for (const key of ['name', 'description', 'scenario', 'first_mes', 'system_prompt', 'creator_notes']) {
        world[key] = replace(world[key]);
    }
    world.alternate_greetings = world.alternate_greetings.map(replace);
    for (const entry of world.entries) {
        entry.title = replace(entry.title);
        entry.content = replace(entry.content);
        entry.keys = entry.keys.map(replace);
        entry.secondary_keys = entry.secondary_keys.map(replace);
    }
}

/** Asks the model for fresh names for entries that use overused names, then applies them. */
async function renameOverused({ source, world, excludeDraftId, signal }) {
    const flagged = overusedTitles(world);
    if (!flagged.length) return [];
    const text = [
        'These names in the world below use overused or banned names. Give each one a new, original name that fits the setting and the character (keep the same number of words; keep a first name if only the surname is banned, and vice versa).',
        flagged.map(f => `- ${f.title} (banned part: ${f.parts.join(', ')})`).join('\n'),
        `World: ${world.name}\n${world.description.slice(0, 1500)}`,
        'Reply with JSON only: {"renames": {"Old Name": "New Name"}}',
    ].join('\n\n');
    const messages = [
        { role: 'system', content: ['You rename characters in a roleplay world so no one uses a stock or banned name.', banText(source, excludeDraftId)].filter(Boolean).join('\n\n') },
        { role: 'user', content: text },
    ];
    const raw = await request(messages, signal);
    const renames = api.parseJsonLoose(raw).renames || {};
    const applied = [];
    for (const { title } of flagged) {
        const next = String(renames[title] ?? '').trim();
        if (!next || next === title) continue;
        applyRename(world, title, next);
        applied.push(`${title} → ${next}`);
    }
    return applied;
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

function toWorldInfoEntry(target, entry) {
    Object.assign(target, {
        comment: entry.category ? `[${entry.category}] ${entry.title}` : entry.title,
        key: entry.keys,
        keysecondary: entry.secondary_keys,
        selective: true,
        selectiveLogic: world_info_logic.AND_ANY,
        content: entry.content,
        constant: entry.constant,
        order: entry.priority * 10,
        position: POSITIONS[entry.position]?.value ?? world_info_position.after,
        depth: entry.depth,
        probability: entry.probability,
        useProbability: true,
    });
}

/** Creates the lorebook, then the sandbox character card with that lorebook attached. */
export async function saveWorldToST(world, imageBlob) {
    const name = world.name.trim();
    if (!name) throw new Error('Give the world a name first.');
    if (!world.entries.length) throw new Error('The world has no lorebook entries.');

    const bookName = world_names?.includes(name) ? getFreeWorldName(name) : name;
    const book = { entries: {} };
    for (const entry of world.entries) {
        const target = createWorldInfoEntry(bookName, book);
        if (target) toWorldInfoEntry(target, entry);
    }
    await saveWorldInfo(bookName, book, true);
    await updateWorldInfoList();

    const card = {
        name,
        description: world.description,
        personality: '',
        scenario: world.scenario,
        first_mes: world.first_mes,
        mes_example: '',
        alternate_greetings: world.alternate_greetings,
        creator_notes: world.creator_notes,
        system_prompt: world.system_prompt,
        post_history_instructions: '',
        tags: world.tags,
    };
    await api.createCharacterInST(card, imageBlob, { world: bookName });
    toastr.success(`Sandbox card "${name}" created with lorebook "${bookName}" (${world.entries.length} entries).`, 'Card Generator');
    return bookName;
}

// ---------------------------------------------------------------------------
// Builder popup
// ---------------------------------------------------------------------------

function fieldHtml(f) {
    const input = f.rows === 1
        ? `<input id="stcg_w_${f.key}" data-card="${f.key}" class="text_pole" type="text">`
        : `<textarea id="stcg_w_${f.key}" data-card="${f.key}" class="text_pole" rows="${f.rows}" style="min-height: calc(${f.rows} * 1.5em + 12px)"></textarea>`;
    return `
        <div class="stcg-field-group">
            <div class="stcg-field-head">
                <label class="stcg-field-label" for="stcg_w_${f.key}">${api.escapeHtml(f.label)}</label>
                ${f.imagePrompt ? `<div class="menu_button menu_button_icon stcg-copy" title="Copy to clipboard"><i class="fa-solid fa-copy"></i> Copy</div>` : ''}
            </div>
            ${input}
        </div>`;
}

function entryHtml(entry, index) {
    const esc = api.escapeHtml;
    const options = Object.entries(POSITIONS)
        .map(([value, p]) => `<option value="${value}" ${entry.position === value ? 'selected' : ''}>${p.label}</option>`).join('');
    return `
        <details class="stcg-entry" data-index="${index}">
            <summary>
                <span class="stcg-entry-title">${esc(entry.category ? `[${entry.category}] ` : '')}${esc(entry.title || '(untitled)')}</span>
                <span class="stcg-entry-keys">${esc(entry.keys.join(', '))}</span>
                ${entry.constant ? '<span class="stcg-badge" title="Always active">constant</span>' : ''}
                ${api.findOverusedParts(entry.title).length ? `<span class="stcg-badge stcg-badge-overused" title="On the overused names list">Overused: ${esc(api.findOverusedParts(entry.title).join(', '))}</span>` : ''}
            </summary>
            <div class="stcg-entry-body">
                <div class="stcg-entry-row">
                    <label>Title<input class="text_pole" data-field="title" value="${esc(entry.title)}"></label>
                    <label>Category<input class="text_pole" data-field="category" value="${esc(entry.category)}"></label>
                </div>
                <label>Keywords (comma-separated)<input class="text_pole" data-field="keys" value="${esc(entry.keys.join(', '))}"></label>
                <label>Secondary keywords (optional, AND ANY)<input class="text_pole" data-field="secondary_keys" value="${esc(entry.secondary_keys.join(', '))}"></label>
                <label>Content<textarea class="text_pole" data-field="content" rows="6" style="min-height: calc(6 * 1.5em + 12px)">${esc(entry.content)}</textarea></label>
                <div class="stcg-entry-row">
                    <label class="checkbox_label"><input type="checkbox" data-field="constant" ${entry.constant ? 'checked' : ''}> Constant</label>
                    <label>Position<select class="text_pole" data-field="position">${options}</select></label>
                    <label title="Only used for @ Depth">Depth<input class="text_pole" type="number" min="0" max="999" data-field="depth" value="${entry.depth}"></label>
                    <label title="1-10, higher wins when the budget is tight">Priority<input class="text_pole" type="number" min="1" max="10" data-field="priority" value="${entry.priority}"></label>
                    <label title="Chance to fire when triggered">Probability %<input class="text_pole" type="number" min="1" max="100" data-field="probability" value="${entry.probability}"></label>
                    <div class="menu_button stcg-entry-delete" title="Delete entry"><i class="fa-solid fa-trash"></i></div>
                </div>
            </div>
        </details>`;
}

/**
 * Opens the world builder, either fresh or to review a world draft.
 * @param {object} [options]
 * @param {object} [options.draft] Existing world draft
 */
export async function openWorldBuilder({ draft = null } = {}) {
    const personas = listPersonas();
    const state = {
        source: draft?.source ?? null,
        data: structuredClone(draft?.data ?? emptyWorld()),
        raw: draft?.raw ?? '',
        details: draft?.details ?? '',
        imageBlob: null,
        imageUrl: '',
        imageChanged: false,
        busy: false,
        abort: null,
    };
    if (draft?.image) {
        try { state.imageBlob = await api.fetchBlob(draft.image); } catch (e) { console.warn(e); }
    }
    if (!state.source && personas.length) {
        // Default to the persona currently in use.
        state.source = personaSource(personas.find(p => p.id === user_avatar)?.id ?? personas[0].id);
    }

    const root = document.createElement('div');
    root.classList.add('stcg-editor', 'stcg-world');
    root.innerHTML = `
        <h3 class="stcg-editor-title">${draft ? 'Review world draft' : 'Create World for Persona'}</h3>
        <div class="stcg-editor-body">
            <div class="stcg-editor-side">
                <label>Build the world around</label>
                <select class="text_pole stcg-w-persona"></select>
                <div class="stcg-w-persona-preview"></div>
                <div class="stcg-dropzone stcg-dropzone-small" title="Optional world art. Click or drop an image">
                    <img class="stcg-preview-img" alt="">
                    <div class="stcg-dropzone-hint"><i class="fa-solid fa-mountain-sun fa-2x"></i><div>Optional world art<br><small>No image: AI suggests an image prompt</small></div></div>
                </div>
                <div class="stcg-side-buttons">
                    <div class="menu_button stcg-change-img"><i class="fa-solid fa-upload"></i> Image</div>
                    <div class="menu_button stcg-clear-img"><i class="fa-solid fa-xmark"></i> Remove</div>
                </div>
                <label>World notes (optional)</label>
                <textarea class="text_pole stcg-details" rows="5" placeholder="e.g. Set in 2140 Neo-Seattle. His dad is a cop, his best friend runs an illegal racing crew..."></textarea>
                <label>Entries per generation
                    <input class="text_pole stcg-w-count" type="number" min="3" max="80">
                </label>
                <div class="menu_button stcg-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generate World</span></div>
                <div class="menu_button stcg-w-more" title="Ask for more entries that fill gaps, keeping what you have"><i class="fa-solid fa-plus"></i> Add more entries</div>
                <div class="menu_button stcg-w-rename" title="Ask the model for new names for entries using overused names, then replace them everywhere"><i class="fa-solid fa-signature"></i> Fix overused names</div>
                <div class="stcg-status"></div>
                <div class="stcg-conflict"></div>
            </div>
            <div class="stcg-editor-fields">
                <h4 class="stcg-section-title"><i class="fa-solid fa-id-card"></i> Sandbox card</h4>
                ${CARD_FIELDS.map(fieldHtml).join('')}
                <div class="stcg-section-head">
                    <h4 class="stcg-section-title"><i class="fa-solid fa-book-atlas"></i> Lorebook <span class="stcg-w-entry-count"></span></h4>
                    <div class="menu_button stcg-w-expand" title="Expand / collapse all"><i class="fa-solid fa-up-down"></i></div>
                    <div class="menu_button stcg-w-add"><i class="fa-solid fa-plus"></i> Add entry</div>
                </div>
                <div class="stcg-w-entries"></div>
                <details class="stcg-raw">
                    <summary>Raw model output</summary>
                    <textarea class="text_pole stcg-raw-text" rows="8"></textarea>
                    <div class="menu_button stcg-parse-raw">Parse raw</div>
                </details>
            </div>
        </div>`;

    const $root = $(root);
    const $img = $root.find('.stcg-preview-img');
    const $status = $root.find('.stcg-status');
    const $entries = $root.find('.stcg-w-entries');
    const $generate = $root.find('.stcg-generate');
    const $more = $root.find('.stcg-w-more');
    const $rename = $root.find('.stcg-w-rename');
    const s = api.settings();

    // Persona picker. A draft's persona may have been deleted since; keep its snapshot selectable.
    const $persona = $root.find('.stcg-w-persona');
    for (const p of personas) $persona.append(new Option(p.name, p.id));
    if (state.source && !personas.some(p => p.id === state.source.personaId)) {
        $persona.append(new Option(`${state.source.name} (snapshot)`, state.source.personaId));
    }
    if (!personas.length && !state.source) {
        $persona.append(new Option('No personas yet. Create one first.', ''));
    }
    $persona.val(state.source?.personaId ?? '');

    function renderPersonaPreview() {
        const text = state.source?.description || '';
        $root.find('.stcg-w-persona-preview').text(text ? (text.length > 260 ? `${text.slice(0, 260)}…` : text) : '');
    }

    function setImage(blob, changed = true) {
        if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
        state.imageBlob = blob || null;
        state.imageUrl = blob ? URL.createObjectURL(blob) : '';
        if (changed) state.imageChanged = true;
        $img.attr('src', state.imageUrl).toggle(!!blob);
        $root.find('.stcg-dropzone').toggleClass('has-image', !!blob);
    }

    function writeCard() {
        for (const f of CARD_FIELDS) {
            const value = state.data[f.key];
            $root.find(`[data-card="${f.key}"]`).val(f.list ? (value || []).join('\n---\n') : f.tags ? (value || []).join(', ') : (value ?? ''));
        }
        $root.find('.stcg-raw-text').val(state.raw);
        checkName();
    }

    function readCard() {
        for (const f of CARD_FIELDS) {
            const text = String($root.find(`[data-card="${f.key}"]`).val() ?? '');
            state.data[f.key] = f.list ? text.split(/\n\s*---\s*\n/).map(x => x.trim()).filter(Boolean)
                : f.tags ? text.split(',').map(x => x.trim()).filter(Boolean)
                    : text;
        }
        state.details = String($root.find('.stcg-details').val() ?? '');
        state.raw = String($root.find('.stcg-raw-text').val() ?? '');
    }

    function renderEntries({ openIndex = null } = {}) {
        $entries.html(state.data.entries.map(entryHtml).join('') || '<div class="stcg-empty">No entries yet. Generate a world or add entries by hand.</div>');
        $root.find('.stcg-w-entry-count').text(`(${state.data.entries.length})`);
        if (openIndex !== null) $entries.find(`.stcg-entry[data-index="${openIndex}"]`).prop('open', true);
        updateOverusedWarning();
    }

    function updateOverusedWarning() {
        const flagged = overusedTitles(state.data);
        $rename.toggle(flagged.length > 0);
        $root.find('.stcg-w-overused').remove();
        if (flagged.length) {
            $root.find('.stcg-conflict').after(`<div class="stcg-conflict stcg-w-overused"><i class="fa-solid fa-triangle-exclamation"></i> ${flagged.length} entr${flagged.length === 1 ? 'y uses' : 'ies use'} overused names: ${api.escapeHtml(flagged.map(f => f.title).join(', '))}</div>`);
        }
    }

    function checkName() {
        const name = String($root.find('[data-card="name"]').val() ?? '').trim();
        const conflict = api.findNameConflict(name, { excludeDraftId: draft?.id });
        const bookTaken = name && world_names?.includes(name);
        $root.find('.stcg-conflict').html([
            conflict ? `<div><i class="fa-solid fa-triangle-exclamation"></i> "${api.escapeHtml(name)}" is already used by ${conflict}.</div>` : '',
            bookTaken ? `<div><i class="fa-solid fa-circle-info"></i> A lorebook named "${api.escapeHtml(name)}" exists; a numbered copy will be created.</div>` : '',
        ].join(''));
    }

    function setBusy(busy, message = '') {
        state.busy = busy;
        $generate.toggleClass('stcg-busy', busy).find('span').text(busy ? 'Stop' : 'Generate World');
        $generate.find('i').attr('class', busy ? 'fa-solid fa-stop' : 'fa-solid fa-wand-magic-sparkles');
        $more.toggleClass('disabled', busy);
        $rename.toggleClass('disabled', busy);
        $status.text(message);
    }

    async function run(kind) {
        if (state.busy) {
            if (kind === 'world') state.abort?.abort();
            return;
        }
        readCard();
        if (!state.source) { toastr.warning('Pick a persona first.'); return; }
        if (kind === 'more' && !state.data.entries.length) { toastr.warning('Generate a world first.'); return; }
        state.abort = new AbortController();
        setBusy(true, ({
            world: 'Building the world… big worlds can take a few minutes.',
            more: 'Adding entries…',
            rename: 'Finding new names…',
        })[kind]);
        try {
            if (kind === 'rename') {
                const applied = await renameOverused({ source: state.source, world: state.data, excludeDraftId: draft?.id, signal: state.abort.signal });
                writeCard();
                renderEntries();
                setBusy(false, applied.length ? `Renamed: ${applied.join(', ')}` : 'The model suggested no usable new names. Edit them by hand.');
                return;
            }
            if (kind === 'world') {
                const result = await generateWorld({
                    source: state.source,
                    imageBlob: state.imageBlob,
                    details: state.details,
                    excludeDraftId: draft?.id,
                    signal: state.abort.signal,
                });
                state.data = result.data;
                state.raw = result.raw;
                writeCard();
            } else {
                const result = await generateMoreEntries({
                    source: state.source,
                    world: state.data,
                    details: state.details,
                    count: clampInt(s.worldEntryCount, 3, 80, 20),
                    excludeDraftId: draft?.id,
                    signal: state.abort.signal,
                });
                state.data.entries.push(...result.entries);
                state.raw = result.raw;
                $root.find('.stcg-raw-text').val(state.raw);
            }
            renderEntries();
            setBusy(false, `Done. ${state.data.entries.length} entries. Review and edit before saving.`);
        } catch (error) {
            console.error('[stcardgen]', error);
            const aborted = state.abort.signal.aborted;
            setBusy(false, aborted ? 'Stopped.' : `Error: ${error?.message || error}`);
            if (!aborted) toastr.error(String(error?.message || error), 'Card Generator');
        }
    }

    // Wiring
    $root.find('.stcg-details').val(state.details);
    $root.find('.stcg-w-count').val(s.worldEntryCount).on('input', e => {
        s.worldEntryCount = Number($(e.target).val());
        SillyTavern.getContext().saveSettingsDebounced();
    });
    $persona.on('change', () => {
        const id = String($persona.val());
        state.source = personaSource(id) ?? (state.source?.personaId === id ? state.source : null);
        renderPersonaPreview();
    });
    setImage(state.imageBlob, false);
    writeCard();
    renderEntries();
    renderPersonaPreview();

    const pickImage = async () => {
        const [file] = await api.pickFiles();
        if (file) setImage(file);
    };
    $root.find('.stcg-dropzone, .stcg-change-img').on('click', pickImage);
    $root.find('.stcg-clear-img').on('click', () => setImage(null));
    // Stop propagation so ST's body-level drop handler doesn't import the file as a character.
    $root
        .on('dragover', e => { e.preventDefault(); e.stopPropagation(); })
        .on('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.originalEvent?.dataTransfer?.files?.[0];
            if (file?.type.startsWith('image/')) setImage(file);
        });
    $root.find('[data-card="name"]').on('input', checkName);
    $root.find('.stcg-copy').on('click', () => api.copyText(String($root.find('[data-card="image_prompt"]').val() ?? '')));
    $generate.on('click', () => run('world'));
    $more.on('click', () => run('more'));
    $rename.on('click', () => run('rename'));
    $root.find('.stcg-w-add').on('click', () => {
        state.data.entries.push(normalizeEntry({ title: 'New entry' }));
        renderEntries({ openIndex: state.data.entries.length - 1 });
    });
    $root.find('.stcg-w-expand').on('click', () => {
        const $all = $entries.find('.stcg-entry');
        const open = $all.filter('[open]').length < $all.length;
        $all.prop('open', open);
    });
    $root.find('.stcg-parse-raw').on('click', () => {
        readCard();
        try {
            state.data = normalizeWorld(api.parseJsonLoose(state.raw));
            writeCard();
            renderEntries();
            $status.text('Parsed raw output.');
        } catch (error) {
            toastr.error(String(error.message), 'Card Generator');
        }
    });

    // Entry edits write straight into state.
    $entries.on('input change', '[data-field]', e => {
        const $el = $(e.currentTarget);
        const entry = state.data.entries[Number($el.closest('.stcg-entry').data('index'))];
        if (!entry) return;
        const field = String($el.data('field'));
        if (field === 'constant') entry.constant = $el.prop('checked');
        else if (field === 'keys' || field === 'secondary_keys') entry[field] = keyList(String($el.val()));
        else if (['depth', 'priority', 'probability'].includes(field)) entry[field] = Number($el.val());
        else entry[field] = String($el.val());
        if (['title', 'category', 'keys', 'constant'].includes(field)) {
            const $summary = $el.closest('.stcg-entry').find('summary');
            const index = Number($el.closest('.stcg-entry').data('index'));
            const fresh = $(entryHtml(normalizeEntry(entry), index)).find('summary').html();
            $summary.html(fresh);
            updateOverusedWarning();
        }
    });
    $entries.on('click', '.stcg-entry-delete', e => {
        const index = Number($(e.currentTarget).closest('.stcg-entry').data('index'));
        state.data.entries.splice(index, 1);
        renderEntries();
    });

    const SAVE_DRAFT = POPUP_RESULT.CUSTOM1;
    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Create World',
        cancelButton: 'Close',
        customButtons: [{ text: draft ? 'Update Draft' : 'Save to Drafts', result: SAVE_DRAFT, classes: ['stcg-save-draft'] }],
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
        onClosing: async (p) => {
            readCard();
            state.data.entries = state.data.entries.map(normalizeEntry);
            if (p.result === POPUP_RESULT.AFFIRMATIVE) {
                if (state.busy) { toastr.warning('Wait for generation to finish.'); return false; }
                if (!state.data.name?.trim()) { toastr.warning('Give the world a name first.'); return false; }
                const conflict = api.findNameConflict(state.data.name, { excludeDraftId: draft?.id });
                if (conflict) {
                    const ok = await Popup.show.confirm('Name already in use', `"${api.escapeHtml(state.data.name)}" is already used by ${conflict}. Create anyway?`);
                    if (!ok) return false;
                }
                try {
                    await saveWorldToST(state.data, state.imageBlob);
                    if (draft) await api.deleteDraft(draft.id);
                } catch (error) {
                    console.error('[stcardgen]', error);
                    toastr.error(String(error?.message || error), 'Card Generator');
                    return false;
                }
            } else if (p.result === SAVE_DRAFT) {
                if (state.busy) { toastr.warning('Wait for generation to finish.'); return false; }
                if (!state.source) { toastr.warning('Pick a persona first.'); return false; }
                try {
                    await saveWorldDraft(state, draft);
                    toastr.success('Saved to Drafts.', 'Card Generator');
                } catch (error) {
                    toastr.error(String(error?.message || error), 'Card Generator');
                    return false;
                }
            } else if (state.busy) {
                state.abort?.abort();
            }
            return true;
        },
        onClose: () => { if (state.imageUrl) URL.revokeObjectURL(state.imageUrl); },
    });
    return await popup.show();
}

async function saveWorldDraft(state, existing) {
    const draft = existing ? (api.getDraft(existing.id) ?? existing) : {
        id: api.uid(),
        type: 'world',
        createdAt: Date.now(),
        image: null,
    };
    if (!existing || state.imageChanged) {
        const previous = draft.image;
        draft.image = state.imageBlob ? await api.storeFile(state.imageBlob, `${draft.id}_${Date.now()}`) : null;
        if (previous) await api.deleteStoredFile(previous);
    }
    draft.source = structuredClone(state.source);
    draft.data = structuredClone(state.data);
    draft.raw = state.raw;
    draft.details = state.details;
    draft.error = '';
    draft.status = state.data.entries.length ? 'ready' : 'queued';
    api.upsertDraft(draft);
}
