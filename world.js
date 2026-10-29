import { saveWorldInfo, updateWorldInfoList, world_names, createWorldInfoEntry, getFreeWorldName, world_info_logic, world_info_position } from '../../../world-info.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../popup.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';
import { debounce } from '../../../utils.js';
import { reviewCard, reviseCard, reviseField, renameNames, renameCard, qualityPass, countTokens, tokenSummary, tokenSummaryHtml, reviewHtml, QUALITY_PANEL_HTML, RENAME_CARD_HTML, fieldOpsHtml, wireIssueChecks, canFix } from './quality.js';
import { startTask, guardClosing } from './tasks.js';

// [old line, new line] pairs applied to saved prompts on load; see PROMPT_LINE_MIGRATIONS in index.js.
export const WORLD_PROMPT_LINE_MIGRATIONS = [
    [
        '- first_mes: an immersive opening scene addressed to {{user}} in second person, ending on an open situation. Never act or speak for {{user}}.',
        `- first_mes: an immersive opening scene addressed to {{user}} in second person. Never act or speak for {{user}}. End on a concrete beat (an NPC speaking or acting, or something happening) that {{user}} can react to. Never end with a question to the player such as "What do you do?", "What's your next move?" or "Where do you go from here?".
- alternate_greetings: 1-2 alternative opening scenes set at different places or moments in {{user}}'s life, following the same rules as first_mes.`,
    ],
    // No Main Prompt override on cards; narrator example messages instead.
    [
        '- system_prompt: short narrator instructions (optional).',
        '- mes_example: 2-3 short example exchanges, each starting with <START> and using {{user}}: and {{char}}: prefixes, where {{char}} narrates and voices different NPCs so their distinct speech styles show.',
    ],
    [
        '- NPC entries: full name, age, role, relationship to {{user}}, appearance, personality, speech style, current goal.',
        '- NPC entries: full name, age, role, relationship to {{user}}, appearance, personality, speech style, current goal. For important NPCs (family, close friends, love interests, rivals, bosses, crew), end the content with "Example dialogue:" followed by 2-3 short lines in their own voice, showing how they talk to {{user}}. These lines may push the entry past 180 words.',
    ],
    // The world must not pander to the persona. Saved prompts get the new preamble if the old opening line is intact.
    [
        'Build the world around who {{user}} is. Work out what their life needs and fill it in:',
        `Build a world that would exist whether or not {{user}} had ever been born, then place {{user}} inside it. Do NOT build a world out of the persona's traits, kinks or psychology.

The persona's inner life is not the setting. Their personality, fears, cravings and kinks shape how they experience the world, not what the world contains. If {{user}} is hungry for attention, that does not mean every NPC dotes on them; it means they notice who does not. If {{user}} is a hedonist, the world is not a buffet; it is ordinary and they are greedy in it. A sweet, passive, obedient persona does not need a kind world. A prickly persona does not need a hostile one.

Rules for a non-pandering world:
- People have their own lives, goals, loyalties and problems that have nothing to do with {{user}}. Most of them are busy with something else.
- Institutions are indifferent or self-interested. Schools, jobs, families and authorities have their own rules and pressures, and they do not reorganise themselves around one person.
- The world is not a paradise made for {{user}}, and not a grim dystopia either. It is ordinary, mixed, and mostly indifferent: some warmth, some friction, some luck, some boredom.
- Do not make every NPC a mirror of {{user}}'s traits or a supplier of what {{user}} craves. At least some NPCs should be uninterested, incompatible or a little disappointing.
- Conflict comes from ordinary friction (money, time, obligation, other people's plans) more than from {{user}}'s psychology made manifest.

What the world does need to cover is {{user}}'s practical circumstances. Work out what their life needs and fill it in:`,
    ],
    // The setting is not a stage built for the persona.
    [
        '- description: setting overview, tone, and the narrator\'s role (voices all NPCs, describes the world, keeps continuity, lets {{user}} drive). 300-600 words.',
        '- description: setting overview, tone, and the narrator\'s role (voices all NPCs, describes the world, keeps continuity, lets {{user}} drive). The setting is an ordinary world with its own momentum, not a stage built for {{user}}: it does not flatter them, and it does not punish them. 300-600 words.',
    ],
];

