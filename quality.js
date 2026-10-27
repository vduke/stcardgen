// Quality pass: review/score a generated persona, character or world, then patch it
// (fix issues, enhance, optimize) without rewriting what is already good.

const LEGACY_REVIEW_CALIBRATION = 'Score it honestly; a 10 is rare.';
const REVIEW_CALIBRATION = 'Score it honestly and be hard to impress. Calibration: a solid first draft usually scores 6-7; 8 is genuinely strong; 9+ means you looked hard and found nothing meaningful to improve. You are likely reviewing AI-generated text, so watch for its habits: stock names, generic adjectives ("mysterious", "enigmatic"), tidy summaries instead of specifics, and repeated phrasing.';

const PLAYABILITY_LINE = '- playability: gives the AI what it needs to roleplay well: motivations, speech style, relationships, conflicts and hooks. For worlds: NPCs have goals and distinct voices, places have things to do.';
const RULES_LINE = '- rules: correct {{char}}/{{user}} macros, never acts or speaks for {{user}}, opening messages end on an in-world beat (never "What do you do?"), example messages use <START> and name prefixes, no Main Prompt content.';

// [old, new] pairs applied to saved rubrics; a line the user edited no longer matches and is left alone.
const REVIEW_LINE_MIGRATIONS = [
    [LEGACY_REVIEW_CALIBRATION, REVIEW_CALIBRATION],
    [PLAYABILITY_LINE, `${PLAYABILITY_LINE} For personas: gives other characters concrete things to notice and react to (look, manner, habits, history) without scripting what {{user}} does.`],
    [RULES_LINE, '- rules: characters and worlds use correct {{char}}/{{user}} macros, never act or speak for {{user}}, end opening messages on an in-world beat (never "What do you do?"), use <START> and name prefixes in example messages, and have no Main Prompt content. Personas are third person, have no dialogue, and never describe or speak for {{char}}.'],
];

export function migrateReviewPrompt(text) {
    return REVIEW_LINE_MIGRATIONS.reduce((acc, [oldLine, newLine]) => acc.replace(oldLine, newLine), String(text));
}

export const DEFAULT_REVIEW_PROMPT = migrateReviewPrompt(`You are a strict editor reviewing a SillyTavern {{type}} before it is published. ${REVIEW_CALIBRATION} A good card is vivid and specific without bloat: every sentence should change how the AI plays it.

Score each criterion from 1 to 10:
- specificity: concrete, original details (names, habits, history, sensory specifics) instead of generic tropes, cliches or purple prose.
- consistency: fields agree with each other and with the user's details; no contradictions in ages, relationships, timeline or appearance; names used consistently.
${PLAYABILITY_LINE}
${RULES_LINE}
- efficiency: no filler, repetition or padding, and no lazy, thin fields either. Length fits the content.
For worlds, also score:
- keywords: lorebook keys are specific trigger words (names, places, distinctive terms), not generic words that would fire constantly; secondary keys are used where disambiguation helps.
- coverage: the world covers what this persona's life needs (home, work or school, people, places, factions, hooks) without overlapping entries.

List concrete issues, most important first. Tie each one to a single field (or lorebook entry index) and give a specific fix. Always list at least the 3 most impactful improvements, even for a good card; skip pure nitpicks; list at most 8.`);

export const DEFAULT_ENHANCE_PROMPT = `Enhance the {{type}}: add concrete, specific details that make it better to roleplay with (history, habits, relationships, sensory details, speech quirks, conflicts, story hooks). Stay consistent with everything already established. Grow the text by roughly 30-60%. No filler, no purple prose, no repetition.`;

export const DEFAULT_OPTIMIZE_PROMPT = `Optimize the {{type}} for token efficiency: cut filler, repetition, purple prose and anything that does not change how the AI plays it. Keep every fact, name, relationship and behavior that matters, and keep the voice. Use tight prose (do not switch to W++ or bullet lists unless the text already uses them). Aim for roughly 30-50% fewer tokens.`;

