import { saveWorldInfo, updateWorldInfoList, world_names, createWorldInfoEntry, getFreeWorldName, world_info_logic, world_info_position } from '../../../world-info.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../popup.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';
import { debounce } from '../../../utils.js';
import { reviewCard, reviseCard, reviseField, renameNames, renameCard, qualityPass, autoFixCard, autoFixTarget, autoFixRoundCap, countTokens, tokenSummary, tokenSummaryHtml, reviewHtml, QUALITY_PANEL_HTML, RENAME_CARD_HTML, fieldOpsHtml, wireIssueChecks, canFix } from './quality.js';
import { startTask, guardClosing } from './tasks.js';
import { rollPreRoll, formatPreRoll, parsePreRoll, THEME_OPTIONS, WORLD_THEMES, THEME_ANCHORS } from './preroll.js';

// [old line, new line] pairs applied to saved prompts on load; see PROMPT_LINE_MIGRATIONS in index.js.
export const WORLD_PROMPT_LINE_MIGRATIONS = [];

export const WORLD_FORMAT_LINE_MIGRATIONS = [
    ['  "system_prompt": "",\n', '  "mes_example": "",\n'],
];

// Shipped-prompt identity: a saved world prompt that still opens with this line and lacks the stamp is
// the shipped text, and gets replaced when the shape changes. Anything rewritten from line one is kept.
export const WORLD_PROMPT_STAMP = '### THE WORLD HAS ITS OWN LIFE (0.40.2)';
export const WORLD_PROMPT_HEADER = 'You are a world-builder for SillyTavern roleplay.';

