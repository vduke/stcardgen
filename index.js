import { getRequestHeaders, saveSettingsDebounced, getCharacters } from '../../../../script.js';
import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { ConnectionManagerRequestService } from '../../shared.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../popup.js';
import { power_user } from '../../../power-user.js';
import { initPersona, getUserAvatars } from '../../../personas.js';

const MODULE = 'stcardgen';
const TEMPLATE_PATH = `third-party/${MODULE}`;
const CURRENT_CONNECTION = '';
const DEFAULT_PERSONA_AVATAR = 'img/user-default.png';

const DEFAULT_PERSONA_PROMPT = `You are an expert writer of user personas for SillyTavern roleplay. A persona is the character the USER plays, so it must work as a self-insert that other characters react to.

Study the attached image carefully: apparent age, build, face, hair, eyes, skin, clothing, accessories, posture, expression, setting, art style and mood. Infer a believable personality, background and mannerisms that fit what you see. If the user supplied details, they override anything inferred from the image.

Rules:
- Third person, present tense. Refer to the persona by name or as {{user}}.
- 150-350 words. Cover appearance, personality, background, and notable quirks or habits.
- Do not write dialogue, and never describe or speak for {{char}}.
- Pick an original, fitting name.`;

const DEFAULT_PERSONA_FORMAT = `Respond ONLY with one JSON object and nothing else (no commentary, no markdown outside the JSON). Use exactly these keys:
{
  "name": "the persona's name",
  "title": "a short tagline, a few words",
  "description": "the full persona description; use \\n for line breaks"
}`;

const DEFAULT_CHARACTER_PROMPT = `You are an expert character card writer for SillyTavern roleplay. You turn a reference image (and optional notes) into a complete, high-quality character card.

Study the attached image carefully: apparent age, build, face, hair, eyes, skin, clothing, accessories, posture, expression, setting, art style and mood. Build a believable, distinctive character around it. If the user supplied details, they override anything inferred from the image.

Rules:
- Use {{char}} for the character and {{user}} for the user inside card text.
- description: detailed appearance, background, relationships, and anything the model needs to portray {{char}} (250-600 words).
- personality: a concise summary of traits.
- scenario: the starting situation between {{char}} and {{user}}.
- first_mes: an engaging opening message written as {{char}}, in roleplay prose with actions in *asterisks*. Never act or speak for {{user}}.
- mes_example: 2-3 short example exchanges, each starting with <START>, using {{user}}: and {{char}}: prefixes.
- alternate_greetings: 1-2 alternative opening messages.
- tags: 3-8 short genre/trait tags.
- Pick an original, fitting name.`;

const DEFAULT_CHARACTER_FORMAT = `Respond ONLY with one JSON object and nothing else (no commentary, no markdown outside the JSON). Use exactly these keys (strings unless noted; use \\n for line breaks):
{
  "name": "",
  "description": "",
  "personality": "",
  "scenario": "",
  "first_mes": "",
  "mes_example": "",
  "alternate_greetings": ["array of strings"],
  "creator_notes": "",
  "system_prompt": "",
  "post_history_instructions": "",
  "tags": ["array of strings"]
}`;

const LEGACY_BAN_PROMPT = 'These names are already taken. Do NOT use any of them, or close variants of them, for the new {{type}}: {{bannedNames}}';
const DEFAULT_BAN_PROMPT = 'These names are already taken or overused. Do NOT use any of them, or close variants of them, as a first name OR a surname for the new {{type}}: {{bannedNames}}';

// Names LLMs reach for over and over. First names and surnames are matched word by word.
const DEFAULT_TROPE_NAMES = `Elara, Lyra, Seraphina, Aria, Aurora, Luna, Kael, Kaelen, Kaelan, Zara, Zephyr, Elias, Elian, Elowen, Lirael, Lysandra, Isolde, Nyx, Selene, Evelyn, Evangeline, Ember, Willow, Sable, Raven, Rowan, Orion, Silas, Jaxon, Ryker, Damien, Lucian, Caspian, Cassian, Thalia, Anya, Mira, Nova, Liora, Astrid, Seren, Eldrin, Theron, Alaric, Vesper, Juniper, Talia, Elena, Lena, Sarah, Marcus, Aiden, Nyla, Kira, Aelin, Cyrus, Dorian, Ezra, Finn
Thorne, Vance, Miller, Blackwood, Ashford, Ashworth, Sterling, Nightshade, Moonwhisper, Silverleaf, Shadowend, Voss, Hawthorne, Reyes, Chen, Holloway, Graves, Cross, Steele, Hart, Wolfe, Blackthorne, Stone, Frost, Winters, Crane, Valentine, Sinclair, Montgomery, Rivers, Kane, Drake, Ravenwood, Whitlock, Harrow, Vale, Nightingale, Mercer, Calloway, Rourke, Locke`;

function splitNames(text) {
    return String(text || '').split(/[\n,]/).map(x => x.trim()).filter(Boolean);
}

const defaultSettings = Object.freeze({
    profileId: CURRENT_CONNECTION,
    maxTokens: 4096,
    imageMaxSide: 1536,
    concurrency: 1,
    personaPrompt: DEFAULT_PERSONA_PROMPT,
    personaFormat: DEFAULT_PERSONA_FORMAT,
    characterPrompt: DEFAULT_CHARACTER_PROMPT,
    characterFormat: DEFAULT_CHARACTER_FORMAT,
    bannedNames: '',
    banExistingPersonas: true,
    banExistingCharacters: true,
    banDraftNames: true,
    banPrompt: DEFAULT_BAN_PROMPT,
    banTropeNames: true,
    tropeNames: DEFAULT_TROPE_NAMES,
    importSwapMacros: true,
    importAppendPersonality: false,
    drafts: [],
});

const PERSONA_FIELDS = [
    { key: 'name', label: 'Name', rows: 1 },
    { key: 'title', label: 'Title (display only)', rows: 1 },
    { key: 'description', label: 'Description', rows: 16 },
];

const CHARACTER_FIELDS = [
    { key: 'name', label: 'Name', rows: 1 },
    { key: 'description', label: 'Description', rows: 10 },
    { key: 'personality', label: 'Personality', rows: 3 },
    { key: 'scenario', label: 'Scenario', rows: 3 },
    { key: 'first_mes', label: 'First message', rows: 8 },
    { key: 'alternate_greetings', label: 'Alternate greetings (separate with a line containing only ---)', rows: 6, list: true },
    { key: 'mes_example', label: 'Example messages', rows: 6 },
    { key: 'tags', label: 'Tags (comma-separated)', rows: 1, tags: true },
    { key: 'creator_notes', label: "Creator's notes", rows: 2 },
    { key: 'system_prompt', label: 'System prompt override', rows: 2 },
    { key: 'post_history_instructions', label: 'Post-history instructions', rows: 2 },
];

const GREETING_SEPARATOR = '\n---\n';