const FIX_INSTRUCTION = 'Revise the {{type}} to resolve the issues below. Change only what is needed to fix them; keep everything else exactly as it is.';
const STEER_INSTRUCTION = 'Revise the {{type}} to follow the user\'s instructions below. Change only what they ask for; keep everything else exactly as it is.';

// The fields each type really has. Reviews of a persona kept asking for a first message and example
// dialogue, which personas do not have, so the reviewer is told the scope and off-scope issues are dropped.
const TYPE_FIELDS = {
    persona: ['name', 'title', 'description'],
    character: ['name', 'description', 'personality', 'scenario', 'first_mes', 'alternate_greetings', 'mes_example', 'tags', 'creator_notes', 'post_history_instructions'],
    world: ['name', 'description', 'scenario', 'first_mes', 'alternate_greetings', 'mes_example', 'tags', 'creator_notes'],
};
const CARD_ONLY_FIELDS = new Set(['first_mes', 'first_message', 'greeting', 'greetings', 'alternate_greetings', 'mes_example', 'example_messages', 'example_dialogue', 'tags', 'creator_notes', 'post_history_instructions', 'system_prompt']);
const CARD_ONLY_TEXT = /\b(first[ _]?mes(sage)?|opening message|alternate[ _]greetings?|mes_example|example (messages?|dialogues?|exchanges?)|post[ _]history|system[ _]prompt|main prompt|(missing|empty|no|add an?) (personality|scenario) field)\b/i;
// Personas describe personality inside the description, so these labels point at the description.
const PERSONA_FIELD_ALIASES = { personality: 'description', scenario: 'description', background: 'description', appearance: 'description' };

function scopeLine(type) {
    const fields = TYPE_FIELDS[type].join(', ');
    if (type === 'persona') {
        return `This is a USER PERSONA (the character the user plays), not a character card. Its only fields are: ${fields}. Personas have no first message, greetings, example messages, scenario, personality field or tags: never ask for them, never list their absence as an issue, and never lower a score because they are missing. Apply only the parts of each criterion that fit a persona.`;
    }
    return `Its fields are: ${fields}${type === 'world' ? ', plus the lorebook entries' : ''}. Only raise issues about these.`;
}

function inScope(type, issue) {
    if (issue.entry !== null) return type === 'world';
    if (type !== 'persona') return true;
    const field = issue.field.toLowerCase().trim().replace(/[\s-]+/g, '_');
    return !CARD_ONLY_FIELDS.has(field) && !CARD_ONLY_TEXT.test(`${issue.field} ${issue.problem} ${issue.fix}`);
}

function scopeField(type, field) {
    if (type !== 'persona') return field;
    return PERSONA_FIELD_ALIASES[field.toLowerCase().trim()] ?? field;
}

function steerBlock(steer) {
    return steer?.trim() ? `The user's instructions (follow them; they take priority over the issues list, but not over the card rules):\n${steer.trim()}` : '';
}

const CRITERIA = ['specificity', 'consistency', 'playability', 'rules', 'efficiency'];
const WORLD_CRITERIA = [...CRITERIA, 'keywords', 'coverage'];

const REVIEW_FORMAT = `Respond ONLY with one JSON object and nothing else:
{
  "scores": { {{criteria}} },
  "issues": [ { "field": "field name", "entry": null, "problem": "what is wrong", "fix": "what to change" } ],
  "summary": "one sentence verdict"
}
Use "entry" for the lorebook entry index when an issue is about an entry (field is then the entry field, e.g. "keys" or "content"); otherwise null.`;

const PATCH_FORMAT = `Respond ONLY with one JSON object containing just what you changed:
{
  "fields": { "field name": "new full value" }{{entriesFormat}}
}
Use the same field names as the input. Omit fields you did not change. Array fields (alternate_greetings, tags, keys, secondary_keys) must be complete arrays.`;