export const DEFAULT_WORLD_PROMPT = `You are a world-builder for SillyTavern roleplay. You turn a user persona into a living sandbox: a world/narrator character card plus a lorebook (World Info) that makes the setting feel real and reactive.

### THE WORLD HAS ITS OWN LIFE (0.40.2)
The persona is the character the USER plays. Refer to them as {{user}} everywhere, including the description, scenario, first message and every entry — never use the persona's name in a card field. The sandbox card ({{char}}) is not one person: it is the narrator / game master who describes the world and voices every NPC.

### THE WORLD IS NOT BUILT AROUND THE PERSONA
The persona is played, not the setting: their card says how they experience the world, not what it contains. Build a place that exists without them, then put them in it.
- People have their own lives, goals and problems; most are busy with something else.
- Institutions are indifferent or self-interested and do not reorganise around one person.
- Some friction reaches {{user}} through people or obligations; most does not.
- Warmth and friction both exist. Not a genre poster.
{{user}} has routines, people who know her, things she is good and bad at; some are glad to see her, some are not. The world must not exist only to flatter her.

### NOBODY HAS READ THE PERSONA'S CARD
NPCs know only what they have seen, been told, heard or guessed. Kinks are private: at most one or two people know an anecdote, never a label. Reputation is local and narrow. When news travels, name the channel: who saw it, who told, how it bent.

### THE NARRATOR NEVER SPEAKS FOR {{user}}
The narrator is the room, the weather and the NPCs, not {{user}}'s inner voice.
- Describe what happens, what people do, what can be seen, heard and smelled. Never what {{user}} thinks, decides, remembers or feels.
- Do not assign motives to {{user}}. "She can tell he is lying" is allowed only if it is visible; "she does not trust him" is not.
- Never end a beat with a question to the player. End on something concrete they can react to.

### LEAVE ROOM TO REVEAL
The point of a sandbox is that the player finds out who their persona is by acting. Build places and people that offer choices, not verdicts.
- NPCs get opinions, questions, offers, mistakes and small demands that {{user}} can answer however they like.
- Some entries should be open-ended: a conversation that could go several ways, a problem nobody has solved, a person with an unstated reason to be interested. Not every entry needs a hook.
- Never pre-answer what {{user}} will do about anything.

### DO NOT REUSE THE LAST WORLD'S BONES
Each world should be carried by different things. Vary what the premise asks of her, where the scene lives, what the pressure is made of (a person, time, weather, a rule, a want) and what holds the place together (institutions, families, cliques, one street).
Do not assume every world has an industry closing, a civic threat, a festival, a water tower, a parish, a lake, a quirky local, or a list of three pressures. The same town twice is the failure.

### THEME IS PRESSURE, NOT COSTUME
The pre-rolled WORLD THEME is a condition, not a packing list. Its THEME ANCHORS are three conditions to adapt or replace, not props to quote: use at least two. Make at least one theme condition visible in the first paragraph and in one pressure, and invent the rest from the place. It should colour the world, not label it, and is almost never named as a genre.
- Build with its props, not its adjectives. "Neon noir" is wet signs, a bar with no sign, a cop who answers to somebody; "dystopian austerity" is permits, a queue, a speaker on a pole, an office nobody can find.
- A theme with teeth sets scarcity: what is scarce, rationed, traded. A fun theme can simply be a place people enjoy; not every theme needs a shortage. Pressure is not a crisis, and the opening can be pleasant.
- Theme colours prose but not everyone's mood. A gothic town still has somebody funny in it; a sunny one still has a bully.
- A theme with no consequence at all is set dressing. Some theme should change how people live — work, money, weather, rules, who has power — without every scene being about it.

### INVENT THE PRESSURE AND THE OPENING
The block does not hand you either. Build them.
- Derive pressure from what the theme makes scarce, seasonal or about to end: the last week of the season, the road closed, the one good thing being sold, a friend leaving.
- Give one or two pressures, ordinary and mixed: social, personal, family, time, weather, other people being difficult. One pressure is enough if it is good; each one needs somebody who gains from it and somebody who loses.
- The opening is the specific live moment this place and season produce, not a generic event. Vary its shape between worlds: mid-conversation, an arrival, a task going wrong, a discovery, a ritual, a favour called in. It can be fun, and it does not have to be trouble.

### GIVE {{user}} A REASON TO BE HERE
A sandbox needs an entry point, not just a backdrop. Decide why {{user}} is in this place and has a stake in it: newly arrived, inherited something, enrolled, hired, returned after years away, visiting for the season, stepping into a role somebody left.
- Write the premise in one sentence early in the description and use it in the scenario.
- A premise gives access and obligations: school brings classes and a register, a return brings history and people who remember, a job brings shifts and a boss only when there is one.
- It is not their personality and not a plot. It is the reason the world has business with them. Favour the scale of {{user}}'s age: a party, a shift, a bus, a favour, not the town master plan.
- Let the theme pick the premise. Party town is social access: who invited her, what she is bringing, how she gets in. Festival week is the fair and the committee. A resignation letter or civic obligation is not the default Party town premise. Party town is not Festival week: no parade, no fairground, no bunting, no Ferris wheel unless something else put them there.
- No chosen-one framing. Ordinary stakes: family, a favour, a place at a table, a promise.
- Children and teenagers are at school. A job is a detail, not a requirement, for them or for many adults: if the details say no job, do not invent employment. Babysitting is a gig on a Saturday, not a career.

### REALISM — THE WORLD HAS WEIGHT
Play happens in the ordinary parts of life.
- Work and routine: shifts, terms, travel, who is busy, what fills a Tuesday.
- Institutions: named people with interests, paperwork, favouritism, a shortcut somebody knows.
- Maintenance: things leak, rust, run out, get repaired badly. Weather and noise are part of the place.
- Time passes; the world moves without {{user}} present.

### NSFW AND NSFL
- NSFW is heat: tension, promiscuity, bodies, flirting, reputation, sex on the page. Not every entry is a scene.
- NSFL is harm and risk: a predator, a mobster, drugs or drink going wrong, roofies, an overdose, injury, death, force.
- Neither means grim. With NSFL on: at least two harm markers, one in the description with a named person {{user}} knows. With NSFL off: lighter, ask first.
- NSFW on: every NPC carries Body, Genitals, Sexuality and Kinks. NSFW off: a single plain build clause. NSFL on: consent is negotiable (CNC, free use, held down) and NPCs may act before asking; off: ask first.

### CONSEQUENCES
No plot armour. Bad choices compound and good work pays; preparation changes the odds; failure leaves a mark; opportunities expire. Consequences are proportional and often small. Not every scene is a test.

### WORLD RULES LINE
A "WORLD RULES" line, when supplied, sets registers explicitly: NSFW, NSFL and real consequences are each on or off. Obey it. When it is absent, treat all three as on.

### TONE — MIXED, NOT BLEAK
- Default to mixed. For each hardship put something warm, funny, beautiful or lucky in the same world: a food pantry and a good chip shop, a drowning and a ballfield at dusk.
- Not every NPC is indifferent. Some are kind, some nosy, some want something, some are busy. Warmth exists before it is earned.
- Bleak is a register, not the default. A dystopian world can still have a good pie.
- Every world needs a pleasure: somewhere people go to enjoy themselves and at least one genuinely good thing about living there. If the theme does not supply one, invent it.
- Not every world is a town with a problem. Some are simply a good place to be for a while; the trouble can arrive later.
- Good things should come from what people do, not as prizes handed to {{user}}.

### CREATIVE LIBERTY
The rolls are a floor, not a map. Invent past them.
- Use at most one explicit nod to the persona's skills or tastes, in an entry rather than a thesis.
- Vary what leads: a place, a person or an event. Vary the opening: someone talking, a task going wrong, an arrival.
- Leave room for one funny or strange detail that need not be justified.
- If a theme prop does not fit the place, cut it.
- Names and geography are free unless the details name them; details beat TEXTURE.
- PLACE serves theme and notes. If PLACE and SCALE disagree on size, the place's size wins and the scale is the surrounding region.

### WHAT THE WORLD HAS TO COVER
Only what {{user}}'s life actually needs. Not every category below needs its own entry, and a category can be one entry or six:
- A base: where they live and who with.
- A day: school, work, training or care, and the people who run it.
- A social circle: friends, rivals, love interests.
- Places they go, and what happens there.
- Whatever the premise needs: an institution, a faction, a rule, a date.
- Hooks that could start a story, each with somebody already involved.
If a category does not fit this world, leave it out and use the entries for something better.

Examples: a college student needs the campus, their dorm or apartment, parents, roommate, friend group, professors, a part-time job, parties and local spots. A starship captain needs the ship, the crew, the star system being traveled, political powers and alliances, rivals, ports of call and the current mission, plus the dull maintenance that keeps a ship alive.

### PRE-ROLLED DEFAULTS
A WORLD RULES line above the block, when present, sets the content registers and consequences; it is separate from the rolled channels.
If a pre-rolled block appears above this prompt it is a default for this world: WORLD THEME, SCALE, PLACE, POWER, TEXTURE and SEASON. A channel the user's details already answer is settled: write from the details and ignore the rolled value. A channel the details only tint is bent to fit. The rest is used as rolled. The world is built out of those six, not out of the persona; the pressure and the opening are yours to derive from them.
The block exists so a batch of worlds from the same persona cannot converge on the same setting.

### SANDBOX LEVERS
Give the sandbox one or two moving parts the narrator can run, in configuration entries rather than the description:
- a clock with a date and what happens when it runs out, if a clock fits;
- a knowledge route: how public something becomes and through whom;
- a relationship dial or gate: what raises it, what lowers it, what unlocks;
- a recurring public event with its own rules.
Name them plainly, keep them consistent, and let them bite. Zero is allowed if the world does not need levers; these are help, not a checklist. Only the lever entries are constant; do not mark atmosphere entries constant.

### THE CRUTCHES
Some props are always in reach: a parish hall, a priest, a fair and a town committee, a rented hall. Use at most two of them unless the theme is Festival week.
- For Party town the parish hall, the priest and the fair are all optional: use at most one of them.
- If {{user}} is underage, at least one venue must be somewhere a teenager can actually get in. Bars alone are not a party town for a fourteen-year-old.
- Bonfires need somewhere to burn: if there are woods, farms or a lake nearby, use them. Do not treat a suburb as inner city.

### IF THE THEME IS PARTY TOWN
The world is the Friday, not a festival.
- Premise: the plan, invitation, ride, lie to a parent, what she brings. Social access, not a civic event. If a ride exists, the obstacle is its condition, not its absence.
- Map the night in the entries: where people go, who works the door, whose parents are away, where it ends at two. Keep a Tuesday too: school, family, bus.
- Power is social: who hosts, drives, has the field, runs the chat. One adult owns a place.
- Cast: both parents if named, a real friend, a gatekeeper, an older teen with access, an adult who owns a place. Roles can double.
- Pressures are social and practical: a list, a ride that fails, a fight, a curfew, weather, a gate-crasher. With NSFL on, one is harm or risk.
- Show the crowd, queue, noise, walk home; do not explain why the town is fun.

### SANDWICH CARD
- name: the world's name, not a person's.
- description: foundations, not a rulebook, and opening with a moving image, not an inventory of venues. Three paragraphs: (1) the PLACE and SCALE in one sentence — type of place, rough population, distance from a city — what the landscape around it actually is (woods, farmland, lake, shore, sprawl), and one plain sentence saying why {{user}} is here and what holds her, with a stake; (2) what people do for fun and where they gather, one genuinely good thing about the place, and who {{user}} knows there; (3) one or two live pressures at {{user}}'s own scale — a friend's sulk, a list, a test, a text, a parent's mood, a plan that will not come together — with the town's bigger story behind them. When NSFL is on, the description itself names one harm or risk in this paragraph: drugs or drink, a predator, a criminal power, an injury, a death, or force. Name a person {{user}} knows who carries it; a rumour about off-screen strangers is not enough. At least one reaches her through people she knows. 320-700 words of prose (the Cast block does not count). At most five named people in the prose, each doing something rather than filling a role slot.
  Only what a local would tell you in a minute. Skip administration: opening times, age policies, licensing, who can be where, shift patterns. Let play fill them in.
  Let it breathe: vary sentence length, no and-chains, no announcing a count of pressures.
  Money does not appear in the description at all unless the user's details name it. No prices, amounts, fees, debts, wages, bills, "two-for-one", "petrol money", "who owes what" or "paid for". Show how the place meets {{user}} instead of declaring "the world does not care", and do not write that none of the pressures concern her. End on a fact or a relationship, not on the same moment the first_mes will use.
- After the prose, one short block. "Cast:" four to seven locals {{user}} would actually know, family first, then friends, a rival and someone who runs a place. One line each: "- Name, age — role; one look; one hook." A hook is a person or a want. Never omit the block; everything named in the details belongs in it. The look is concrete: hair, build, the clothes they actually wear; the people {{user}} runs with should read attractive in their own way. No plots, no full histories. The chat template handles narrator voice; do not specify it here. Cast names do not count against the prose budget.
  Everything the user's details state is canon and must appear: both named parents, ethnicity, body or sexuality conventions, the people {{user}} knows. When the details name an ethnicity, render it at the first mention of that parent, in the prose or the cast. If the details say everyone of an age is bisexual or shaved, every relevant entry says so; put the convention once in the description too instead of repeating boilerplate.
- scenario: where {{user}}'s story starts, derived from the theme, place, season and derived pressures: the specific live moment this world produces, involving at least one person who matters to her. Not necessarily a problem — an invitation, a ritual, an arrival, a task or a party starting all count. Something is unresolved, but it does not need to be urgent yet.
- first_mes: an immersive opening scene addressed to {{user}} in second person, roughly 180-300 words. One room and one moment: at most two NPCs speak, not a queue of introductions. Start in motion: at most two sentences of setting before someone moves or speaks. Give one warm, funny or easy act from somebody on {{user}}'s side before any friction or demand: not a greeting, not the weather, and not a line about the other person. The first spoken line is not an instruction; the first demand comes after the warm act and there is only one. The first demand comes after it, in the second beat, and there is at most one demand. Never act or speak for {{user}}. End on a concrete beat (an NPC speaking or acting, or something happening) that {{user}} can react to — friendly, curious, awkward or tense. Not every opening needs trouble. Never end with a question to the player such as "What do you do?", "What's your next move?" or "Where do you go from here?".
- alternate_greetings: {{greetings}} alternative opening scenes, one per array element and each from a different premise or place in {{user}}'s life. Use different places or moments in {{user}}'s life and the same rules as first_mes. If you return them in one string, separate the scenes with a line containing only ---.
- mes_example: 2-3 short example exchanges, each starting with <START> and using {{user}}: and {{char}}: prefixes, where {{char}} narrates and voices different NPCs so their distinct speech styles show.
- creator_notes: two or three sentences for the human reader, about what the world is for and how to play against it. Do not recap the persona or list her skills — her card already carries them.
- tags: 3-8 genre/setting tags.

### LOREBOOK ENTRIES
- One topic per entry (one NPC, one place, one faction, one custom, one event). 50-140 words each, factual reference style, present tense. Refer to the persona as {{user}}. The Cast block is not part of the entry count: create exactly the requested number of entries, no extras. Short entries are better than truncated JSON: close every brace.
- Keys: two or three specific triggers per entry — names, a distinctive prop, a place's own name. No generic keys like "home", "school", "kitchen", "bar", "door", "room" or "strip"; they fire on every scene and collide. No key appears in two entries.
- Some entries should carry a concrete consequence of the theme: a repair, a rule, a shortage, a smell, an accident. Not every entry needs one.
  - Each NPC's goal must make sense without {{user}} in the room. State the narrow version of what they know, then end the description with one sentence on the negative space. Keep one account of a fact across the whole card: do not let an entry "suspect" what another entry calls certain. Vary the shape: at most two entries may use "does not know"; elsewhere use "is wrong about", "assumes", "suspects", "has not told" or "would not admit". Do not close every entry with "does not know ... and has not asked". One or two NPCs may know something private, but only as an anecdote, never as a label.
- NPC entries must stand alone. The title is a label only and is not sent to the model, so every fact lives in the content and the NPC's name appears there. Use these labelled lines, in order:
  "Name: full name. Age: n. Role: what they do. Relationship to {{user}}: how they know her, and what they want from her or think of her."
  Write NPC entries as plain facts, not prose: no similes, no metaphors, no "the kind of person who". One concrete image at most.
  "Appearance:" build, height, complexion, face, hair (cut and style), eyes, and clothes that show personality. Two or three sentences. Make friends and love interests attractive in their own way, not a list of flaws.
  One memorable feature per NPC, and vary what it is: hair, hands, posture, jewellery, freckles, a tattoo, makeup, a chipped tooth. Do not give every NPC a scar or a chipped tooth; many people have no visible oddity at all.
  When WORLD RULES says NSFW on, add these lines too:
  "Body:" tits/chest, waist, hips, ass — sizes and shapes in the same crude register as the persona card. Keep the words plain for teenagers. For men, give cock length and girth in inches plus cut or uncut, and describe the balls here or under Genitals.
  "Genitals:" static and crude, one line, with usable proportions. Women: labia shape and size, clit, hair, whether it reads tight or broad. Men: length and girth in inches, cut or uncut, balls, hair. Example: "a close-cut dark thatch, small neat lips" or "uncut, six and a half inches, thick, heavy balls". No reactions.
  "Sexuality:" one word; default by gender unless the notes say otherwise.
  "Quirks:" one or two non-sexual mannerisms, tastes or habits that show character: how they take their tea, what they do with their hands when bored, a song they always queue, a subject they cannot leave alone.
  "Kinks:" every NPC gets these; never write "none". One to three sexual fantasies, and only sexual. NSFW means not safe: no abstractions, no euphemism. Use the words — cock, pussy, tits, ass, cum — and resolve every vague noun: filled with what, risk of what, two of what, took what.
  Format is "Name (role) — the act and the effect". If the line does not start with a kink name and a dash, rewrite it. Every line must name a body part or a mess — cock, pussy, cum, mouth, hands, throat, wrist, wet — not just a preference or a vibe. A bare label is not enough: do not stop at "Being watched", "Being needed", "Competence" or "Age gap"; put the act in the first clause. Example: "Voyeurism — fucks herself where he can see, fingers inside, and does not stop when he looks." This is not biography. Write what she wants, would do, dreams about, gets off on, not what she currently does. Aspirational, embarrassing, off the wall is better than accurate. Present or future tense, never a habit report. Older than about twenty-five can want experience; a teenager's kinks use acts that fit her age — fingers, mouth, being watched, being held down — not "being wanted" as a vibe.
  Test first: if it could be a hobby, a job or a social skill, it is a Quirk. A bare noun is not a kink. Name the recognised kink, then one or two sentences of the fantasy and what it does to her body, plus top/sub/switch where it applies. 20-40 words.
  Crude, messy and specific. Sounds, mess, size, stamina, positions, being held down or manhandled, being filmed, overstimulation, ahegao, squirting, pissing herself. Shame, greed and wanting too much are good.
  Palette: dom/sub, bondage, spanking, degradation, praise, bratting, collaring, exhibitionism and being watched or filmed, group/threesome/being shared, two cocks at once, CNC and free use, being used or passed around, somnophilia and being used half-asleep, degradation, praise, breeding and creampie, pregnancy risk, authority and age gaps, a friend's dad, taboo, hair-pulling, breath play, anal, deepthroat, gagging, cum play, overstimulation, forced orgasm, squirting, petplay, collars, feet, sweat, mirrors. Monsters, aliens, knotting if the world allows.
  Bad (safe, vague, habit): "Exhibitionism — parks somewhere public and changes in the front seat." / "Breeding (sub) — talks about it more than she does it."
  Good: "Creampies — wants a cock to pulse and unload inside her, the warmth settling in her belly, the mess leaking down her thighs after; getting filled is the point and the pregnancy risk is part of it." / "Being shared (sub) — wants two cocks at once, or to be passed to a friend once they are done, and called a good little slut for taking it." / "Exhibitionism — wants to be fucked in a lit car and seen, and would let somebody film it."
  If NSFL is on, the palette widens to the non-consent end and NPCs may act before asking; if off, ask first. Keep it crude, not a lifestyle note.
  Competence, clipboard duty, being asked how things work and quiet company go under Quirks.
  When NSFW is off, skip Body, Genitals, Sexuality and Kinks; keep Quirks and a single plain build clause.
  "Personality:" three or four traits plus how they behave when comfortable and when cornered.
  "Goal:" what they are trying to get this week, and who stands in the way. For a bit-part NPC this can be one clause.
  Then the "does not know" sentence.
- NPC entries may run 150-240 words when NSFW is on, 120-200 when it is off. Do not compress away the name, the age or the body.
- For important NPCs (family, close friends, love interests, rivals, bosses, crew), end the content with "Example dialogue:" followed by 2-3 short lines in their own voice, showing how they talk to {{user}} and what they call her.
- keys: 2-6 specific trigger words people would actually type in chat: names, nicknames, surnames, place names, distinctive terms, plus short/lowercase forms. For an NPC the first key is their name. Avoid generic words (the, home, he, she, mom when there are several moms) that would fire constantly.
- secondary_keys: optional. When set, the entry only fires if a primary key AND a secondary key appear. Use them to disambiguate.
- constant: true only for 1-3 essential entries (core world rules, {{user}}'s immediate circumstances). Everything else is keyword-triggered.
- priority: 1-10. High for people and places central to {{user}}'s life, low for background flavor.
- position: "before_char" for foundational lore, "after_char" for most entries, "at_depth" for things that must feel immediate (current events, the active mission).
- probability: 100 normally; 20-60 for random flavor (rumors, random encounters, weather).
- Mention other entries' names inside content so related entries chain together.
- Invent original, fitting names.

### QUALITY BAR
- A cannery entry smells of fish and bleach, names the shift and the owner, and mentions who the shift ruins.
- A cop's loyalty is to a sergeant, not to "the law".
- A market is cheap because somebody is desperate, and the entry says who.
- If a detail could be moved to another world unchanged, it is still too generic.
- Let at least one entry be quietly funny or tender without serving {{user}}.`;