/** @type {Set<() => void>} */
const draftListeners = new Set();
let queueRunning = false;
let queueStopRequested = false;
/** @type {Map<string, AbortController>} */
const activeRequests = new Map();

function settings() {
    return extension_settings[MODULE];
}

function loadSettings() {
    extension_settings[MODULE] = extension_settings[MODULE] || {};
    const s = extension_settings[MODULE];
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (s[key] === undefined) {
            s[key] = structuredClone(value);
        }
    }
    if (s.banPrompt === LEGACY_BAN_PROMPT) s.banPrompt = DEFAULT_BAN_PROMPT;
    // Drafts that were mid-generation when the page closed go back to the queue.
    for (const draft of s.drafts) {
        if (draft.status === 'generating') draft.status = 'queued';
    }
}

function typeLabel(type) {
    return type === 'persona' ? 'Persona' : 'Character';
}

function uid() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

function getDrafts() {
    return settings().drafts;
}

function getDraft(id) {
    return getDrafts().find(d => d.id === id);
}

function notifyDrafts() {
    saveSettingsDebounced();
    updateDraftCount();
    for (const listener of draftListeners) {
        try { listener(); } catch (e) { console.error(`[${MODULE}]`, e); }
    }
}

function updateDraftCount() {
    const drafts = getDrafts();
    const ready = drafts.filter(d => d.status === 'ready').length;
    $('.stcg-draft-count').text(drafts.length ? `(${ready}/${drafts.length})` : '');
}

function upsertDraft(draft) {
    draft.updatedAt = Date.now();
    const drafts = getDrafts();
    const index = drafts.findIndex(d => d.id === draft.id);
    if (index === -1) drafts.unshift(draft); else drafts[index] = draft;
    notifyDrafts();
    return draft;
}

async function deleteDraft(id, { keepImage = false } = {}) {
    const drafts = getDrafts();
    const index = drafts.findIndex(d => d.id === id);
    if (index === -1) return;
    const [draft] = drafts.splice(index, 1);
    activeRequests.get(id)?.abort();
    if (draft.image && !keepImage) {
        await deleteStoredFile(draft.image);
    }
    notifyDrafts();
}

// ---------------------------------------------------------------------------
// Files & images
// ---------------------------------------------------------------------------

function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function readAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(/** @type {ArrayBuffer} */(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
}

function extensionForMime(mime) {
    return ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/png': 'png' })[mime] || 'png';
}

/** Uploads a blob into the user's files folder. Returns the relative path (e.g. "user/files/x.png"). */
async function storeFile(blob, baseName) {
    const dataUrl = await readAsDataUrl(blob);
    const name = `${MODULE}_${baseName}.${extensionForMime(blob.type)}`;
    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name, data: dataUrl.split(',')[1] }),
    });
    if (!response.ok) throw new Error(`Failed to store image: ${await response.text()}`);
    const { path } = await response.json();
    return path;
}

async function deleteStoredFile(path) {
    try {
        await fetch('/api/files/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ path }),
        });
    } catch (e) {
        console.warn(`[${MODULE}] Could not delete ${path}`, e);
    }
}

function fileUrl(path) {
    return path ? `/${String(path).replace(/^\/+/, '')}` : '';
}