const ENTRIES_PATCH_FORMAT = `,
  "entries": [ { "index": 0, "content": "new full value", "keys": ["complete array"] } ]
Only include entries you changed, identified by index, with only the changed entry fields. To add a brand-new entry, use "index": null with all entry fields.`;

const TEXT_FIELDS = {
    persona: ['description'],
    character: ['description', 'personality', 'scenario', 'first_mes', 'alternate_greetings', 'mes_example', 'creator_notes', 'post_history_instructions'],
    world: ['description', 'scenario', 'first_mes', 'alternate_greetings', 'mes_example', 'creator_notes'],
};

let api = null;

/** Helpers from index.js / world.js, injected to avoid circular imports. */
export function initQuality(helpers) {
    api = helpers;
}

function typeWord(type) {
    return ({ persona: 'persona', character: 'character card', world: 'sandbox world (narrator card + lorebook)' })[type] || type;
}

function fill(template, type) {
    return String(template || '').replace(/{{type}}/g, typeWord(type));
}

/** The card as the model should see it: no image prompt, entries numbered. */
function serialize(type, data) {
    const { image_prompt: _, entries, ...fields } = data;
    const out = { fields };
    if (type === 'world') {
        out.entries = (entries || []).map((e, index) => ({ index, ...e }));
    }
    return JSON.stringify(out, null, 1);
}

/** The generation rules for this type, so revisions keep following them. */
function rulesFor(type) {
    const s = api.settings();
    return ({ persona: s.personaPrompt, character: s.characterPrompt, world: s.worldPrompt })[type] || '';
}

/** Reviews and revisions can introduce new names too, so they get the ban list as well. */
function banLine(data, source) {
    const own = new Set([data?.name, source?.name].filter(Boolean).map(n => String(n).toLowerCase()));
    const banned = api.getBannedNames().filter(n => !own.has(n.toLowerCase()));
    return banned.length
        ? `Never introduce or suggest any of these names (as a first name or surname) for any new person, place or group: ${banned.join(', ')}`
        : '';
}

function maxTokensFor(type) {
    const s = api.settings();
    return type === 'world' ? s.worldMaxTokens : s.maxTokens;
}

function contextBlock({ type, data, details, source }) {
    return [
        source ? `The world is built around this persona ({{user}}):\nName: ${source.name}\n${source.description || ''}` : '',
        details?.trim() ? `The user's details (these take priority):\n${details.trim()}` : '',
        `Current ${typeWord(type)}:\n${serialize(type, data)}`,
    ].filter(Boolean).join('\n\n');
}