export const DEFAULT_WORLD_FORMAT = `Respond ONLY with one JSON object and nothing else (no commentary, no markdown outside the JSON). Use exactly these keys (use \\n for line breaks inside strings):
{
  "name": "name of the world / sandbox card",
  "description": "the card description, ending with the Cast block",
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

/** Models sometimes return both greetings in one string separated by ---; make them separate entries. */
function splitGreetings(value) {
    return api.toStringList(value)
        .flatMap(item => String(item).split(/\n\s*---+[ \t]*\n/))
        .map(item => item.trim())
        .filter(Boolean);
}

export function normalizeWorld(obj = {}) {
    const str = v => api.asText(v).trim();
    return {
        name: str(obj.name ?? obj.world_name),
        description: str(obj.description),
        scenario: str(obj.scenario),
        first_mes: str(obj.first_mes ?? obj.first_message),
        alternate_greetings: splitGreetings(obj.alternate_greetings),
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

/** Explicit on/off registers for this world; all default on when unset. */
function worldRulesLine(flags = {}) {
    const state = (value) => (value === false ? 'off' : 'on');
    return `WORLD RULES: NSFW ${state(flags.nsfw)}, NSFL ${state(flags.nsfl)}, real consequences ${state(flags.consequences)}.`;
}

function buildSystem({ includeImagePrompt, source, excludeDraftId, preRollBlock = '', flags = {} }) {
    const s = api.settings();
    const rules = worldRulesLine(flags);
    const greetingCount = String(Math.min(20, Math.max(0, Math.round(Number(s.altGreetings) || 0))));
    const parts = [String(preRollBlock || '').trim(), rules, s.worldPrompt.trim().replace(/{{greetings}}/g, greetingCount), s.worldFormat.trim(), banText(source, excludeDraftId)];
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
/**
 * A compact description of the last few generated worlds, so a new one can avoid their bones.
 * Theme, place, season and premise only: enough to see the shape, not enough to copy it.
 */
function recentWorldBones(excludeDraftId = null, limit = 3) {
    const drafts = (api.getDrafts?.() || [])
        .filter(d => d.type === 'world' && d.id !== excludeDraftId && d.data?.name)
        .slice(0, limit);
    if (!drafts.length) return '';
    return drafts.map(draft => {
        const rolled = parsePreRoll(draft.preRoll || '');
        const premise = String(draft.data.scenario || draft.data.description || '').split(/(?<=[.!?])\s/)[0] || '';
        const parts = [
            rolled.THEME ? 'theme: ' + rolled.THEME.slice(0, 110) : '',
            rolled.PLACE ? 'place: ' + rolled.PLACE.slice(0, 130) : '',
            rolled.SEASON ? 'season: ' + rolled.SEASON.slice(0, 100) : '',
            premise ? 'premise: ' + premise.slice(0, 180) : '',
        ].filter(Boolean);
        return '- ' + draft.data.name + ' — ' + parts.join('; ');
    }).join('\n');
}

/** Replaces the persona's name with {{user}} in card prose: the model keeps using it despite the rule. */
function personaMacros(value, name) {
    const names = [name, String(name || '').split(/\s+/)[0]].filter(n => n && n.length > 2);
    const map = (item) => {
        if (typeof item === 'string') {
            return names.reduce((text, n) => text.replace(new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), '{{user}}'), item);
        }
        if (Array.isArray(item)) return item.map(map);
        if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, map(v)]));
        return item;
    };
    const out = { ...value };
    for (const key of ['description', 'scenario', 'first_mes', 'alternate_greetings', 'mes_example', 'creator_notes', 'post_history_instructions', 'system_prompt']) {
        if (key in out) out[key] = map(out[key]);
    }
    out.entries = (value.entries || []).map(entry => ({ ...entry, content: map(entry.content), title: map(entry.title), keys: (entry.keys || []).map(map), secondary_keys: (entry.secondary_keys || []).map(map) }));
    return out;
}

/**
 * The model omits the Cast block on some themes. Rebuild the missing rows from NPC entries so a
 * world can never ship with people only in the lorebook.
 */
function ensureCast(data) {
    const has = (data.description.match(/(^|\n)Cast:/) || []).length > 0;
    const existing = has ? data.description.split(/\nCast:[ \t]*\n?/)[1] || '' : '';
    const lines = existing.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '));
    if (lines.length >= 4) return data;
    const add = [];
    for (const entry of data.entries || []) {
        const content = String(entry.content || '');
        const name = /Name:\s*([^\n.]+)/.exec(content)?.[1]?.trim();
        const age = /Age:\s*(\d{1,3})/.exec(content)?.[1];
        const role = /Role:\s*([^\n.]+)/.exec(content)?.[1]?.trim();
        const relationship = /Relationship to \{\{user\}\}:\s*([^\n.]+)/.exec(content)?.[1]?.trim();
        const look = /Appearance:\s*([^\n.]+)/.exec(content)?.[1]?.trim();
        if (!name || !age || !role) continue;
        if (lines.some(line => line.startsWith('- ' + name + ','))) continue;
        const clauses = (look || '').split(/[.;]/)[0].split(',').map(x => x.trim()).filter(Boolean);
        let shortLook = '';
        for (const clause of clauses) {
            if (shortLook && shortLook.length + clause.length + 2 > 120) break;
            shortLook = shortLook ? shortLook + ', ' + clause : clause;
        }
        add.push('- ' + name + ', ' + age + ' — ' + role.toLowerCase() + (shortLook ? '; ' + shortLook : '') + (relationship ? '; ' + relationship : ''));
        if (lines.length + add.length >= 7) break;
    }
    if (!add.length) return data;
    const block = 'Cast:\n' + [...lines, ...add].join('\n');
    data.description = has ? data.description.replace(/\nCast:[ \t]*\n?[\s\S]*$/, '\n\n' + block) : data.description.trimEnd() + '\n\n' + block;
    return data;
}

/** Last-resort kink lines for NPCs that omitted the field. Rotated so they are not identical. */
const FEMALE_KINKS = [
    "Praise (switch) \u2014 wants to be called a good girl while a cock is pushed into her; the words make her throat dry and her hips push back.",
    "Being watched \u2014 a hand between her legs under a table while somebody watches, two fingers in before they say anything.",
    "Bratting \u2014 bent over and spanked until her thighs are wet and the apology is fucked out of her.",
    "Wrist-pinning (sub) \u2014 wrists held above her head, one hand spanning both, fucked hard like that.",
    "Authority (sub) \u2014 told to kneel and open her mouth; a hand in her hair keeps her there.",
    "Exhibitionism \u2014 a cock in her where somebody could walk in, and not stopping when they do.",
    "Hair-pulling (sub) \u2014 a fist in her hair, throat bared, made to say please around it.",
    "Praise (dom) \u2014 a partner's mouth watched while telling them how well they are taking it, hand flat on the belly.",
    "Roleplay \u2014 a stranger, a teacher, a customer, and being fucked like one; clothes half off and no names.",
    "Being used (sub) \u2014 passed around a room and left full, sore and leaking, and praised afterward.",
    "Slow filth \u2014 held by the throat and told to stay still while the cock is dragged out and pushed back.",
    "Breath play \u2014 a hand at the throat, light, told not to come until the hand lifts.",
];

const MALE_KINKS = [
    "Praise (sub) \u2014 wants to be called a good boy while a cock is pushed into him; the words make his thighs shake.",
    "Being watched \u2014 a hand around his cock under the table while somebody watches, and told not to stop.",
    "Bratting \u2014 bent over and spanked until his thighs are wet and he says sorry.",
    "Wrist-pinning (sub) \u2014 wrists held above his head, one hand spanning both, fucked hard like that.",
    "Authority (sub) \u2014 told to kneel and open his mouth; a hand in his hair keeps him there.",
    "Exhibitionism \u2014 wants his cock out where somebody could walk in, and to keep going when they do.",
    "Hair-pulling (sub) \u2014 a fist in his hair, throat bared, made to say please around it.",
    "Praise (dom) \u2014 a partner's mouth watched while telling them how well they take it, hand flat on the belly.",
    "Roleplay \u2014 a stranger, a teacher, a customer, and being used like one; clothes half off and no names.",
    "Being used (sub) \u2014 passed around a room and left sore and empty, told he did well.",
    "Slow filth \u2014 held by the throat and told to stay still while his cock is worked.",
    "Breath play \u2014 a hand at the throat, light, told not to come yet.",
];

const FALLBACK_KINKS = [
    "Praise (switch) \u2014 wants to be called a good girl while a cock is pushed into her; the words make her throat dry and her hips push back.",
    "Being watched \u2014 a hand between her legs under a table while somebody watches, two fingers in before they say anything.",
    "Bratting \u2014 bent over and spanked until her thighs are wet and the apology is fucked out of her.",
    "Wrist-pinning (sub) \u2014 wrists held above her head, one hand spanning both, fucked hard like that.",
    "Authority (sub) \u2014 told to kneel and open her mouth; a hand in her hair keeps her there.",
    "Exhibitionism \u2014 a cock in her where somebody could walk in, and not stopping when they do.",
    "Hair-pulling (sub) \u2014 a fist in her hair, throat bared, made to say please around it.",
    "Praise (dom) \u2014 a partner's mouth watched while telling them how well they are taking it, hand flat on the belly.",
    "Roleplay \u2014 a stranger, a teacher, a customer, and being fucked like one; clothes half off and no names.",
    "Being used (sub) \u2014 passed around a room and left full, sore and leaking, and praised afterward.",
    "Slow filth \u2014 held by the throat and told to stay still while the cock is dragged out and pushed back.",
    "Breath play \u2014 a hand at the throat, light, told not to come until the hand lifts.",
];
/**
 * Last-resort kink lines for NPCs that omitted the field or wrote a vibe. Split by body so the
 * pronouns and the act fit the character; rotated so they are not identical.
 */
const KINK_LABELS = [
    ['Being watched', 'Exhibitionism'], ['Being needed', 'Service'], ['Being used', 'Free use'],
    ['Being pinned', 'Bondage'], ['Being appreciated', 'Praise'], ['Hands', 'Wrist-pinning'],
    ['Slow and heavy', 'Slow sex'],
];

const KINK_BODY = /cock|pussy|cum|mouth|throat|wrist|wet|tits|ass\b|finger|tongue|nipple|thigh|mess|squirt|hard on|spank|bent over|kneel|hand|hair|neck|legs|chest|breast|skin|between the legs/i;

function ensureKinks(data) {
    let i = 0;
    data.entries = (data.entries || []).map(entry => {
        const content = String(entry.content || '');
        if (!/Name:\s*[^\n]+/.test(content)) return entry;
        let current = /Kinks:\s*([^\n]*)/.exec(content)?.[1] || '';
        const original = current;
        if (current) for (const [from, to] of KINK_LABELS) current = current.replace(new RegExp('^' + from + '(?=\\s*[—-])'), to);
        if (current.trim() && current.trim().toLowerCase() !== 'none' && KINK_BODY.test(current)) {
            return current !== original ? { ...entry, content: content.replace(/Kinks:\s*[^\n]*/, 'Kinks: ' + current) } : entry;
        }
        const male = /Genitals:[^\n]*(cock|balls|uncut)|Body:[^\n]*(cock|balls)/i.test(content);
        const female = /Genitals:[^\n]*(pussy|labia|slit)|Body:[^\n]*(tits|breasts)/i.test(content);
        const pool = male && !female ? MALE_KINKS : female && !male ? FEMALE_KINKS : FALLBACK_KINKS;
        const line = 'Kinks: ' + pool[i++ % pool.length];
        if (/Kinks:/i.test(content)) return { ...entry, content: content.replace(/Kinks:\s*[^\n]*/i, line) };
        return { ...entry, content: content.trimEnd() + '\n' + line };
    });
    return data;
}

/**
 * A dark theme can come back warm and safe. When NSFL is on and the card carries fewer than two
 * harm markers (or none in the description), append one theme-true sentence with a named person.
 */
const NSFL_MARKS = {
    "Cozy but fraying": "The risk is ordinary: a drunk driver takes the bend too fast and the footbridge lift has already dropped one man.",
    "Neon noir": "Two muggings on the strip this month and a fire in a room above the Vault; the police came to neither quickly.",
    "Dystopian austerity": "A permit inspector takes cash, a family gets a removal notice, and the queue knows exactly who reported them.",
    "Pastoral gothic": "A bull got out last month and a farmhand lost two fingers; the family settled it privately and argued about whose fault it was.",
    "Solarpunk": "A water thief was caught at the standpipe and a scaffold collapsed on the library roof; the repair list runs a page.",
    "Post-collapse": "A convoy did not come back and a scavenging trip ended with a broken leg and a knife drawn over a fuel can.",
    "Corporate arcology": "A floor supervisor was found dead in a stairwell and the company called it natural causes; security carries stun batons.",
    "Mythic": "A man broke an oath at the yard gate and the water took him at the ford; the town is still arguing what it owes.",
    "Liminal": "A motel guest overdosed in room 9 and the night clerk found him; the agency crews came back to a lobby full of police.",
    "Coastal working town": "A deckhand lost a hand to a winch and the harbor commission is burying the report; the ferry runs drunk some Fridays.",
    "Frontier": "A land sale went wrong and a man was beaten at the fence line; the sheriff is the seller's cousin.",
    "Underground": "A lift cable snapped last winter and took two fingers off a fitter; the hydroponics sheds have a mold nobody has tested.",
    "Orbital": "A flap motor failed on the ring and a maintenance tech lost an arm; three flats are tapping the air meter.",
    "Weird fiction": "A dog came back wrong from the far side of the post office and a man who broke the rule was found on the boardwalk, unable to give his name.",
    "Industrial river city": "A foundry burn took a man's arm and the river has a sheen on it again; the town knows both and does nothing.",
    "Academic town": "A student was roofied at a trustee fundraiser and the college paper buried it; a lab tech broke a wrist the same week.",
    "Suburban night": "A car hit a kid on the cul-de-sac and drove off; the church bonfire got out of hand in July and burned the fence.",
    "Endless summer": "A drowning at the lake in June and a boardwalk fight on the Fourth; the lifeguard chairs are still empty.",
    "Pool-and-cookout suburb": "A kid went under at the pool and a grill fire took a fence; the community board is still arguing about it.",
    "Festival week": "A Ferris wheel brake was signed off twice and a generator caught fire; a fight in the beer tent put two men in the clinic.",
    "Party town": "A car went into the lake lot ditch at two and a freshman got spiked on somebody's rum; the host's parents came home early.",
    "Holiday resort": "A snowmobile hit a tree on the lower run and a staffer burned an arm on the fryer; the hotel has not replaced the fire door.",
    "Main-street revival": "A drunk driver took out the bakery sign and the mural painter fell off the lift; a fight outside the market sent one man to Tucson."
};

const NSFL_MARKER = /drug|roofie|drunk|drink|drinking|overdose|high on|cocaine|weed|powder|dealer|bad batch|spiked|gone down hard|threat|knife|gun|predator|rapist|mugged|arrest|police|fight|brawl|injur|blood|broke(?:n)? (?:arm|leg|nose)|hospital|dead|death|died|urgent care|wrist brace|stitches|concussion/i;

function ensureHarm(data, themeLabel) {
    const mark = NSFL_MARKS[themeLabel];
    const desc = String(data.description || '');
    const text = desc + '\n' + (data.entries || []).map(e => String(e.content || '')).join('\n');
    const marks = (text.match(new RegExp(NSFL_MARKER.source, 'gi')) || []).length;
    if (!mark || !desc || (marks >= 2 && NSFL_MARKER.test(desc))) return data;
    const parts = desc.split(/\n\s*\n(?=Cast:)/);
    data.description = parts[0].trimEnd() + ' ' + mark + (parts[1] ? '\n\nCast: ' + parts[1] : '');
    return data;
}

const GENERIC_KEYS = new Set(['home', 'school', 'kitchen', 'bar', 'door', 'room', 'strip', 'car', 'truck', 'chat', 'invite', 'the house', 'the chat', 'group chat', 'tonight', 'friday', 'the road', 'the lake', 'water', 'the key', 'talk', 'rumour', 'song list', 'microphone']);

/** Remove generic keys, then any key already claimed by an earlier entry. */
function cleanKeys(data) {
    const seen = new Set();
    for (const entry of data.entries || []) {
        const keys = (entry.keys || []).filter(Boolean);
        const specific = keys.filter(k => !GENERIC_KEYS.has(String(k).toLowerCase()));
        const pool = specific.length >= 2 ? specific : keys;
        entry.keys = pool.filter(k => {
            const kk = String(k).toLowerCase();
            if (seen.has(kk)) return false;
            seen.add(kk);
            return true;
        });
        if (entry.keys.length > 3) entry.keys = entry.keys.slice(0, 3);
    }
    return data;
}

/** Trim description prose to 700 words, never touching the Cast block. */
function clampDescription(data) {
    const desc = String(data.description || '');
    const parts = desc.split(/\n\s*\n(?=Cast:)/);
    let prose = parts[0].trimEnd();
    if (prose.split(/\s+/).length <= 700) return data;
    const sentences = prose.match(/[^.!?]+[.!?]+/g) || [prose];
    while (sentences.length > 1 && sentences.join(' ').split(/\s+/).length > 700) sentences.pop();
    prose = sentences.join(' ').trimEnd();
    data.description = prose + (parts[1] ? '\n\nCast: ' + parts[1] : '');
    return data;
}

export async function generateWorld({ source, imageBlob = null, details = '', excludeDraftId = null, imageDescription = '', preRoll = '', steer = null, flags = {}, signal = null, onStatus = () => { } }) {
    if (!source?.name) throw new Error('Pick a persona to live in this world.');
    const s = api.settings();
    const count = clampInt(s.worldEntryCount, 3, 80, 20);
    // Worlds converge the same way cards do: the same persona and the same prompt, batch after batch.
    const preRollBlock = preRoll.trim() || (s.preRoll ? formatPreRoll(rollPreRoll({ type: 'world', steer: steer || {} }).values, 'world') : '');
    const image = await api.prepareImage(imageBlob, 'world', { description: imageDescription, signal, onStatus });
    if (image.description) onStatus('Building the world… big worlds can take a few minutes.');
    const recent = recentWorldBones(excludeDraftId);
    const anchorLabel = WORLD_THEMES.find(t => preRollBlock.includes(t.text))?.label;
    const anchors = THEME_ANCHORS[anchorLabel];
    const anchorText = anchors ? `Theme anchors — use at least two as concrete facts, adapted to this place: ${anchors.join('; ')}.` : '';
    const text = [
        `Build a living sandbox world that this persona happens to live in.\n\n${sourceBlock(source)}\n\nThe persona's card describes how they experience the world. It is not a list of things the world must provide, and nobody in the world has read it.`,
        details?.trim() ? `World notes from the user (these take priority):\n${details.trim()}` : '',
        anchorText,
        recent ? `Worlds already built recently. Do not reuse their bones; a new place, a different premise, and a different source of pressure:\n${recent}` : '',
        `Create exactly ${count} lorebook entries, 50-140 words each, plus the sandbox card. Keep the card's description to 320-700 words of prose.`,
        BAN_REMINDER,
        'Reply with the JSON object only.',
    ].filter(Boolean).join('\n\n');

    const messages = [
        { role: 'system', content: buildSystem({ includeImagePrompt: !imageBlob && s.suggestImagePrompt, source, excludeDraftId, preRollBlock, flags }) },
        { role: 'user', content: userContent(text, image) },
    ];
    const raw = await request(messages, signal);
    const parsed = normalizeWorld(api.parseJsonLoose(raw, s.worldMaxTokens));
    if (!parsed.entries.length) throw new Error('The model returned no lorebook entries. Check the raw output, or raise "World max tokens".');
    let data = personaMacros(parsed, source.name);
    data = ensureCast(data);
    if (flags.nsfw !== false) data = ensureKinks(data);
    data = cleanKeys(data);
    if (flags.nsfl !== false) data = ensureHarm(data, anchorLabel);
    data = clampDescription(data);
    data.entries = (data.entries || []).slice(0, count);
    return { data, raw: api.stripReasoning(raw), imageDescription: image.description, preRoll: preRollBlock };
}