async function fetchBlob(path) {
    const response = await fetch(fileUrl(path), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load image ${path}`);
    return await response.blob();
}

/** Downscales an image to a JPEG data URL suitable for a vision request. */
async function imageToPromptDataUrl(blob) {
    const maxSide = Math.max(256, Number(settings().imageMaxSide) || 1536);
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.9);
}

function pickFiles({ accept = 'image/*', multiple = false } = {}) {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.addEventListener('change', () => resolve(Array.from(input.files || [])));
        input.click();
    });
}

// ---------------------------------------------------------------------------
// Character card parsing (for card -> persona import)
// ---------------------------------------------------------------------------

function decodeBase64Utf8(b64) {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

/** Reads the embedded card JSON from a PNG's tEXt chunks (ccv3 preferred, then chara). */
function readPngCard(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((b, i) => bytes[i] === b)) throw new Error('Not a PNG file');

    const chunks = {};
    const latin1 = new TextDecoder('latin1');
    let offset = 8;
    while (offset < bytes.length) {
        const length = view.getUint32(offset);
        const type = latin1.decode(bytes.subarray(offset + 4, offset + 8));
        if (type === 'tEXt') {
            const data = bytes.subarray(offset + 8, offset + 8 + length);
            const nul = data.indexOf(0);
            const keyword = latin1.decode(data.subarray(0, nul)).toLowerCase();
            chunks[keyword] = latin1.decode(data.subarray(nul + 1));
        }
        if (type === 'IEND') break;
        offset += 12 + length;
    }

    const text = chunks.ccv3 || chunks.chara;
    if (!text) throw new Error('No character data found in this PNG');
    return JSON.parse(decodeBase64Utf8(text));
}

async function readCardFile(file) {
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
    const raw = isJson ? JSON.parse(await file.text()) : readPngCard(await readAsArrayBuffer(file));
    const card = raw?.data && typeof raw.data === 'object' ? { ...raw, ...raw.data } : raw;
    if (!card?.name) throw new Error('Card has no name');
    return { card, image: isJson ? null : file };
}

function cardToPersona(card) {
    const s = settings();
    let description = String(card.description || '');
    if (s.importAppendPersonality && card.personality) {
        description = `${description.trim()}\n\nPersonality: ${String(card.personality).trim()}`;
    }
    if (s.importSwapMacros) {
        description = description
            .replace(/{{char}}/gi, '\u0000CHAR\u0000')
            .replace(/{{user}}/gi, '{{char}}')
            .replace(/\u0000CHAR\u0000/g, '{{user}}');
    }
    return {
        name: String(card.name || '').trim(),
        title: '',
        description: description.trim(),
    };
}

// ---------------------------------------------------------------------------
// Banned names
// ---------------------------------------------------------------------------

function getBannedNames({ excludeDraftId = null } = {}) {
    const s = settings();
    const names = splitNames(s.bannedNames);
    if (s.banTropeNames) names.push(...splitNames(s.tropeNames));
    if (s.banExistingPersonas) names.push(...Object.values(power_user.personas || {}));
    if (s.banExistingCharacters) names.push(...SillyTavern.getContext().characters.map(c => c?.name));
    if (s.banDraftNames) names.push(...getDrafts().filter(d => d.id !== excludeDraftId).map(d => d.data?.name));

    const seen = new Set();
    const result = [];
    for (const raw of names) {
        const name = String(raw ?? '').trim();
        const key = name.toLowerCase();
        if (!name || name === '[Unnamed Persona]' || seen.has(key)) continue;
        seen.add(key);
        result.push(name);
    }
    return result;
}

/** Returns where a name is already used, or null. */
function findNameConflict(name, { excludeDraftId = null } = {}) {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    if (Object.values(power_user.personas || {}).some(n => String(n).trim().toLowerCase() === key)) return 'an existing persona';
    if (SillyTavern.getContext().characters.some(c => String(c?.name).trim().toLowerCase() === key)) return 'an existing character';
    if (getDrafts().some(d => d.id !== excludeDraftId && String(d.data?.name || '').trim().toLowerCase() === key)) return 'another draft';
    const manual = splitNames(settings().bannedNames).map(x => x.toLowerCase());
    if (manual.includes(key)) return 'your banned names list';
    return null;
}

/** Returns the words of a name that are on the overused-names list (a soft warning, never blocks). */
function findOverusedParts(name) {
    const s = settings();
    if (!s.banTropeNames) return [];
    const tropes = new Set(splitNames(s.tropeNames).map(x => x.toLowerCase()));
    return String(name || '').split(/[\s\-']+/).filter(word => word && tropes.has(word.toLowerCase()));
}

function nameWarningHtml(name, conflict) {
    const parts = [];
    if (conflict) parts.push(`"${escapeHtml(name)}" is already used by ${conflict}.`);
    const overused = findOverusedParts(name);
    if (overused.length) parts.push(`Overused name: ${escapeHtml(overused.join(', '))}.`);
    return parts.map(p => `<div><i class="fa-solid fa-triangle-exclamation"></i> ${p}</div>`).join('');
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function buildMessages(type, imageDataUrl, details, bannedNames) {
    const s = settings();
    const prompt = type === 'persona' ? s.personaPrompt : s.characterPrompt;
    const format = type === 'persona' ? s.personaFormat : s.characterFormat;
    let system = `${prompt.trim()}\n\n${format.trim()}`;
    if (bannedNames.length && s.banPrompt) {
        system += '\n\n' + s.banPrompt
            .replace(/{{bannedNames}}/g, bannedNames.join(', '))
            .replace(/{{type}}/g, type);
    }

    const parts = [];
    parts.push(imageDataUrl
        ? `Create a new ${type} based on the attached image.`
        : `Create a new ${type} based on the following details.`);
    if (details?.trim()) {
        parts.push(`Details from the user (these take priority):\n${details.trim()}`);
    }
    parts.push('Reply with the JSON object only.');
    const text = parts.join('\n\n');

    const content = imageDataUrl
        ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: imageDataUrl } }]
        : text;

    return [
        { role: 'system', content: system },
        { role: 'user', content },
    ];
}

async function sendMessages(messages, signal) {
    const s = settings();
    const context = SillyTavern.getContext();
    const maxTokens = Number(s.maxTokens) || 4096;

    if (s.profileId) {
        try {
            return await ConnectionManagerRequestService.sendRequest(s.profileId, messages, maxTokens, {
                stream: false,
                signal,
                extractData: true,
                includePreset: true,
            });
        } catch (error) {
            throw error?.cause ?? error;
        }
    }

    if (context.mainApi !== 'openai') {
        throw new Error('Current connection is not Chat Completion. Switch to a Chat Completion API or pick a connection profile in Card Generator settings.');
    }

    const oai = context.chatCompletionSettings;
    return await context.ChatCompletionService.processRequest({
        stream: false,
        messages,
        max_tokens: maxTokens,
        model: context.getChatCompletionModel(),
        chat_completion_source: oai.chat_completion_source,
        custom_url: oai.custom_url,
        reverse_proxy: oai.reverse_proxy,
        proxy_password: oai.proxy_password,
    }, { presetName: oai.preset_settings_openai }, true, signal);
}

function stripReasoning(text) {
    return String(text ?? '')
        .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '')
        .replace(/^[\s\S]*?<\/(think|thinking|reasoning)>/i, '')
        .trim();
}

function parseJsonLoose(text) {
    const cleaned = stripReasoning(text);
    const candidates = [];
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) candidates.push(fence[1]);
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) candidates.push(cleaned.slice(start, end + 1));
    candidates.push(cleaned);

    for (const candidate of candidates) {
        for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')]) {
            try {
                const value = JSON.parse(attempt);
                if (value && typeof value === 'object' && !Array.isArray(value)) return value;
            } catch { /* try next */ }
        }
    }
    throw new Error('The model response was not valid JSON. Check the raw output, fix it, and use "Parse raw".');
}

function toStringList(value) {
    if (Array.isArray(value)) return value.map(v => String(v ?? '').trim()).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
}

function normalizeData(type, obj) {
    const str = v => (v === undefined || v === null) ? '' : (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    if (type === 'persona') {
        return {
            name: str(obj.name).trim(),
            title: str(obj.title).trim(),
            description: str(obj.description ?? obj.persona ?? obj.persona_description).trim(),
        };
    }
    const tags = toStringList(obj.tags).flatMap(tag => tag.split(','));
    return {
        name: str(obj.name).trim(),
        description: str(obj.description).trim(),
        personality: str(obj.personality).trim(),
        scenario: str(obj.scenario).trim(),
        first_mes: str(obj.first_mes ?? obj.first_message ?? obj.greeting).trim(),
        mes_example: str(obj.mes_example ?? obj.example_messages).trim(),
        alternate_greetings: toStringList(obj.alternate_greetings),
        creator_notes: str(obj.creator_notes).trim(),
        system_prompt: str(obj.system_prompt).trim(),
        post_history_instructions: str(obj.post_history_instructions).trim(),
        tags: toStringList(tags),
    };
}

function emptyData(type) {
    return normalizeData(type, {});
}

/**
 * Runs one generation.
 * @returns {Promise<{data: object, raw: string}>}
 */
async function generateEntry({ type, imageBlob, details, excludeDraftId = null, signal = null }) {
    const imageDataUrl = imageBlob ? await imageToPromptDataUrl(imageBlob) : null;
    if (!imageDataUrl && !details?.trim()) {
        throw new Error('Add an image or some details to generate from.');
    }
    const messages = buildMessages(type, imageDataUrl, details, getBannedNames({ excludeDraftId }));
    const result = await sendMessages(messages, signal);
    const raw = String(result?.content ?? '');
    if (!raw.trim()) throw new Error('The model returned an empty response.');
    const data = normalizeData(type, parseJsonLoose(raw));
    return { data, raw: stripReasoning(raw) };
}

// ---------------------------------------------------------------------------
// Saving into SillyTavern
// ---------------------------------------------------------------------------

function safeFileStem(name) {
    return String(name).replace(/[^a-zA-Z0-9]/g, '') || 'persona';
}

async function createPersonaInST(data, imageBlob) {
    const name = data.name.trim();
    const avatarId = `${Date.now()}-${safeFileStem(name)}.png`;
    const blob = imageBlob || await (await fetch(DEFAULT_PERSONA_AVATAR)).blob();

    const formData = new FormData();
    formData.append('avatar', new File([blob], 'avatar.png', { type: blob.type || 'image/png' }));
    formData.append('overwrite_name', avatarId);
    const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        cache: 'no-cache',
        body: formData,
    });
    if (!response.ok) throw new Error(`Failed to upload persona avatar: ${response.statusText}`);
    const { path } = await response.json();
    const finalId = path || avatarId;

    await initPersona(finalId, name, data.description || '', data.title || '');
    await getUserAvatars(true, finalId);
    return finalId;
}

async function createCharacterInST(data, imageBlob) {
    const formData = new FormData();
    formData.append('ch_name', data.name.trim());
    formData.append('description', data.description || '');
    formData.append('personality', data.personality || '');
    formData.append('scenario', data.scenario || '');
    formData.append('first_mes', data.first_mes || '');
    formData.append('mes_example', data.mes_example || '');
    formData.append('creator_notes', data.creator_notes || '');
    formData.append('system_prompt', data.system_prompt || '');
    formData.append('post_history_instructions', data.post_history_instructions || '');
    formData.append('tags', (data.tags || []).join(', '));
    formData.append('creator', '');
    formData.append('character_version', '');
    formData.append('talkativeness', '0.5');
    formData.append('fav', 'false');
    formData.append('world', '');
    formData.append('depth_prompt_prompt', '');
    formData.append('depth_prompt_depth', '4');
    formData.append('depth_prompt_role', 'system');
    for (const greeting of data.alternate_greetings || []) {
        formData.append('alternate_greetings', greeting);
    }
    if (imageBlob) {
        formData.append('avatar', new File([imageBlob], `avatar.${extensionForMime(imageBlob.type)}`, { type: imageBlob.type || 'image/png' }));
    }

    const response = await fetch('/api/characters/create', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        cache: 'no-cache',
        body: formData,
    });
    if (!response.ok) throw new Error(`Failed to create character: ${response.statusText}`);
    const avatar = await response.text();
    await getCharacters();
    return avatar;
}

async function saveToST(type, data, imageBlob) {
    if (!data.name?.trim()) throw new Error('A name is required.');
    if (type === 'persona') return await createPersonaInST(data, imageBlob);
    return await createCharacterInST(data, imageBlob);
}

// ---------------------------------------------------------------------------
// Editor popup (single create + draft review)
// ---------------------------------------------------------------------------

function fieldsFor(type) {
    return type === 'persona' ? PERSONA_FIELDS : CHARACTER_FIELDS;
}

function renderFieldValue(field, value) {
    if (field.list) return (value || []).join(GREETING_SEPARATOR);
    if (field.tags) return (value || []).join(', ');
    return value ?? '';
}

function readFieldValue(field, text) {
    if (field.list) return text.split(/\n\s*---\s*\n/).map(x => x.trim()).filter(Boolean);
    if (field.tags) return text.split(',').map(x => x.trim()).filter(Boolean);
    return text;
}

/**
 * Opens the editor. Either for a fresh generation or to review an existing draft.
 * @param {object} options
 * @param {'persona'|'character'} options.type
 * @param {object} [options.draft] Existing draft to review
 * @param {object} [options.data] Prefilled data
 * @param {Blob} [options.imageBlob] Prefilled image
 * @param {boolean} [options.autoGenerate] Start generating immediately
 */
async function openEditor({ type, draft = null, data = null, imageBlob = null, autoGenerate = false }) {
    const state = {
        type: draft?.type ?? type,
        data: structuredClone(draft?.data ?? data ?? emptyData(type)),
        raw: draft?.raw ?? '',
        details: draft?.details ?? '',
        imageBlob,
        imageUrl: '',
        busy: false,
        abort: null,
    };
    if (!state.imageBlob && draft?.image) {
        try { state.imageBlob = await fetchBlob(draft.image); } catch (e) { console.warn(e); }
    }

    const fields = fieldsFor(state.type);
    const root = document.createElement('div');
    root.classList.add('stcg-editor');
    root.innerHTML = `
        <h3 class="stcg-editor-title">${draft ? 'Review draft' : 'Create'} ${typeLabel(state.type)}</h3>
        <div class="stcg-editor-body">
            <div class="stcg-editor-side">
                <div class="stcg-dropzone" title="Click or drop an image">
                    <img class="stcg-preview-img" alt="">
                    <div class="stcg-dropzone-hint"><i class="fa-solid fa-image fa-2x"></i><div>Click or drop an image</div></div>
                </div>
                <div class="stcg-side-buttons">
                    <div class="menu_button stcg-change-img"><i class="fa-solid fa-upload"></i> Image</div>
                    <div class="menu_button stcg-clear-img"><i class="fa-solid fa-xmark"></i> Remove</div>
                </div>
                <label>Optional details / requirements</label>
                <textarea class="text_pole stcg-details" rows="5" placeholder="e.g. She's a 28 year old starship mechanic, sarcastic, from Mars..."></textarea>
                <div class="menu_button stcg-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generate</span></div>
                <div class="stcg-status"></div>
                <div class="stcg-conflict"></div>
            </div>
            <div class="stcg-editor-fields">
                ${fields.map(f => `
                    <div class="stcg-field-group">
                        <label class="stcg-field-label" for="stcg_f_${f.key}">${escapeHtml(f.label)}</label>
                        ${f.rows === 1
                            ? `<input id="stcg_f_${f.key}" data-key="${f.key}" class="text_pole stcg-field" type="text">`
                            : `<textarea id="stcg_f_${f.key}" data-key="${f.key}" class="text_pole stcg-field" rows="${f.rows}" style="min-height: calc(${f.rows} * 1.5em + 12px)"></textarea>`}
                    </div>
                `).join('')}
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
    const $conflict = $root.find('.stcg-conflict');
    const $generate = $root.find('.stcg-generate');

    function setImage(blob) {
        if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
        state.imageBlob = blob || null;
        state.imageUrl = blob ? URL.createObjectURL(blob) : '';
        $img.attr('src', state.imageUrl).toggle(!!blob);
        $root.find('.stcg-dropzone').toggleClass('has-image', !!blob);
    }

    function writeFields() {
        for (const f of fields) {
            $root.find(`[data-key="${f.key}"]`).val(renderFieldValue(f, state.data[f.key]));
        }
        $root.find('.stcg-raw-text').val(state.raw);
        checkConflict();
    }

    function readFields() {
        for (const f of fields) {
            state.data[f.key] = readFieldValue(f, String($root.find(`[data-key="${f.key}"]`).val() ?? ''));
        }
        state.details = String($root.find('.stcg-details').val() ?? '');
        state.raw = String($root.find('.stcg-raw-text').val() ?? '');
    }

    function checkConflict() {
        const name = String($root.find('[data-key="name"]').val() ?? '');
        const conflict = findNameConflict(name, { excludeDraftId: draft?.id });
        $conflict.html(nameWarningHtml(name, conflict));
    }

    function setBusy(busy, message = '') {
        state.busy = busy;
        $generate.toggleClass('stcg-busy', busy).find('span').text(busy ? 'Stop' : 'Generate');
        $generate.find('i').attr('class', busy ? 'fa-solid fa-stop' : 'fa-solid fa-wand-magic-sparkles');
        $status.text(message);
    }

    async function runGeneration() {
        if (state.busy) {
            state.abort?.abort();
            return;
        }
        readFields();
        state.abort = new AbortController();
        setBusy(true, 'Generating… this can take a minute.');
        try {
            const result = await generateEntry({
                type: state.type,
                imageBlob: state.imageBlob,
                details: state.details,
                excludeDraftId: draft?.id,
                signal: state.abort.signal,
            });
            state.data = result.data;
            state.raw = result.raw;
            writeFields();
            setBusy(false, 'Done. Review and edit before saving.');
        } catch (error) {
            console.error(`[${MODULE}]`, error);
            setBusy(false, '');
            if (error?.name === 'AbortError' || state.abort.signal.aborted) {
                $status.text('Stopped.');
            } else {
                $status.text(`Error: ${error?.message || error}`);
                toastr.error(String(error?.message || error), 'Card Generator');
            }
        }
    }

    $root.find('.stcg-details').val(state.details);
    setImage(state.imageBlob);
    writeFields();

    const pickImage = async () => {
        const [file] = await pickFiles();
        if (file) setImage(file);
    };
    $root.find('.stcg-dropzone, .stcg-change-img').on('click', pickImage);
    $root.find('.stcg-clear-img').on('click', () => setImage(null));
    // Drops anywhere in the editor set the image. Propagation must stop, or ST's body-level
    // drop handler also imports the file as a character.
    const $dropzone = $root.find('.stcg-dropzone');
    $root
        .on('dragover', e => { e.preventDefault(); e.stopPropagation(); $dropzone.addClass('dragover'); })
        .on('dragleave', () => $dropzone.removeClass('dragover'))
        .on('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            $dropzone.removeClass('dragover');
            const file = e.originalEvent?.dataTransfer?.files?.[0];
            if (file?.type.startsWith('image/')) setImage(file);
        });
    $root.find('[data-key="name"]').on('input', checkConflict);
    $generate.on('click', runGeneration);
    $root.find('.stcg-parse-raw').on('click', () => {
        readFields();
        try {
            state.data = normalizeData(state.type, parseJsonLoose(state.raw));
            writeFields();
            $status.text('Parsed raw output.');
        } catch (error) {
            toastr.error(String(error.message), 'Card Generator');
        }
    });

    const SAVE_DRAFT = POPUP_RESULT.CUSTOM1;
    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: `Create ${typeLabel(state.type)}`,
        cancelButton: 'Close',
        customButtons: [{ text: draft ? 'Update Draft' : 'Save to Drafts', result: SAVE_DRAFT, classes: ['stcg-save-draft'] }],
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
        onOpen: () => { if (autoGenerate) runGeneration(); },
        onClosing: async (p) => {
            readFields();
            if (p.result === POPUP_RESULT.AFFIRMATIVE) {
                if (state.busy) { toastr.warning('Wait for generation to finish.'); return false; }
                if (!state.data.name?.trim()) { toastr.warning('Give it a name first.'); return false; }
                const conflict = findNameConflict(state.data.name, { excludeDraftId: draft?.id });
                if (conflict) {
                    const ok = await Popup.show.confirm('Name already in use', `"${escapeHtml(state.data.name)}" is already used by ${conflict}. Create anyway?`);
                    if (!ok) return false;
                }
                try {
                    await saveToST(state.type, state.data, state.imageBlob);
                    toastr.success(`${typeLabel(state.type)} "${state.data.name}" created.`, 'Card Generator');
                    if (draft) await deleteDraft(draft.id);
                } catch (error) {
                    console.error(`[${MODULE}]`, error);
                    toastr.error(String(error?.message || error), 'Card Generator');
                    return false;
                }
            } else if (p.result === SAVE_DRAFT) {
                if (state.busy) { toastr.warning('Wait for generation to finish.'); return false; }
                try {
                    await saveEditorDraft(state, draft);
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

async function saveEditorDraft(state, existing) {
    const draft = existing ? getDraft(existing.id) ?? existing : {
        id: uid(),
        type: state.type,
        createdAt: Date.now(),
        image: null,
    };

    // Re-store the image if it changed (or the draft is new).
    const previousImage = draft.image;
    let imageChanged = !existing;
    if (existing && previousImage) {
        try {
            const old = await fetchBlob(previousImage);
            imageChanged = !state.imageBlob || old.size !== state.imageBlob.size;
        } catch { imageChanged = true; }
    } else if (existing && !previousImage) {
        imageChanged = !!state.imageBlob;
    }
    if (imageChanged) {
        draft.image = state.imageBlob ? await storeFile(state.imageBlob, `${draft.id}_${Date.now()}`) : null;
        if (previousImage) await deleteStoredFile(previousImage);
    }

    draft.data = structuredClone(state.data);
    draft.raw = state.raw;
    draft.details = state.details;
    draft.error = '';
    draft.status = state.data.name?.trim() ? 'ready' : (draft.image || state.details ? 'queued' : 'ready');
    upsertDraft(draft);
}

// ---------------------------------------------------------------------------
// Bulk queue
// ---------------------------------------------------------------------------

async function processDraft(draft) {
    const controller = new AbortController();
    activeRequests.set(draft.id, controller);
    draft.status = 'generating';
    draft.error = '';
    upsertDraft(draft);
    try {
        const imageBlob = draft.image ? await fetchBlob(draft.image) : null;
        const result = await generateEntry({
            type: draft.type,
            imageBlob,
            details: draft.details,
            excludeDraftId: draft.id,
            signal: controller.signal,
        });
        if (!getDraft(draft.id)) return; // deleted meanwhile
        draft.data = result.data;
        draft.raw = result.raw;
        draft.status = 'ready';
    } catch (error) {
        if (!getDraft(draft.id)) return;
        console.error(`[${MODULE}] Draft ${draft.id} failed`, error);
        draft.status = controller.signal.aborted ? 'queued' : 'error';
        draft.error = controller.signal.aborted ? '' : String(error?.message || error);
    } finally {
        activeRequests.delete(draft.id);
    }
    upsertDraft(draft);
}

async function runQueue() {
    if (queueRunning) return;
    queueRunning = true;
    queueStopRequested = false;
    notifyDrafts();
    let processed = 0;
    try {
        const workers = Math.min(4, Math.max(1, Number(settings().concurrency) || 1));
        // Drafts are stored newest-first; process oldest-first.
        const next = () => getDrafts().findLast(d => d.status === 'queued');
        const worker = async () => {
            while (!queueStopRequested) {
                const draft = next();
                if (!draft) return;
                await processDraft(draft);
                processed++;
            }
        };
        await Promise.all(Array.from({ length: workers }, worker));
    } finally {
        queueRunning = false;
        notifyDrafts();
    }
    if (processed) {
        const failed = getDrafts().filter(d => d.status === 'error').length;
        toastr.info(`Bulk generation ${queueStopRequested ? 'stopped' : 'finished'}. ${failed ? `${failed} failed.` : ''}`, 'Card Generator');
    }
}

function stopQueue() {
    queueStopRequested = true;
    for (const controller of activeRequests.values()) controller.abort();
}

async function openBulk() {
    /** @type {{file: File, details: string, url: string}[]} */
    let items = [];
    const root = document.createElement('div');
    root.classList.add('stcg-bulk');
    root.innerHTML = `
        <h3>Bulk Create</h3>
        <div class="stcg-row">
            <label>Type
                <select class="text_pole stcg-bulk-type">
                    <option value="persona">Personas</option>
                    <option value="character">Characters</option>
                </select>
            </label>
            <div class="menu_button stcg-bulk-add"><i class="fa-solid fa-images"></i> Add images</div>
            <div class="menu_button stcg-bulk-clear"><i class="fa-solid fa-trash"></i> Clear</div>
        </div>
        <label>Shared details (applied to every image, optional)</label>
        <textarea class="text_pole stcg-bulk-shared" rows="3" placeholder="e.g. All of them live in a cyberpunk city in 2140."></textarea>
        <label class="checkbox_label"><input type="checkbox" class="stcg-bulk-filename"> Use each file name as a hint</label>
        <div class="stcg-bulk-list"></div>
        <small class="notes">Everything is generated in the background and lands in Drafts for review. You can close this window once started.</small>`;

    const $root = $(root);
    const $list = $root.find('.stcg-bulk-list');

    function render() {
        $list.empty();
        if (!items.length) {
            $list.append('<div class="stcg-empty">No images yet. Click "Add images" or drop them here.</div>');
            return;
        }
        items.forEach((item, index) => {
            const $row = $(`
                <div class="stcg-bulk-item">
                    <img src="${item.url}" alt="">
                    <div class="stcg-bulk-item-body">
                        <div class="stcg-bulk-item-name">${escapeHtml(item.file.name)}</div>
                        <textarea class="text_pole" rows="2" placeholder="Details for this one (optional)"></textarea>
                    </div>
                    <div class="menu_button fa-solid fa-xmark" title="Remove"></div>
                </div>`);
            $row.find('textarea').val(item.details).on('input', e => { item.details = String($(e.target).val()); });
            $row.find('.fa-xmark').on('click', () => {
                URL.revokeObjectURL(item.url);
                items.splice(index, 1);
                render();
            });
            $list.append($row);
        });
    }

    function addFiles(files) {
        for (const file of files.filter(f => f.type.startsWith('image/'))) {
            items.push({ file, details: '', url: URL.createObjectURL(file) });
        }
        render();
    }

    $root.find('.stcg-bulk-add').on('click', async () => addFiles(await pickFiles({ multiple: true })));
    $root.find('.stcg-bulk-clear').on('click', () => { items.forEach(i => URL.revokeObjectURL(i.url)); items = []; render(); });
    $root.on('dragover', e => { e.preventDefault(); e.stopPropagation(); }).on('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        addFiles(Array.from(e.originalEvent?.dataTransfer?.files || []));
    });
    render();

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Start',
        cancelButton: 'Cancel',
        wide: true,
        allowVerticalScrolling: true,
        leftAlign: true,
        onClosing: async (p) => {
            if (p.result !== POPUP_RESULT.AFFIRMATIVE) return true;
            if (!items.length) { toastr.warning('Add at least one image.'); return false; }
            const type = String($root.find('.stcg-bulk-type').val());
            const shared = String($root.find('.stcg-bulk-shared').val() || '').trim();
            const useFileName = $root.find('.stcg-bulk-filename').prop('checked');
            toastr.info(`Queuing ${items.length} ${type}(s)…`, 'Card Generator');
            for (const item of items) {
                const id = uid();
                const details = [
                    shared,
                    item.details.trim(),
                    useFileName ? `Image file name (may hint at the subject): ${item.file.name.replace(/\.[^.]+$/, '')}` : '',
                ].filter(Boolean).join('\n');
                try {
                    const image = await storeFile(item.file, id);
                    upsertDraft({ id, type, status: 'queued', image, details, data: emptyData(type), raw: '', error: '', createdAt: Date.now() });
                } catch (error) {
                    toastr.error(`${item.file.name}: ${error.message}`, 'Card Generator');
                }
            }
            return true;
        },
        onClose: () => items.forEach(i => URL.revokeObjectURL(i.url)),
    });

    const result = await popup.show();
    if (result === POPUP_RESULT.AFFIRMATIVE) {
        runQueue();
        openDrafts();
    }
}

// ---------------------------------------------------------------------------
// Drafts panel
// ---------------------------------------------------------------------------

const STATUS_LABELS = {
    queued: 'Queued',
    generating: 'Generating…',
    ready: 'Ready',
    error: 'Error',
};

async function openDrafts() {
    const selected = new Set();
    let filter = 'all';
    const root = document.createElement('div');
    root.classList.add('stcg-drafts');
    root.innerHTML = `
        <h3>Drafts</h3>
        <div class="stcg-drafts-toolbar">
            <select class="text_pole stcg-drafts-filter">
                <option value="all">All</option>
                <option value="persona">Personas</option>
                <option value="character">Characters</option>
                <option value="ready">Ready</option>
                <option value="pending">Queued / Generating</option>
                <option value="error">Errors</option>
            </select>
            <label class="checkbox_label"><input type="checkbox" class="stcg-select-all"> Select all</label>
            <div class="menu_button stcg-approve-selected" title="Create every selected Ready draft without reviewing"><i class="fa-solid fa-check-double"></i> Approve selected</div>
            <div class="menu_button stcg-retry-selected" title="Re-queue selected drafts for generation"><i class="fa-solid fa-rotate"></i> Regenerate selected</div>
            <div class="menu_button stcg-delete-selected"><i class="fa-solid fa-trash"></i> Delete selected</div>
            <div class="menu_button stcg-queue-toggle"></div>
        </div>
        <div class="stcg-drafts-summary"></div>
        <div class="stcg-drafts-grid"></div>`;

    const $root = $(root);
    const $grid = $root.find('.stcg-drafts-grid');

    function visibleDrafts() {
        return getDrafts().filter(d => {
            switch (filter) {
                case 'persona':
                case 'character': return d.type === filter;
                case 'ready': return d.status === 'ready';
                case 'pending': return d.status === 'queued' || d.status === 'generating';
                case 'error': return d.status === 'error';
                default: return true;
            }
        });
    }

    function render() {
        const drafts = getDrafts();
        for (const id of [...selected]) if (!getDraft(id)) selected.delete(id);
        const counts = drafts.reduce((acc, d) => (acc[d.status] = (acc[d.status] || 0) + 1, acc), {});
        $root.find('.stcg-drafts-summary').text(
            `${drafts.length} drafts — ${counts.ready || 0} ready, ${(counts.queued || 0) + (counts.generating || 0)} pending, ${counts.error || 0} errors`);
        const pending = (counts.queued || 0) + (counts.generating || 0);
        $root.find('.stcg-queue-toggle')
            .html(queueRunning ? '<i class="fa-solid fa-stop"></i> Stop queue' : '<i class="fa-solid fa-play"></i> Run queue')
            .toggleClass('disabled', !queueRunning && !pending);

        $grid.empty();
        const list = visibleDrafts();
        if (!list.length) {
            $grid.append('<div class="stcg-empty">No drafts here.</div>');
        }
        for (const draft of list) {
            const conflict = draft.data?.name ? findNameConflict(draft.data.name, { excludeDraftId: draft.id }) : null;
            const overused = findOverusedParts(draft.data?.name);
            const preview = draft.type === 'persona' ? draft.data?.description : (draft.data?.personality || draft.data?.description);
            const $card = $(`
                <div class="stcg-draft stcg-status-${draft.status}">
                    <label class="stcg-draft-check"><input type="checkbox"></label>
                    <div class="stcg-draft-img">${draft.image ? `<img src="${fileUrl(draft.image)}" alt="" loading="lazy">` : '<i class="fa-solid fa-user fa-2x"></i>'}</div>
                    <div class="stcg-draft-body">
                        <div class="stcg-draft-head">
                            <span class="stcg-badge stcg-badge-${draft.type}">${typeLabel(draft.type)}</span>
                            <span class="stcg-badge stcg-badge-status">${STATUS_LABELS[draft.status] || draft.status}</span>
                            ${conflict ? `<span class="stcg-badge stcg-badge-conflict" title="Name used by ${escapeHtml(conflict)}">Name conflict</span>` : ''}
                            ${overused.length ? `<span class="stcg-badge stcg-badge-overused" title="On the overused names list">Overused: ${escapeHtml(overused.join(', '))}</span>` : ''}
                        </div>
                        <div class="stcg-draft-name">${escapeHtml(draft.data?.name || '(unnamed)')}</div>
                        <div class="stcg-draft-preview">${escapeHtml(draft.status === 'error' ? draft.error : (preview || draft.details || '')).slice(0, 220)}</div>
                        <div class="stcg-draft-buttons">
                            <div class="menu_button stcg-d-review" title="Review & edit"><i class="fa-solid fa-pen-to-square"></i> Review</div>
                            <div class="menu_button stcg-d-approve" title="Create without review"><i class="fa-solid fa-check"></i></div>
                            <div class="menu_button stcg-d-retry" title="Regenerate"><i class="fa-solid fa-rotate"></i></div>
                            <div class="menu_button stcg-d-delete" title="Delete draft"><i class="fa-solid fa-trash"></i></div>
                        </div>
                    </div>
                </div>`);
            const busy = draft.status === 'generating';
            $card.find('input[type=checkbox]').prop('checked', selected.has(draft.id)).on('change', e => {
                if ($(e.target).prop('checked')) selected.add(draft.id); else selected.delete(draft.id);
            });
            $card.find('.stcg-d-review').toggleClass('disabled', busy).on('click', () => !busy && openEditor({ type: draft.type, draft }));
            $card.find('.stcg-d-approve').toggleClass('disabled', draft.status !== 'ready').on('click', () => approveDrafts([draft.id]));
            $card.find('.stcg-d-retry').toggleClass('disabled', busy).on('click', () => requeue([draft.id]));
            $card.find('.stcg-d-delete').on('click', async () => {
                if (await Popup.show.confirm('Delete draft?', escapeHtml(draft.data?.name || 'This draft'))) await deleteDraft(draft.id);
            });
            $grid.append($card);
        }
    }

    function requeue(ids) {
        for (const id of ids) {
            const draft = getDraft(id);
            if (!draft || draft.status === 'generating') continue;
            if (!draft.image && !draft.details?.trim()) continue;
            draft.status = 'queued';
            draft.error = '';
            upsertDraft(draft);
        }
        runQueue();
    }

    $root.find('.stcg-drafts-filter').on('change', e => { filter = String($(e.target).val()); render(); });
    $root.find('.stcg-select-all').on('change', e => {
        const checked = $(e.target).prop('checked');
        selected.clear();
        if (checked) visibleDrafts().forEach(d => selected.add(d.id));
        render();
    });
    $root.find('.stcg-approve-selected').on('click', () => approveDrafts([...selected]));
    $root.find('.stcg-retry-selected').on('click', () => requeue([...selected]));
    $root.find('.stcg-delete-selected').on('click', async () => {
        if (!selected.size) return;
        if (!await Popup.show.confirm(`Delete ${selected.size} draft(s)?`, 'Their stored images are removed too.')) return;
        for (const id of [...selected]) await deleteDraft(id);
        selected.clear();
    });
    $root.find('.stcg-queue-toggle').on('click', () => queueRunning ? stopQueue() : runQueue());

    draftListeners.add(render);
    render();

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Close',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
        onClose: () => draftListeners.delete(render),
    });
    await popup.show();
}