async function ask(type, system, user, signal, { profileId = null } = {}) {
    const result = await api.sendMessages([
        { role: 'system', content: system },
        { role: 'user', content: user },
    ], signal, { maxTokens: maxTokensFor(type), profileId });
    const raw = String(result?.content ?? '');
    if (!raw.trim()) throw new Error('The model returned an empty response.');
    return api.parseJsonLoose(raw);
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/**
 * Scores a card and lists issues.
 * @returns {Promise<{scores: Record<string, number>, overall: number, issues: object[], summary: string, at: number}>}
 */
export async function reviewCard({ type, data, details = '', source = null, signal = null, previousIssues = [] }) {
    const s = api.settings();
    const criteria = type === 'world' ? WORLD_CRITERIA : CRITERIA;
    // On a re-review after a fix, keep the reviewer from flip-flopping on what it just asked for.
    const previous = previousIssues.length
        ? `A previous review raised these issues and they have now been addressed. Do not ask to reverse those changes or raise them again, unless the fix itself introduced a new problem:\n${previousIssues.map(i => `- [${i.entry !== null ? `entry ${i.entry} ` : ''}${i.field}] ${i.problem}`).join('\n')}`
        : '';
    const system = [
        fill(s.reviewPrompt, type),
        scopeLine(type),
        `The card was generated under these rules:\n${rulesFor(type)}`,
        banLine(data, source),
        previous,
        REVIEW_FORMAT.replace('{{criteria}}', criteria.map(c => `"${c}": 0`).join(', ')),
    ].filter(Boolean).join('\n\n');
    // A different model as critic grades much harder than the generator grading itself.
    const parsed = await ask(type, system, `${contextBlock({ type, data, details, source })}\n\nReview it now. JSON only.`, signal, { profileId: s.reviewProfileId || null });

    const scores = {};
    for (const c of criteria) {
        const n = Number(parsed.scores?.[c]);
        if (Number.isFinite(n)) scores[c] = Math.min(10, Math.max(1, Math.round(n)));
    }
    const values = Object.values(scores);
    // Computed here rather than trusting the model's own "overall".
    const overall = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : 0;
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
        .map(i => ({
            field: scopeField(type, String(i?.field ?? '').trim()),
            entry: Number.isInteger(i?.entry) ? i.entry : null,
            problem: String(i?.problem ?? '').trim(),
            fix: String(i?.fix ?? '').trim(),
        }))
        .filter(i => i.problem && inScope(type, i))
        .slice(0, 8);

    // Banned names are checked in code, not left to the reviewer, and go first so a fix renames them.
    const nameIssues = api.findOverusedNames(data, [source?.name]).map(name => ({
        field: 'names',
        entry: null,
        name,
        problem: `"${name}" uses an overused or banned name.`,
        fix: `Rename "${name}" to an original name that fits, everywhere it appears (fields, entry titles, keys and content).`,
    }));
    if (nameIssues.length && scores.specificity) scores.specificity = Math.min(scores.specificity, 6);
    const finalValues = Object.values(scores);
    const finalOverall = finalValues.length ? Math.round(finalValues.reduce((a, b) => a + b, 0) / finalValues.length * 10) / 10 : overall;
    return { scores, overall: finalOverall, issues: [...nameIssues, ...issues], summary: String(parsed.summary ?? '').trim(), at: Date.now() };
}

// ---------------------------------------------------------------------------
// Revisions (patches)
// ---------------------------------------------------------------------------

function applyPatch(type, data, patch) {
    const fields = patch?.fields && typeof patch.fields === 'object' ? patch.fields : {};
    const merged = { ...data };
    for (const [key, value] of Object.entries(fields)) {
        if (key === 'entries' || key === 'image_prompt') continue;
        if (key in data) merged[key] = value;
    }
    if (type === 'world') {
        const entries = [...(data.entries || [])];
        for (const change of Array.isArray(patch?.entries) ? patch.entries : []) {
            const index = Number.isInteger(change?.index) ? change.index : null;
            const { index: _, ...rest } = change || {};
            if (index === null) {
                entries.push(api.normalizeEntry(rest));
            } else if (entries[index]) {
                entries[index] = api.normalizeEntry({ ...entries[index], ...rest });
            }
        }
        merged.entries = entries;
    }
    const result = api.normalizeData(type, merged);
    result.image_prompt = data.image_prompt ?? '';
    return result;
}

function changedFields(type, before, after) {
    const changed = Object.keys(after).filter(k => k !== 'entries' && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (type === 'world') {
        const entryChanges = after.entries.filter((e, i) => JSON.stringify(e) !== JSON.stringify(before.entries[i])).length;
        if (entryChanges) changed.push(`${entryChanges} entr${entryChanges === 1 ? 'y' : 'ies'}`);
    }
    return changed;
}

// ---------------------------------------------------------------------------
// Renaming (deterministic; models are unreliable at avoiding banned names)
// ---------------------------------------------------------------------------

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Applies a function to every string in a value, recursively, skipping image_prompt. */
function deepMapStrings(value, fn, key = '') {
    if (key === 'image_prompt') return value;
    if (typeof value === 'string') return fn(value);
    if (Array.isArray(value)) return value.map(v => deepMapStrings(v, fn));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepMapStrings(v, fn, k)]));
    }
    return value;
}