export const WORLD_FORMAT_LINE_MIGRATIONS = [
    ['  "system_prompt": "",\n', '  "mes_example": "",\n'],
];

export const DEFAULT_WORLD_PROMPT = `You are a world-builder for SillyTavern roleplay. You turn a user persona into a living sandbox: a world/narrator character card plus a lorebook (World Info) that makes the setting feel real and reactive.

The persona is the character the USER plays. Refer to them as {{user}} everywhere. The sandbox card ({{char}}) is not one person: it is the narrator / game master who describes the world and voices every NPC.

Build a world that would exist whether or not {{user}} had ever been born, then place {{user}} inside it. Do NOT build a world out of the persona's traits, kinks or psychology.

The persona's inner life is not the setting. Their personality, fears, cravings and kinks shape how they experience the world, not what the world contains. If {{user}} is hungry for attention, that does not mean every NPC dotes on them; it means they notice who does not. If {{user}} is a hedonist, the world is not a buffet; it is ordinary and they are greedy in it. A sweet, passive, obedient persona does not need a kind world. A prickly persona does not need a hostile one.

Rules for a non-pandering world:
- People have their own lives, goals, loyalties and problems that have nothing to do with {{user}}. Most of them are busy with something else.
- Institutions are indifferent or self-interested. Schools, jobs, families and authorities have their own rules and pressures, and they do not reorganise themselves around one person.
- The world is not a paradise made for {{user}}, and not a grim dystopia either. It is ordinary, mixed, and mostly indifferent: some warmth, some friction, some luck, some boredom.
- Do not make every NPC a mirror of {{user}}'s traits or a supplier of what {{user}} craves. At least some NPCs should be uninterested, incompatible or a little disappointing.
- Conflict comes from ordinary friction (money, time, obligation, other people's plans) more than from {{user}}'s psychology made manifest.

What the world does need to cover is {{user}}'s practical circumstances. Work out what their life needs and fill it in:
- Home and family: where they live, parents/siblings/partner, household dynamics.
- Work or school: the institution, its culture, bosses/teachers/classmates/crew.
- Social circle: friends, rivals, love interests, enemies, each with their own goals.
- Places: hangouts, hot spots, the wider city/region/star system, and what happens there.
- Organizations: factions, alliances, companies, gangs, clubs, governments, and where {{user}} stands with them.
- Daily life: routines, hobbies, events, customs, slang, technology or magic rules.
- Hooks: tensions, secrets and upcoming events that can start stories.
Examples: a college student needs the campus, their dorm or apartment, parents, roommate, friend group, professors, a part-time job, parties and local spots. A starship captain needs the ship, the crew, the star system being traveled, political powers and alliances, rivals, ports of call and the current mission.

Sandbox card:
- description: setting overview, tone, and the narrator's role (voices all NPCs, describes the world, keeps continuity, lets {{user}} drive). The setting is an ordinary world with its own momentum, not a stage built for {{user}}: it does not flatter them, and it does not punish them. 300-600 words.
- scenario: where {{user}}'s story starts.
${WORLD_PROMPT_LINE_MIGRATIONS[0][1]}
${WORLD_PROMPT_LINE_MIGRATIONS[1][1]}
- tags: 3-8 genre/setting tags.

Lorebook entries:
- One topic per entry (one NPC, one place, one faction, one custom...). 50-180 words each, factual reference style, present tense. Refer to the persona as {{user}}. Each NPC's goal should make sense without {{user}} in the room; not every NPC needs to care about them.
${WORLD_PROMPT_LINE_MIGRATIONS[2][1]}
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
  "mes_example": "",
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
    { key: 'mes_example', label: 'Example messages (narrator voicing NPCs)', rows: 6 },
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

export function normalizeEntry(e = {}) {
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
        mes_example: str(obj.mes_example ?? obj.example_messages),
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

/** The user message: text, plus the world art itself or (with a vision profile) its description. */
function userContent(text, image) {
    if (image.description) {
        return `${text}\n\nThe user supplied reference art for the world; use it for mood, setting and visual details.\n${api.imageDescriptionText(image.description)}`;
    }
    if (!image.dataUrl) return text;
    return [{ type: 'text', text: `${text}\n\nThe attached image is reference art for the world; use it for mood, setting and visual details.` }, { type: 'image_url', image_url: { url: image.dataUrl } }];
}

async function request(messages, signal) {
    const result = await api.sendMessages(messages, signal, { maxTokens: api.settings().worldMaxTokens });
    const raw = String(result?.content ?? '');
    if (!raw.trim()) throw new Error('The model returned an empty response. Try raising "World max tokens".');
    return raw;
}

/**
 * Generates a full world (sandbox card + lorebook) for a persona.
 * @param {object} options
 * @param {string} [options.imageDescription] A vision description of the world art to reuse
 * @returns {Promise<{data: object, raw: string, imageDescription: string}>}
 */
export async function generateWorld({ source, imageBlob = null, details = '', excludeDraftId = null, imageDescription = '', signal = null, onStatus = () => { } }) {
    if (!source?.name) throw new Error('Pick a persona to build the world around.');
    const s = api.settings();
    const count = clampInt(s.worldEntryCount, 3, 80, 20);
    const image = await api.prepareImage(imageBlob, 'world', { description: imageDescription, signal, onStatus });
    if (image.description) onStatus('Building the world… big worlds can take a few minutes.');
    const text = [
        `Build a living sandbox world around this persona.\n\n${sourceBlock(source)}`,
        details?.trim() ? `World notes from the user (these take priority):\n${details.trim()}` : '',
        `Create around ${count} lorebook entries.`,
        BAN_REMINDER,
        'Reply with the JSON object only.',
    ].filter(Boolean).join('\n\n');

    const messages = [
        { role: 'system', content: buildSystem({ includeImagePrompt: !imageBlob && s.suggestImagePrompt, source, excludeDraftId }) },
        { role: 'user', content: userContent(text, image) },
    ];
    const raw = await request(messages, signal);
    const data = normalizeWorld(api.parseJsonLoose(raw));
    if (!data.entries.length) throw new Error('The model returned no lorebook entries. Check the raw output, or raise "World max tokens".');
    return { data, raw: api.stripReasoning(raw), imageDescription: image.description };
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

/** Names anywhere in the world (titles, card text, entry content) that use an overused or banned word. */
function overusedNames(world, source) {
    return api.findOverusedNames(world, [source?.name]);
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
        mes_example: world.mes_example,
        alternate_greetings: world.alternate_greetings,
        creator_notes: world.creator_notes,
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
    let input = f.rows === 1
        ? `<input id="stcg_w_${f.key}" data-card="${f.key}" class="text_pole" type="text">`
        : `<textarea id="stcg_w_${f.key}" data-card="${f.key}" class="text_pole" rows="${f.rows}" style="min-height: calc(${f.rows} * 1.5em + 12px)"></textarea>`;
    if (f.key === 'name') input = `<div class="stcg-name-row">${input}${RENAME_CARD_HTML}</div>`;
    return `
        <div class="stcg-field-group">
            <div class="stcg-field-head">
                <label class="stcg-field-label" for="stcg_w_${f.key}">${api.escapeHtml(f.label)}</label>
                ${f.imagePrompt ? `<div class="menu_button menu_button_icon stcg-copy" title="Copy to clipboard"><i class="fa-solid fa-copy"></i> Copy</div>` : ''}
                ${f.rows > 1 && !f.imagePrompt ? fieldOpsHtml(`data-target="${f.key}"`) : ''}
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
                    <div class="stcg-entry-ops">${fieldOpsHtml(`data-entry="${index}"`)}</div>
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
/**
 * @param {object} [options]
 * @param {object} [options.draft] World draft to review
 * @param {string} [options.personaId] Persona to build around (defaults to the current one)
 */