async function approveDrafts(ids) {
    let created = 0;
    const skipped = [];
    for (const id of ids) {
        const draft = getDraft(id);
        if (!draft || draft.status !== 'ready') continue;
        if (!draft.data?.name?.trim()) { skipped.push('(unnamed)'); continue; }
        const conflict = findNameConflict(draft.data.name, { excludeDraftId: draft.id });
        if (conflict) { skipped.push(`${draft.data.name} (used by ${conflict})`); continue; }
        try {
            const imageBlob = draft.image ? await fetchBlob(draft.image) : null;
            await saveToST(draft.type, draft.data, imageBlob);
            await deleteDraft(draft.id);
            created++;
        } catch (error) {
            console.error(`[${MODULE}]`, error);
            skipped.push(`${draft.data.name} (${error.message})`);
        }
    }
    if (created) toastr.success(`Created ${created} from drafts.`, 'Card Generator');
    if (skipped.length) toastr.warning(`Skipped: ${skipped.join(', ')}. Review them individually.`, 'Card Generator', { timeOut: 10000 });
}

// ---------------------------------------------------------------------------
// Card -> Persona import
// ---------------------------------------------------------------------------

async function importCardsAsPersonas() {
    const files = await pickFiles({ accept: '.png,.json,image/png,application/json', multiple: true });
    if (!files.length) return;

    if (files.length === 1) {
        try {
            const { card, image } = await readCardFile(files[0]);
            await openEditor({ type: 'persona', data: cardToPersona(card), imageBlob: image });
        } catch (error) {
            toastr.error(`${files[0].name}: ${error.message}`, 'Card Generator');
        }
        return;
    }

    let imported = 0;
    for (const file of files) {
        try {
            const { card, image } = await readCardFile(file);
            const id = uid();
            const stored = image ? await storeFile(image, id) : null;
            upsertDraft({ id, type: 'persona', status: 'ready', image: stored, details: '', data: cardToPersona(card), raw: '', error: '', createdAt: Date.now() });
            imported++;
        } catch (error) {
            toastr.error(`${file.name}: ${error.message}`, 'Card Generator');
        }
    }
    if (imported) {
        toastr.success(`Imported ${imported} card(s) into Drafts as personas.`, 'Card Generator');
        openDrafts();
    }
}