/** Replaces a name everywhere, including surname-only / first-name-only mentions and lowercase keys. */
export function applyRename(data, oldName, newName) {
    const pairs = [[oldName, newName]];
    const oldWords = oldName.split(/\s+/);
    const newWords = newName.split(/\s+/);
    if (oldWords.length === newWords.length) {
        oldWords.forEach((word, i) => { if (word !== newWords[i]) pairs.push([word, newWords[i]]); });
    }
    const replace = text => pairs.reduce((acc, [from, to]) => acc
        .replace(new RegExp(`\\b${escapeRegex(from)}\\b`, 'g'), to)
        .replace(new RegExp(`\\b${escapeRegex(from.toLowerCase())}\\b`, 'g'), to.toLowerCase()), text);
    return deepMapStrings(data, replace);
}

function isBannedName(name) {
    // Prefixed so a single-word name is checked as a mid-sentence mention.
    return api.findOverusedNames({ text: `with ${name}` }).length > 0;
}

/**
 * Gets new names for the given names from the model, rejecting any suggestion that is itself
 * banned (and asking again), then replaces them everywhere in the data.
 * @returns {Promise<{data: object, applied: string[], unresolved: string[]}>}
 */
export async function renameNames({ type, data, names, source = null, signal = null }) {
    let pending = [...names];
    const applied = [];
    const rejected = [];
    for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
        const user = [
            'Give each of these people/places a new, original name that fits the setting and the character. Keep the same number of words, and keep a first name if only the surname is the problem (and vice versa).',
            pending.map(n => `- ${n}`).join('\n'),
            rejected.length ? `These suggestions were rejected because they are also banned; do not reuse them: ${rejected.join(', ')}` : '',
            `Context:\n${serialize(type, data).slice(0, 4000)}`,
            'Reply with JSON only: {"renames": {"Old Name": "New Name"}}',
        ].filter(Boolean).join('\n\n');
        const system = ['You rename characters, places and groups in roleplay cards so that nothing uses a stock or banned name.', banLine(data, source)].filter(Boolean).join('\n\n');
        const parsed = await ask(type, system, user, signal);
        const renames = parsed.renames && typeof parsed.renames === 'object' ? parsed.renames : parsed;
        const next = [];
        for (const name of pending) {
            const suggestion = String(renames[name] ?? '').trim();
            if (!suggestion || suggestion === name || isBannedName(suggestion)) {
                if (suggestion) rejected.push(suggestion);
                next.push(name);
                continue;
            }
            data = applyRename(data, name, suggestion);
            applied.push(`${name} → ${suggestion}`);
        }
        pending = next;
    }
    return { data, applied, unresolved: pending };
}

/**
 * Revises the whole card with a patch.
 * @param {object} options
 * @param {'fix'|'enhance'|'optimize'} options.mode
 * @returns {Promise<{data: object, changed: string[]}>}
 */