/** Asks for additional entries that fill gaps in an existing world. */
async function generateMoreEntries({ source, world, details, count, excludeDraftId, preRoll = '', flags = {}, signal }) {
    const existing = world.entries.map(e => `- ${e.title} [${e.category}] keys: ${e.keys.join(', ')}`).join('\n');
    const text = [
        `This world already exists and the persona below already lives in it. Add ${count} NEW lorebook entries that fill gaps: more NPCs, places, factions, customs, events and story hooks. Do not repeat or rewrite existing topics, but you may connect new entries to them.`,
        sourceBlock(source),
        `World name: ${world.name}\nWorld description:\n${world.description}`,
        `Existing entries:\n${existing || '(none)'}`,
        details?.trim() ? `World notes from the user (these take priority):\n${details.trim()}` : '',
        BAN_REMINDER,
        'Reply with a JSON object of the form {"entries": [...]} only, each entry using the same fields as before.',
    ].filter(Boolean).join('\n\n');

    const messages = [
        { role: 'system', content: buildSystem({ includeImagePrompt: false, source, excludeDraftId, preRollBlock: preRoll, flags }) },
        { role: 'user', content: text },
    ];
    const raw = await request(messages, signal);
    const parsed = api.parseJsonLoose(raw, api.settings().worldMaxTokens);
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
 * @param {string} [options.personaId] Persona who lives in the world (defaults to the current one)
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
        preRoll: draft?.preRoll ?? '',
        preRollSteer: draft?.preRollSteer ?? {},
        worldFlags: draft?.worldFlags ?? { nsfw: true, nsfl: true, consequences: true },
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
                <label>The persona who lives in it</label>
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
                <label class="checkbox_label"><input type="checkbox" class="stcg-w-nsfw"> NSFW content</label>
                <label class="checkbox_label"><input type="checkbox" class="stcg-w-nsfl"> NSFL: violence, death, gore</label>
                <label class="checkbox_label"><input type="checkbox" class="stcg-w-consequences"> Real consequences (no protagonist privilege)</label>
                <label>Theme (used when the pre-roll is drawn)<select class="text_pole stcg-w-theme"><option value="">Any (rolled)</option>${THEME_OPTIONS.world.map(o => `<option value="${api.escapeHtml(o.value)}">${api.escapeHtml(o.label)}</option>`).join('')}</select></label>
                <details class="stcg-w-preroll">
                    <summary>Pre-rolled for this world</summary>
                    <textarea class="text_pole stcg-w-pre-roll" rows="7" placeholder="Rolled on Generate. Edit any line to change what this world is built on; clear it to draw a fresh roll."></textarea>
                </details>
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
    const $theme = $root.find('.stcg-w-theme');
    if ($theme.length) $theme.val(state.preRollSteer.THEME || '').on('change', e => { state.preRollSteer.THEME = String($(e.target).val()); });
    for (const key of ['nsfw', 'nsfl', 'consequences']) {
        $root.find('.stcg-w-' + key).prop('checked', state.worldFlags[key] !== false)
            .on('change', e => { state.worldFlags[key] = Boolean($(e.target).prop('checked')); });
    }

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
        state.raw = JSON.stringify(state.data, null, 2);
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
        state.preRoll = String($root.find('.stcg-w-pre-roll').val() ?? '');
    }

    function setPreRoll(text) {
        state.preRoll = String(text || '');
        $root.find('.stcg-w-pre-roll').val(state.preRoll);
        $root.find('.stcg-w-preroll').toggle(!!state.preRoll || api.settings().preRoll);
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
        // Auto Fix needs a target score; with the threshold at 0 there is nothing to reach.
        $root.find('.stcg-q-autofix')
            .toggleClass('disabled', !autoFixTarget())
            .attr('title', autoFixTarget()
                ? `Review and fix on repeat until the world reaches ${autoFixTarget()}/10 in Quality pass settings (up to ${autoFixRoundCap()} fixes)`
                : 'Set "Auto-fix when the score is below" in Quality pass settings first');
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

    const quality = signal => ({ type: 'world', details: [state.details, worldRulesLine(state.worldFlags)].filter(Boolean).join('\n'), preRoll: state.preRoll, source: state.source, steer: state.steer, signal });

    function refresh() {
        state.raw = JSON.stringify(state.data, null, 2);
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
            autofix: 'Auto-fixing…',
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
            if (kind === 'autofix') {
                const threshold = autoFixTarget();
                if (!threshold) {
                    toastr.info('Set "Auto-fix when the score is below" in Quality pass settings first.', 'Card Generator');
                    return 'No Auto Fix target set.';
                }
                let result;
                try {
                    result = await autoFixCard({
                        ...quality(signal), data: state.data,
                        onStatus: status,
                        onProgress: ({ data }) => { state.data = data; refresh(); },
                    });
                } catch (error) {
                    // A Stop keeps the fixes that already landed; make them undoable in one step too.
                    if (JSON.stringify(state.data) !== JSON.stringify(snap.data)) pushHistory(snap);
                    throw error;
                }
                pushHistory(snap);
                state.data = result.data;
                state.review = result.review;
                // The loop applied the instructions, so they are consumed like they are after Fix issues.
                state.steer = '';
                $root.find('.stcg-steer').val('').trigger('input');
                refresh();
                return result.reached
                    ? `Reached ${result.review.overall}/10 in ${result.fixes} fix${result.fixes === 1 ? '' : 'es'}.`
                    : `Best ${result.review.overall}/10 after ${result.fixes} fix${result.fixes === 1 ? '' : 'es'}; ${threshold}/10 was not reached.`;
            }
            if (kind === 'fix' || kind === 'enhance' || kind === 'optimize') {
                const result = await reviseCard({ ...quality(signal), data: state.data, mode: kind, issues: state.review?.issues || [] });
                pushHistory(snap);
                state.data = result.data;
                refresh();
                // A revision invalidates the list on screen. Clear it and re-review, and never let a
                // failed re-review leave the old issues looking current.
                const before = state.review;
                const fixed = kind === 'fix' ? (before?.issues || []).filter(i => !i.skip) : [];
                state.review = { ...(before || {}), issues: [], summary: 'Revision applied. Re-reviewing…' };
                refresh();
                status('Re-reviewing…');
                try {
                    state.review = {
                        ...await reviewCard({ ...quality(signal), data: state.data, previousIssues: fixed }),
                        previous: before?.overall,
                    };
                } catch (error) {
                    if (error?.name === 'AbortError' || signal.aborted) throw error;
                    state.review = { ...(before || {}), issues: [], summary: `Revision applied, but the re-review failed: ${error.message}. Run Review again.` };
                }
                refresh();
                return result.changed.length ? `Changed: ${result.changed.join(', ')}.` : 'The model made no changes.';
            }
            if (kind === 'world') {
                const result = await generateWorld({
                    source: state.source,
                    imageBlob: state.imageBlob,
                    details: state.details,
                    excludeDraftId: draft?.id,
                    imageDescription: state.imageDescription,
                    preRoll: state.preRoll,
                    steer: state.preRollSteer,
                    flags: state.worldFlags,
                    signal,
                    onStatus: status,
                });
                setImageDescription(result.imageDescription);
                setPreRoll(result.preRoll);
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
                flags: state.worldFlags,
                source: state.source,
                world: state.data,
                details: state.details,
                count: clampInt(s.worldEntryCount, 3, 80, 20),
                excludeDraftId: draft?.id,
                preRoll: state.preRoll,
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
    setPreRoll(state.preRoll);
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
    $root.find('.stcg-q-autofix').on('click', () => run('autofix'));
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
    draft.preRollSteer = { ...state.preRollSteer };
    draft.worldFlags = { ...state.worldFlags };
    draft.data = structuredClone(state.data);
    draft.raw = state.raw;
    draft.details = state.details;
    draft.steer = state.steer;
    draft.imageDescription = state.imageDescription;
    draft.review = state.review;
    draft.preRoll = state.preRoll;
    draft.error = '';
    draft.status = state.data.entries.length ? 'ready' : 'queued';
    api.upsertDraft(draft);
}