export async function openWorldBuilder({ draft = null, personaId = null } = {}) {
    const personas = listPersonas();
    const state = {
        source: draft?.source ?? (personaId ? personaSource(personaId) : null),
        data: structuredClone(draft?.data ?? emptyWorld()),
        raw: draft?.raw ?? '',
        details: draft?.details ?? '',
        steer: draft?.steer ?? '',
        imageDescription: draft?.imageDescription ?? '',
        imageBlob: null,
        imageUrl: '',
        imageChanged: false,
        busy: false,
        abort: null,
        review: draft?.review ?? null,
        history: [],
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
                ${api.visionDescriptionHtml}
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
                ${QUALITY_PANEL_HTML}
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
        $img.attr('src', state.imageUrl).toggle(!!blob);
        $root.find('.stcg-dropzone').toggleClass('has-image', !!blob);
        if (changed) {
            state.imageChanged = true;
            setImageDescription(''); // a new image needs a new description
        }
    }

    function setImageDescription(text) {
        state.imageDescription = text;
        $root.find('.stcg-image-description').val(text);
        $root.find('.stcg-vision').toggle(api.usesVisionProfile() || !!text);
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
        state.steer = String($root.find('.stcg-steer').val() ?? '');
        state.imageDescription = String($root.find('.stcg-image-description').val() ?? '');
    }

    function renderEntries({ openIndex = null } = {}) {
        $entries.html(state.data.entries.map(entryHtml).join('') || '<div class="stcg-empty">No entries yet. Generate a world or add entries by hand.</div>');
        $root.find('.stcg-w-entry-count').text(`(${state.data.entries.length})`);
        if (openIndex !== null) $entries.find(`.stcg-entry[data-index="${openIndex}"]`).prop('open', true);
        updateOverusedWarning();
    }

    function updateOverusedWarning() {
        const flagged = overusedNames(state.data, state.source);
        $rename.toggle(flagged.length > 0);
        $root.find('.stcg-w-overused').remove();
        if (flagged.length) {
            $root.find('.stcg-conflict').after(`<div class="stcg-conflict stcg-w-overused"><i class="fa-solid fa-triangle-exclamation"></i> Overused names in this world: ${api.escapeHtml(flagged.join(', '))}</div>`);
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
        $root.toggleClass('stcg-is-busy', busy);
        $generate.toggleClass('stcg-busy', busy).find('span').text(busy ? 'Stop' : 'Generate World');
        $generate.find('i').attr('class', busy ? 'fa-solid fa-stop' : 'fa-solid fa-wand-magic-sparkles');
        $more.toggleClass('disabled', busy);
        $rename.toggleClass('disabled', busy);
        $status.text(message);
    }

    const updateTokens = debounce(async () => {
        readCard();
        const t = await tokenSummary('world', state.data);
        $root.find('.stcg-tokens').html(tokenSummaryHtml('world', t));
        $root.find('.stcg-field-tokens[data-entry]').each((_, el) => {
            const n = t.perEntry[Number($(el).data('entry'))];
            $(el).text(n ? `${n} tok` : '');
        });
        for (const el of $root.find('.stcg-field-tokens[data-target]').toArray()) {
            const value = state.data[$(el).data('target')];
            const n = await countTokens(value);
            $(el).text(n ? `${n} tok` : '');
        }
    }, 400);

    function updateFixButton() {
        $root.find('.stcg-q-fix').toggleClass('disabled', !canFix(state.review, $root.find('.stcg-steer').val()));
    }

    function renderQuality() {
        $root.find('.stcg-review').html(reviewHtml(state.review));
        updateFixButton();
        $root.find('.stcg-q-undo').toggleClass('disabled', !state.history.length);
        updateTokens();
    }

    /** Snapshot taken before an AI change; committed to the undo stack only if the change succeeds. */
    function snapshot() {
        readCard();
        return { data: structuredClone(state.data), review: state.review };
    }

    function pushHistory(snap) {
        state.history.push(snap);
        if (state.history.length > 20) state.history.shift();
    }

    function undo() {
        const previous = state.history.pop();
        if (!previous) return;
        state.data = previous.data;
        state.review = previous.review;
        writeCard();
        renderEntries();
        renderQuality();
        $status.text('Undone.');
    }

    /** Runs one AI task with the shared busy/stop/error handling, shown in the task panel with a timer. */
    async function runAi(message, task) {
        if (state.busy) return;
        readCard();
        if (!state.source) { toastr.warning('Pick a persona first.'); return; }
        const controller = new AbortController();
        state.abort = controller;
        state.task = startTask(`World${state.data.name ? ` "${state.data.name}"` : ` for ${state.source.name}`}`, { detail: message, onStop: () => controller.abort() });
        setBusy(true, message);
        try {
            const done = await task(controller.signal);
            setBusy(false, done || 'Done.');
            state.task.finish(done || 'Done.');
        } catch (error) {
            console.error('[stcardgen]', error);
            const aborted = controller.signal.aborted;
            const text = aborted ? 'Stopped.' : `Error: ${error?.message || error}`;
            setBusy(false, text);
            state.task.finish(text, { error: !aborted });
            if (!aborted) toastr.error(String(error?.message || error), 'Card Generator');
        }
        renderQuality();
    }

    /** Status line in the builder and the task panel. */
    function status(text) {
        $status.text(text);
        state.task?.update({ detail: text });
    }

    const quality = signal => ({ type: 'world', details: state.details, source: state.source, steer: state.steer, signal });

    function refresh() {
        writeCard();
        renderEntries();
    }

    async function run(kind) {
        if (state.busy) {
            if (kind === 'world') state.abort?.abort();
            return;
        }
        if (kind === 'more' && !state.data.entries.length) { toastr.warning('Generate a world first.'); return; }
        const labels = {
            world: 'Building the world… big worlds can take a few minutes.',
            more: 'Adding entries…',
            rename: 'Finding new names…',
            review: 'Reviewing…',
            fix: 'Fixing issues…',
            enhance: 'Enhancing…',
            optimize: 'Optimizing…',
        };
        await runAi(labels[kind], async (signal) => {
            if (kind === 'review') {
                state.review = await reviewCard({ ...quality(signal), data: state.data });
                return `Score ${state.review.overall}/10.`;
            }
            const snap = snapshot();
            if (kind === 'rename') {
                const names = overusedNames(state.data, state.source);
                const result = await renameNames({ type: 'world', data: state.data, names, source: state.source, signal });
                pushHistory(snap);
                state.data = result.data;
                refresh();
                const unresolved = result.unresolved.length ? ` Could not find an allowed name for: ${result.unresolved.join(', ')}.` : '';
                return result.applied.length ? `Renamed: ${result.applied.join(', ')}.${unresolved}` : `No usable new names.${unresolved} Edit them by hand.`;
            }
            if (kind === 'fix' || kind === 'enhance' || kind === 'optimize') {
                const result = await reviseCard({ ...quality(signal), data: state.data, mode: kind, issues: state.review?.issues || [] });
                pushHistory(snap);
                state.data = result.data;
                refresh();
                if (kind === 'fix') {
                    status('Re-reviewing…');
                    const before = state.review;
                    const fixed = (before?.issues || []).filter(i => !i.skip);
                    state.review = { ...await reviewCard({ ...quality(signal), data: state.data, previousIssues: fixed }), previous: before?.overall };
                }
                return result.changed.length ? `Changed: ${result.changed.join(', ')}.` : 'The model made no changes.';
            }
            if (kind === 'world') {
                const result = await generateWorld({
                    source: state.source,
                    imageBlob: state.imageBlob,
                    details: state.details,
                    excludeDraftId: draft?.id,
                    imageDescription: state.imageDescription,
                    signal,
                    onStatus: status,
                });
                setImageDescription(result.imageDescription);
                if (snap.data.entries.length) pushHistory(snap);
                state.data = result.data;
                state.raw = result.raw;
                state.review = null;
                refresh();
                let score = '';
                if (s.autoReview) {
                    const checked = await qualityPass({ ...quality(signal), data: state.data, onStatus: status });
                    state.data = checked.data;
                    state.review = checked.review;
                    refresh();
                    score = ` Score ${checked.review.overall}/10${checked.review.previous ? ` (was ${checked.review.previous}, auto-fixed)` : ''}.`;
                }
                return `Done. ${state.data.entries.length} entries.${score} Review and edit before saving.`;
            }
            const result = await generateMoreEntries({
                source: state.source,
                world: state.data,
                details: state.details,
                count: clampInt(s.worldEntryCount, 3, 80, 20),
                excludeDraftId: draft?.id,
                signal,
            });
            pushHistory(snap);
            state.data.entries.push(...result.entries);
            state.raw = result.raw;
            $root.find('.stcg-raw-text').val(state.raw);
            renderEntries();
            return `Added ${result.entries.length} entries (${state.data.entries.length} total).`;
        });
    }

    function runRenameCard() {
        return runAi('Picking a new name…', async (signal) => {
            const snap = snapshot();
            const result = await renameCard({
                ...quality(signal), data: state.data,
                isTaken: name => !!api.findNameConflict(name, { excludeDraftId: draft?.id }),
            });
            pushHistory(snap);
            state.data = result.data;
            refresh();
            return `Renamed ${result.oldName} → ${result.newName} everywhere.`;
        });
    }

    function runFieldOp($button) {
        const mode = String($button.data('op'));
        const entryAttr = $button.attr('data-entry');
        const entryIndex = entryAttr === undefined ? null : Number(entryAttr);
        const field = entryIndex === null ? String($button.data('target')) : 'content';
        const label = entryIndex === null ? field : `entry "${state.data.entries[entryIndex]?.title}"`;
        return runAi(`${mode === 'enhance' ? 'Enhancing' : 'Optimizing'} ${label}…`, async (signal) => {
            const snap = snapshot();
            const value = await reviseField({ ...quality(signal), data: state.data, field, entryIndex, mode });
            pushHistory(snap);
            if (entryIndex === null) {
                state.data[field] = value;
                writeCard();
            } else {
                state.data.entries[entryIndex].content = value;
                renderEntries({ openIndex: entryIndex });
            }
            return `${label} ${mode === 'enhance' ? 'enhanced' : 'optimized'}.`;
        });
    }

    // Wiring
    $root.find('.stcg-details').val(state.details);
    $root.find('.stcg-steer').val(state.steer).on('input', updateFixButton);
    wireIssueChecks($root, () => state.review, updateFixButton);
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
    setImageDescription(state.imageDescription);
    writeCard();
    renderEntries();
    renderPersonaPreview();
    renderQuality();

    $root.find('.stcg-q-review').on('click', () => run('review'));
    $root.find('.stcg-q-fix').on('click', () => run('fix'));
    $root.find('.stcg-q-enhance').on('click', () => run('enhance'));
    $root.find('.stcg-q-optimize').on('click', () => run('optimize'));
    $root.find('.stcg-q-undo').on('click', undo);
    $root.find('.stcg-rename-card').on('click', runRenameCard);
    $root.on('click', '.stcg-field-op', e => runFieldOp($(e.currentTarget)));
    $root.on('input', '[data-card], [data-field="content"]', updateTokens);
    $root.on('input', '[data-card], [data-field="content"]', debounce(updateOverusedWarning, 600));
    $root.on('change', '[data-field="constant"]', updateTokens);

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
        updateTokens();
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
        onClosing: guardClosing(async (p) => {
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
                const task = startTask(`Creating world "${state.data.name.trim()}"`, { detail: 'Saving the lorebook and sandbox card…' });
                $status.text('Saving…');
                try {
                    await saveWorldToST(state.data, state.imageBlob);
                    if (draft) await api.deleteDraft(draft.id);
                    task.finish('Created.');
                } catch (error) {
                    console.error('[stcardgen]', error);
                    task.finish(`Error: ${error?.message || error}`, { error: true });
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
        }),
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
    draft.steer = state.steer;
    draft.imageDescription = state.imageDescription;
    draft.review = state.review;
    draft.error = '';
    draft.status = state.data.entries.length ? 'ready' : 'queued';
    api.upsertDraft(draft);
}