export async function reviseCard({ type, data, mode, issues = [], steer = '', details = '', source = null, signal = null }) {
    const s = api.settings();
    // Unticked issues are ones the user disagrees with; an unticked name issue means "keep this name".
    const active = issues.filter(i => !i.skip);
    const keptNames = issues.filter(i => i.skip && i.field === 'names' && i.name).map(i => i.name);
    const steerText = steerBlock(steer);
    if (mode === 'fix' && !active.length && !steerText) throw new Error('Nothing to fix: run a review and keep at least one issue ticked, or write instructions.');
    // Name issues are handled by renameNames below, not by the general patch.
    const contentIssues = active.filter(i => i.field !== 'names');
    const instruction = mode === 'fix' ? (contentIssues.length ? FIX_INSTRUCTION : STEER_INSTRUCTION) : mode === 'enhance' ? s.enhancePrompt : s.optimizePrompt;
    let next = data;
    if (mode !== 'fix' || contentIssues.length || steerText) {
        const system = [
            fill(instruction, type),
            `Card rules (revisions must still follow them):\n${rulesFor(type)}`,
            banLine(data, source),
            steerText
                ? 'Do not rename existing people or places unless the user\'s instructions ask for it; stock names are handled separately.'
                : 'Do not rename existing people or places; renaming is handled separately.',
            PATCH_FORMAT.replace('{{entriesFormat}}', type === 'world' ? ENTRIES_PATCH_FORMAT : ''),
        ].filter(Boolean).join('\n\n');
        const issueText = mode === 'fix' && contentIssues.length
            ? `\n\nIssues to fix:\n${contentIssues.map((i, n) => `${n + 1}. [${i.entry !== null ? `entry ${i.entry} ` : ''}${i.field}] ${i.problem} Fix: ${i.fix}`).join('\n')}`
            : '';
        const user = [`${contextBlock({ type, data, details, source })}${issueText}`, steerText, 'Return the patch JSON only.'].filter(Boolean).join('\n\n');
        const patch = await ask(type, system, user, signal);
        next = applyPatch(type, data, patch);
    }
    const changed = changedFields(type, data, next);

    // Catch banned names that were already there or that the revision just invented.
    const names = api.findOverusedNames(next, [source?.name, ...keptNames]);
    if (names.length) {
        const renamed = await renameNames({ type, data: next, names, source, signal });
        next = renamed.data;
        if (renamed.applied.length) changed.push(`renamed ${renamed.applied.join(', ')}`);
        if (renamed.unresolved.length) changed.push(`could not rename ${renamed.unresolved.join(', ')}`);
    }
    return { data: next, changed };
}

/**
 * Rewrites a single field (or one lorebook entry's content) in enhance/optimize mode.
 * @returns {Promise<string|string[]>} The new value
 */
export async function reviseField({ type, data, field, entryIndex = null, mode, steer = '', details = '', source = null, signal = null }) {
    const s = api.settings();
    const instruction = mode === 'enhance' ? s.enhancePrompt : s.optimizePrompt;
    const target = entryIndex === null ? `the field "${field}"` : `the "content" of lorebook entry ${entryIndex} ("${data.entries[entryIndex]?.title}")`;
    const isList = entryIndex === null && Array.isArray(data[field]);
    const current = entryIndex === null ? data[field] : data.entries[entryIndex]?.content;
    const currentText = Array.isArray(current) ? current.join('\n---\n') : String(current ?? '');
    const system = [
        fill(instruction, type),
        `Apply this ONLY to ${target}. Everything else is context and must not be rewritten.`,
        `Card rules (the rewrite must still follow them):\n${rulesFor(type)}`,
        banLine(data, source),
        `Respond ONLY with JSON: {"value": ${isList ? '["complete array of strings"]' : '"the new full text of this one field, as plain prose (not JSON, not the whole card)"'}}`,
    ].filter(Boolean).join('\n\n');
    const user = [
        contextBlock({ type, data, details, source }),
        `Current text of ${target}:\n<<<\n${currentText}\n>>>`,
        steerBlock(steer),
        `Rewrite only that text now. JSON only.`,
    ].filter(Boolean).join('\n\n');
    const parsed = await ask(type, system, user, signal);
    const value = unwrapFieldValue(parsed, field);
    if (isList) return api.toStringList(value);
    const text = api.asText(value).trim();
    if (!text) throw new Error('The model returned an empty rewrite.');

    // Reject rewrites that went the wrong way rather than silently applying them.
    const before = await countTokens(currentText);
    const after = await countTokens(text);
    if (mode === 'optimize' && after >= before) throw new Error(`Optimize came back longer (${before} → ${after} tokens); nothing changed. Try again.`);
    if (mode === 'enhance' && after <= before) throw new Error(`Enhance came back shorter (${before} → ${after} tokens); nothing changed. Try again.`);
    return text;
}

/**
 * Pulls the new field value out of whatever shape the model answered with: {"value"}, the field
 * name, a patch ({"fields": {...}}), or a value that is itself the whole card serialized as JSON.
 */