// ---------------------------------------------------------------------------
// Settings UI
// ---------------------------------------------------------------------------

function populateProfiles() {
    const $select = $('#stcg_profile');
    const s = settings();
    $select.empty().append(new Option('(Current connection)', CURRENT_CONNECTION));
    try {
        for (const profile of ConnectionManagerRequestService.getSupportedProfiles()) {
            if (profile.mode !== 'cc') continue;
            $select.append(new Option(profile.name, profile.id));
        }
    } catch (e) {
        console.debug(`[${MODULE}] Connection Manager unavailable`, e);
    }
    if (s.profileId && !$select.find(`option[value="${s.profileId}"]`).length) {
        $select.append(new Option('(missing profile)', s.profileId));
    }
    $select.val(s.profileId);
}

function bindSetting(selector, key, { type = 'text' } = {}) {
    const $el = $(selector);
    const s = settings();
    if (type === 'checkbox') {
        $el.prop('checked', !!s[key]).on('change', () => { s[key] = $el.prop('checked'); saveSettingsDebounced(); });
    } else if (type === 'number') {
        $el.val(s[key]).on('input', () => { s[key] = Number($el.val()); saveSettingsDebounced(); });
    } else {
        $el.val(s[key]).on('input', () => { s[key] = String($el.val()); saveSettingsDebounced(); });
    }
}