function unwrapFieldValue(parsed, field, depth = 0) {
    const pick = obj => obj?.value ?? obj?.[field] ?? obj?.fields?.[field] ?? obj?.content ?? obj?.text;
    let value = pick(parsed);
    if (value === undefined) {
        const strings = Object.values(parsed || {}).filter(v => typeof v === 'string' || Array.isArray(v));
        if (strings.length === 1) value = strings[0];
    }
    if (typeof value === 'string' && depth < 2 && /^\s*\{[\s\S]*\}\s*$/.test(value)) {
        try {
            return unwrapFieldValue(JSON.parse(value), field, depth + 1);
        } catch { /* plain text that happens to use braces */ }
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && depth < 2) {
        return unwrapFieldValue(value, field, depth + 1);
    }
    return value;
}

// ---------------------------------------------------------------------------
// Auto pipeline
// ---------------------------------------------------------------------------

/**
 * Review, and if the score is under the auto-fix threshold, fix once and review again.
 * @returns {Promise<{data: object, review: object}>}
 */
export async function qualityPass({ type, data, details = '', source = null, signal = null, onStatus = () => { } }) {
    const s = api.settings();
    onStatus('Reviewing…');
    let review = await reviewCard({ type, data, details, source, signal });
    const threshold = Number(s.autoFixBelow) || 0;
    const hasBannedNames = review.issues.some(i => i.field === 'names');
    if (threshold > 0 && review.issues.length && (review.overall < threshold || hasBannedNames)) {
        onStatus(`Score ${review.overall}/10 is under ${threshold}. Fixing issues…`);
        const fixed = await reviseCard({ type, data, mode: 'fix', issues: review.issues, details, source, signal });
        data = fixed.data;
        onStatus('Re-reviewing…');
        const before = review;
        review = await reviewCard({ type, data, details, source, signal, previousIssues: before.issues });
        review.previous = before.overall;
    }
    return { data, review };
}

// ---------------------------------------------------------------------------
// Tokens & rendering
// ---------------------------------------------------------------------------

export async function countTokens(text) {
    const value = Array.isArray(text) ? text.join('\n') : String(text ?? '');
    if (!value.trim()) return 0;
    try {
        return await SillyTavern.getContext().getTokenCountAsync(value);
    } catch {
        return Math.ceil(value.length / 4);
    }
}

/** Token totals: the card itself, and for worlds the lorebook and its always-on (constant) share. */
export async function tokenSummary(type, data) {
    const fields = TEXT_FIELDS[type] || [];
    const card = (await Promise.all(fields.map(f => countTokens(data[f])))).reduce((a, b) => a + b, 0);
    if (type !== 'world') return { card };
    const perEntry = await Promise.all((data.entries || []).map(e => countTokens(e.content)));
    const lorebook = perEntry.reduce((a, b) => a + b, 0);
    const constant = (data.entries || []).reduce((sum, e, i) => sum + (e.constant ? perEntry[i] : 0), 0);
    return { card, lorebook, constant, perEntry };
}

export function tokenSummaryHtml(type, t) {
    const fmt = n => Number(n || 0).toLocaleString();
    if (type !== 'world') return `<i class="fa-solid fa-coins"></i> Card: <b>${fmt(t.card)}</b> tokens`;
    return `<i class="fa-solid fa-coins"></i> Card: <b>${fmt(t.card)}</b> · Lorebook: <b>${fmt(t.lorebook)}</b> · Always-on: <b>${fmt(t.constant)}</b> tokens`;
}

export function scoreClass(score) {
    if (!score) return 'none';
    return score >= 8 ? 'good' : score >= 6 ? 'ok' : 'bad';
}