function refreshSettingsUI() {
    const s = settings();
    $('#stcg_persona_prompt').val(s.personaPrompt);
    $('#stcg_persona_format').val(s.personaFormat);
    $('#stcg_character_prompt').val(s.characterPrompt);
    $('#stcg_character_format').val(s.characterFormat);
    $('#stcg_ban_prompt').val(s.banPrompt);
}

async function initSettingsUI() {
    const html = await renderExtensionTemplateAsync(TEMPLATE_PATH, 'settings');
    $('#extensions_settings2').append(html);

    populateProfiles();
    $('#stcg_profile').on('focus', populateProfiles).on('change', function () {
        settings().profileId = String($(this).val());
        saveSettingsDebounced();
    });
    bindSetting('#stcg_max_tokens', 'maxTokens', { type: 'number' });
    bindSetting('#stcg_image_max', 'imageMaxSide', { type: 'number' });
    bindSetting('#stcg_concurrency', 'concurrency', { type: 'number' });
    bindSetting('#stcg_persona_prompt', 'personaPrompt');
    bindSetting('#stcg_persona_format', 'personaFormat');
    bindSetting('#stcg_character_prompt', 'characterPrompt');
    bindSetting('#stcg_character_format', 'characterFormat');
    bindSetting('#stcg_banned', 'bannedNames');
    bindSetting('#stcg_ban_personas', 'banExistingPersonas', { type: 'checkbox' });
    bindSetting('#stcg_ban_characters', 'banExistingCharacters', { type: 'checkbox' });
    bindSetting('#stcg_ban_drafts', 'banDraftNames', { type: 'checkbox' });
    bindSetting('#stcg_ban_prompt', 'banPrompt');
    bindSetting('#stcg_ban_tropes', 'banTropeNames', { type: 'checkbox' });
    bindSetting('#stcg_trope_names', 'tropeNames');
    $('#stcg_btn_reset_tropes').on('click', async () => {
        if (!await Popup.show.confirm('Restore overused names?', 'Your edits to the overused names list will be replaced with the default list.')) return;
        settings().tropeNames = DEFAULT_TROPE_NAMES;
        $('#stcg_trope_names').val(DEFAULT_TROPE_NAMES);
        saveSettingsDebounced();
    });
    bindSetting('#stcg_import_swap', 'importSwapMacros', { type: 'checkbox' });
    bindSetting('#stcg_import_personality', 'importAppendPersonality', { type: 'checkbox' });

    $('#stcg_btn_create_persona').on('click', () => openEditor({ type: 'persona' }));
    $('#stcg_btn_create_character').on('click', () => openEditor({ type: 'character' }));
    $('#stcg_btn_bulk').on('click', openBulk);
    $('#stcg_btn_drafts').on('click', openDrafts);
    $('#stcg_btn_import').on('click', importCardsAsPersonas);
    $('#stcg_btn_preview_bans').on('click', () => {
        const names = getBannedNames();
        Popup.show.text(`Banned names (${names.length})`, names.length ? escapeHtml(names.join(', ')) : 'None');
    });
    $('#stcg_btn_reset').on('click', async () => {
        if (!await Popup.show.confirm('Reset prompts?', 'Generation prompts, output formats and the ban instruction go back to defaults.')) return;
        const s = settings();
        s.personaPrompt = DEFAULT_PERSONA_PROMPT;
        s.personaFormat = DEFAULT_PERSONA_FORMAT;
        s.characterPrompt = DEFAULT_CHARACTER_PROMPT;
        s.characterFormat = DEFAULT_CHARACTER_FORMAT;
        s.banPrompt = DEFAULT_BAN_PROMPT;
        refreshSettingsUI();
        saveSettingsDebounced();
    });
}

function addWandMenu() {
    const $menu = $(`
        <div id="stcg_wand_container" class="extension_container">
            <div id="stcg_wand_persona" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem">
                <div class="fa-solid fa-user-plus extensionsMenuExtensionButton"></div><span>Create Persona</span>
            </div>
            <div id="stcg_wand_character" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem">
                <div class="fa-solid fa-id-card extensionsMenuExtensionButton"></div><span>Create Character</span>
            </div>
            <div id="stcg_wand_drafts" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem">
                <div class="fa-solid fa-inbox extensionsMenuExtensionButton"></div><span>Card Drafts <span class="stcg-draft-count"></span></span>
            </div>
        </div>`);
    $('#extensionsMenu').append($menu);
    $('#stcg_wand_persona').on('click', () => openEditor({ type: 'persona' }));
    $('#stcg_wand_character').on('click', () => openEditor({ type: 'character' }));
    $('#stcg_wand_drafts').on('click', openDrafts);
}

jQuery(async () => {
    loadSettings();
    await initSettingsUI();
    addWandMenu();
    updateDraftCount();
    if (getDrafts().some(d => d.status === 'queued')) {
        toastr.info('You have queued drafts. Open Card Drafts and press "Run queue" to continue.', 'Card Generator');
    }
});