export function reviewHtml(review) {
    if (!review) return '';
    const esc = api.escapeHtml;
    const bars = Object.entries(review.scores).map(([name, value]) => `
        <div class="stcg-bar stcg-score-${scoreClass(value)}">
            <span class="stcg-bar-name">${esc(name)}</span>
            <div class="stcg-bar-track"><div class="stcg-bar-fill" style="width:${value * 10}%"></div></div>
            <b>${value}</b>
        </div>`).join('');
    const issues = review.issues.map((i, n) => `
        <li class="${i.skip ? 'stcg-issue-skipped' : ''}">
            <label class="stcg-issue">
                <input type="checkbox" class="stcg-issue-check" data-issue="${n}" ${i.skip ? '' : 'checked'} title="Untick to leave this one alone when you click Fix issues">
                <span><b>${esc(i.entry !== null ? `entry ${i.entry} · ${i.field}` : i.field)}</b>: ${esc(i.problem)}
                ${i.fix ? `<span class="stcg-issue-fix">→ ${esc(i.fix)}</span>` : ''}</span>
            </label>
        </li>`).join('');
    const previous = review.previous ? ` <small>(was ${review.previous})</small>` : '';
    return `
        <div class="stcg-score-head stcg-score-${scoreClass(review.overall)}">Score <b>${review.overall}</b>/10${previous}</div>
        ${review.summary ? `<div class="stcg-review-summary">${esc(review.summary)}</div>` : ''}
        <div class="stcg-bars">${bars}</div>
        ${issues ? `<ol class="stcg-issues">${issues}</ol>` : '<div class="stcg-review-summary">No issues listed.</div>'}`;
}

/** Ticking or unticking an issue marks it for (or keeps it out of) the next Fix. */
export function wireIssueChecks($root, getReview, onChange = () => { }) {
    $root.on('change', '.stcg-issue-check', e => {
        const issue = getReview()?.issues?.[Number($(e.currentTarget).data('issue'))];
        if (!issue) return;
        issue.skip = !$(e.currentTarget).prop('checked');
        $(e.currentTarget).closest('li').toggleClass('stcg-issue-skipped', issue.skip);
        onChange();
    });
}

/** Fix needs a ticked issue or some instructions. */
export function canFix(review, steer) {
    return !!(review?.issues?.some(i => !i.skip) || String(steer || '').trim());
}

export const QUALITY_PANEL_HTML = `
    <div class="stcg-quality">
        <label class="stcg-steer-label" title="Sent with Fix issues, Enhance, Optimize and the per-field buttons. With no ticked issues, Fix applies just these instructions.">Your instructions (optional)</label>
        <textarea class="text_pole stcg-steer" rows="2" placeholder="e.g. keep her shy, no tragic backstory, make the bakery a tea shop"></textarea>
        <div class="stcg-quality-buttons">
            <div class="menu_button stcg-q-review" title="Score the card against the rubric and list issues"><i class="fa-solid fa-clipboard-check"></i> Review</div>
            <div class="menu_button stcg-q-fix" title="Patch the card to fix the ticked issues, following your instructions"><i class="fa-solid fa-screwdriver-wrench"></i> Fix issues</div>
            <div class="menu_button stcg-q-enhance" title="Expand the whole card with richer, specific detail"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> Enhance</div>
            <div class="menu_button stcg-q-optimize" title="Trim the whole card to fewer tokens, keeping what matters"><i class="fa-solid fa-scissors"></i> Optimize</div>
            <div class="menu_button stcg-q-undo" title="Undo the last AI change"><i class="fa-solid fa-rotate-left"></i> Undo</div>
        </div>
        <div class="stcg-tokens"></div>
        <div class="stcg-review"></div>
    </div>`;

export function fieldOpsHtml(attrs) {
    return `
        <span class="stcg-field-tokens" ${attrs}></span>
        <div class="menu_button stcg-field-op" data-op="enhance" ${attrs} title="Enhance this field"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>
        <div class="menu_button stcg-field-op" data-op="optimize" ${attrs} title="Optimize this field"><i class="fa-solid fa-scissors"></i></div>`;
}
