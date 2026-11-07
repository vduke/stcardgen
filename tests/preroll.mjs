// Checks the pre-roll tables and block rendering.
//
// The pre-roll exists to stop a batch of personas converging on the same character. Two things can
// quietly break that: a table that reuses the model's default and unfavourable habits, and a block
// that fails to name every channel. Both are checked here.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRE_ROLL_CHANNELS, CHARACTER_CHANNELS, WORLD_CHANNELS, WORLD_THEMES, THEME_PLACE_KINDS, THEME_SCALES, THEME_SEASONS, channelsFor, rollPreRoll, formatPreRoll, parsePreRoll } from '../preroll.js';
import { extractTemplate } from './extract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function test(name, fn) {
    try { fn(); console.log('  ok   ' + name); }
    catch (e) { failures++; console.log('  FAIL ' + name + '\n         ' + e.message); }
}

console.log('tables');
test('every channel has enough values to fill a batch without repeating', () => {
    for (const channel of PRE_ROLL_CHANNELS) {
        const min = channel.key === 'WARMTH' ? 3 : ['VIBE', 'SEXUALITY'].includes(channel.key) ? 5 : 12;
        assert.ok(channel.entries.length >= min, `${channel.key} has only ${channel.entries.length}`);
        assert.strictEqual(new Set(channel.entries).size, channel.entries.length, `${channel.key} has duplicate entries`);
    }
});
test('the prompt is told about exactly the channels that are rolled', () => {
    const prompt = extractTemplate(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), 'DEFAULT_PERSONA_PROMPT');
    for (const channel of PRE_ROLL_CHANNELS) {
        assert.ok(prompt.includes(channel.label), `prompt never names ${channel.label}`);
    }
    // Appearance must not be pre-rolled: the image is the authority on it.
    // The shipped prompt's section names drift; anchor on the section that really follows the
    // binding block and fail loudly if it stops existing, instead of slicing to the end of the file.
    const start = prompt.indexOf('PRE-ROLLED DEFAULTS');
    const end = prompt.indexOf('### CARD SPEC');
    assert.ok(start >= 0 && end > start, 'binding block anchors moved; the check would scan the wrong text');
    const binding = prompt.slice(start, end);
    assert.ok(!/\bAGE\b/.test(binding), 'binding block still claims to pre-roll AGE, but age comes from the image');
    assert.ok(!/\bBODY\b/.test(binding), 'binding block still claims to pre-roll BODY, but it comes from the image');
});
test('the prompt describes the block above itself', () => {
    const prompt = extractTemplate(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), 'DEFAULT_PERSONA_PROMPT');
    assert.ok(/PRE-ROLLED FOR THIS SESSION/.test(prompt), 'prompt does not refer to the pre-rolled block');
});

console.log('drawing');
test('a seed reproduces the same roll', () => {
    const a = rollPreRoll({ seed: 4242 });
    const b = rollPreRoll({ seed: 4242 });
    assert.deepStrictEqual(a.values, b.values);
});
test('different seeds give different rolls', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 12; seed++) seen.add(JSON.stringify(rollPreRoll({ seed }).values));
    assert.ok(seen.size > 6, `12 seeds produced only ${seen.size} distinct rolls`);
});
test('avoid steers a channel away from values already used in the batch', () => {
    const channel = PRE_ROLL_CHANNELS[0];
    const avoid = { [channel.key]: channel.entries.slice(0, channel.entries.length - 1) };
    const roll = rollPreRoll({ seed: 7, avoid });
    assert.strictEqual(roll.values[channel.key], channel.entries[channel.entries.length - 1]);
});
test('a full avoid list falls back instead of throwing', () => {
    const channel = PRE_ROLL_CHANNELS[0];
    const avoid = { [channel.key]: channel.entries };
    const roll = rollPreRoll({ seed: 7, avoid });
    assert.ok(channel.entries.includes(roll.values[channel.key]));
});
test('a batch draws distinct values per channel when seeds differ', () => {
    // Collisions should be rare rather than impossible, but not systematic.
    const channel = PRE_ROLL_CHANNELS[2];
    const used = [];
    const avoid = {};
    for (let i = 0; i < 6; i++) {
        const roll = rollPreRoll({ seed: 1000 + i, avoid });
        used.push(roll.values[channel.key]);
        avoid[channel.key] = used;
    }
    assert.strictEqual(new Set(used).size, used.length, 'batch reused a friction direction with avoid supplied');
});

console.log('block');
test('the block names every channel and is binding', () => {
    const block = formatPreRoll(rollPreRoll({ seed: 1 }).values);
    for (const channel of PRE_ROLL_CHANNELS) assert.ok(block.includes(channel.label + ': '), `missing ${channel.label}`);
    assert.ok(block.startsWith('PRE-ROLLED FOR THIS SESSION'), 'block must open with the label the prompt looks for');
    assert.ok(/defaults only/i.test(block));
});
test('a written block parses back to the same values', () => {
    const roll = rollPreRoll({ seed: 99 });
    const parsed = parsePreRoll(formatPreRoll(roll.values));
    assert.deepStrictEqual(parsed, roll.values);
});
test('an empty roll produces no block', () => {
    assert.strictEqual(formatPreRoll(null), '');
    assert.strictEqual(formatPreRoll({}), '');
});
test('the block avoids the prompt\'s own banned phrases', () => {
    const prompt = extractTemplate(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), 'DEFAULT_PERSONA_PROMPT');
    const bannedSection = prompt.slice(prompt.indexOf('**Banned phrases'), prompt.indexOf('### BREVITY'));
    const banned = [...bannedSection.matchAll(/"([^"\n]{4,80})"/g)].map(m => m[1].toLowerCase());
    assert.ok(banned.length > 10, 'could not read the banned-phrase list');
    for (const channel of PRE_ROLL_CHANNELS) {
        for (const entry of channel.entries) {
            for (const phrase of banned) {
                assert.ok(!entry.toLowerCase().includes(phrase), `${channel.key} entry repeats banned phrase "${phrase}": ${entry}`);
            }
        }
    }
});

// Characters and worlds draw from their own channel sets. A set that is too small, or that reuses a
// label, collapses back into the convergence this whole mechanism exists to prevent.
console.log('channel sets');
const sets = {
    persona: PRE_ROLL_CHANNELS,
    character: CHARACTER_CHANNELS,
    world: WORLD_CHANNELS,
};
for (const [type, channels] of Object.entries(sets)) {
    test(`${type}: every channel carries at least ten distinct entries`, () => {
        assert.ok(channels.length >= 5, `${type} has only ${channels.length} channels`);
        for (const channel of channels) {
            const min = channel.key === 'WARMTH' ? 3 : ['VIBE', 'SEXUALITY', 'SCALE'].includes(channel.key) ? 5 : 10;
            assert.ok(channel.entries.length >= min, `${type}/${channel.key} has ${channel.entries.length} entries`);
            assert.strictEqual(new Set(channel.entries).size, channel.entries.length, `${type}/${channel.key} repeats an entry`);
            for (const entry of channel.entries) {
                assert.ok(entry.length <= 260, `${type}/${channel.key} entry too long to use verbatim: ${entry}`);
            }
        }
    });
}
test('labels are distinct unless two sets share a channel and its entries', () => {
    const seen = new Map();
    for (const type of Object.keys(sets)) {
        for (const channel of sets[type]) {
            const first = seen.get(channel.label);
            if (first) {
                assert.ok(first.key === channel.key && JSON.stringify(first.entries) === JSON.stringify(channel.entries),
                    `a label is shared between different channels: ${channel.label}`);
            }
            seen.set(channel.label, channel);
        }
    }
});
for (const type of ['character', 'world']) {
    test(`${type}: the block names every channel and does not include persona lines`, () => {
        const block = formatPreRoll(rollPreRoll({ seed: 3, type }).values, type);
        for (const channel of sets[type]) assert.ok(block.includes(channel.label + ': '), `block is missing ${channel.label}`);
        for (const channel of PRE_ROLL_CHANNELS) {
            if (sets[type].some(c => c.key === channel.key)) continue;
            assert.ok(!block.includes(channel.label + ': '), `block leaked persona channel ${channel.label}`);
        }
    });
    test(`${type}: a written block parses back to the same values`, () => {
        const roll = rollPreRoll({ seed: 41, type });
        assert.deepStrictEqual(parsePreRoll(formatPreRoll(roll.values, type)), roll.values);
    });
    test(`${type}: the roll varies with the seed`, () => {
        const a = rollPreRoll({ seed: 1, type }).values;
        const b = rollPreRoll({ seed: 2, type }).values;
        assert.notDeepStrictEqual(a, b);
    });
    test(`${type}: asks for the channels it was given`, () => {
        const block = formatPreRoll(rollPreRoll({ seed: 5, type }).values, type);
        const footer = block.split('\n\n')[1] || '';
        const named = sets[type].filter(c => footer.includes(c.label)).length;
        assert.ok(named >= 3, `${type} footer names only ${named} of its channels: ${footer}`);
    });
}
test('character and world entries avoid the slop phrases the prompts ban', () => {
    const banned = ['a beat too long', 'files it away', 'watches hands', 'watches mouths', 'unblinking',
        'smirk', 'chuckles', 'does not shy away', 'no-nonsense', 'enigmatic', 'walls around'];
    for (const type of ['character', 'world']) {
        for (const channel of sets[type]) {
            for (const entry of channel.entries) {
                for (const phrase of banned) {
                    assert.ok(!entry.toLowerCase().includes(phrase), `${type}/${channel.key} repeats "${phrase}": ${entry}`);
                }
            }
        }
    }
});
// The experience list is an inventory of what happened. "No anal" and "never" are limits, and the
// model was copying them in; the lists must name acts done only.
test('experience lists name only acts done', () => {
    const channels = [PRE_ROLL_CHANNELS.find(c => c.key === 'SOURCE OF EXPERIENCE'), CHARACTER_CHANNELS.find(c => c.key === 'EXPERIENCE')];
    for (const channel of channels) {
        for (const entry of channel.entries) {
            assert.ok(!/\b(no|never|nothing|not yet|does not)\b/i.test(entry), `${channel.key} entry tracks a negative: ${entry}`);
        }
    }
});
// A roll is a fallback, not a script: the block has to tell the model that a settled channel is
// dropped rather than written anyway.
test('the block makes the user details outrank the roll', () => {
    const block = formatPreRoll(rollPreRoll({ seed: 1 }).values);
    assert.match(block, /details win/);
    assert.match(block, /settled/);
});

const charThemes = CHARACTER_CHANNELS.find(c => c.key === 'THEME');
const worldThemes = WORLD_CHANNELS.find(c => c.key === 'THEME');
test('theme channels cover characters and worlds with distinct entries', () => {
    for (const channel of [charThemes, worldThemes]) {
        assert.ok(channel && channel.entries.length >= 12, `${channel?.key} theme list is too short`);
        assert.strictEqual(new Set(channel.entries).size, channel.entries.length, 'duplicate theme');
    }
    assert.ok(charThemes.entries.every(entry => !worldThemes.entries.includes(entry)), 'character and world themes overlap');
});
test('a theme steer forces the theme instead of drawing one', () => {
    const chosen = charThemes.entries[4];
    const rolled = rollPreRoll({ seed: 2, type: 'character', steer: { THEME: chosen } });
    assert.strictEqual(rolled.values.THEME, chosen);
    assert.ok(formatPreRoll(rolled.values, 'character').includes('CHARACTER THEME: ' + chosen));
    const worldChosen = worldThemes.entries[4];
    assert.strictEqual(rollPreRoll({ seed: 2, type: 'world', steer: { THEME: worldChosen } }).values.THEME, worldChosen);
});
const maskChannel = PRE_ROLL_CHANNELS.find(c => c.key === 'MASK TEMPERAMENT');
const sourceChannel = PRE_ROLL_CHANNELS.find(c => c.key === 'SOURCE OF EXPERIENCE');
test('every mask lives in exactly one vibe/warmth cell and every cell is usable', () => {
    const seen = new Set();
    for (const [cell, entries] of Object.entries(maskChannel.groups)) {
        const [vibe, warmth] = cell.split('/');
        assert.ok(['shy', 'reserved', 'steady', 'outgoing', 'big personality'].includes(vibe), cell);
        assert.ok(['sweet', 'neutral', 'sharp'].includes(warmth), cell);
        assert.ok(entries.length >= 2, cell);
        for (const entry of entries) {
            assert.ok(!seen.has(entry), entry + ' is in two cells');
            seen.add(entry);
        }
    }
    assert.strictEqual(seen.size, maskChannel.entries.length, 'a mask is in no cell');
});
test('vibe and warmth force values and narrow the mask to their cell', () => {
    const roll = rollPreRoll({ seed: 9, steer: { VIBE: 'Shy', WARMTH: 'Sharp' } });
    assert.strictEqual(roll.values.VIBE, 'Shy');
    assert.strictEqual(roll.values.WARMTH, 'Sharp');
    assert.ok(maskChannel.groups['shy/sharp'].includes(roll.values['MASK TEMPERAMENT']));
});
test('one axis alone unions its own cells', () => {
    for (let seed = 1; seed <= 8; seed++) {
        const roll = rollPreRoll({ seed, steer: { VIBE: 'Outgoing' } });
        const allowed = Object.entries(maskChannel.groups)
            .filter(([cell]) => cell.startsWith('outgoing/')).flatMap(([, entries]) => entries);
        assert.ok(allowed.includes(roll.values['MASK TEMPERAMENT']));
    }
});
test('sexuality defaults to the gender rule and honours a pick', () => {
    const sexualities = PRE_ROLL_CHANNELS.find(c => c.key === 'SEXUALITY');
    assert.match(rollPreRoll({ seed: 2 }).values.SEXUALITY, /Bisexual for a female card/);
    assert.strictEqual(rollPreRoll({ seed: 2, steer: { SEXUALITY: 'Gay' } }).values.SEXUALITY, 'Gay');
    assert.ok(sexualities.entries.includes('Heterosexual'));
});
test('an experience tier draws within itself and filters by orientation', () => {
    for (let seed = 1; seed <= 10; seed++) {
        const roll = rollPreRoll({ seed, steer: { SOURCE: 'experienced', SEXUALITY: 'Lesbian' } });
        assert.ok(sourceChannel.groups.experienced.includes(roll.values['SOURCE OF EXPERIENCE']));
        const tag = sourceChannel.orientationTags[roll.values['SOURCE OF EXPERIENCE']];
        assert.notStrictEqual(tag, 'm', 'a lesbian card got a man-only act');
    }
    assert.ok(sourceChannel.groups.experienced.some(entry => sourceChannel.orientationTags[entry] === 'm'));
});

test('places are tagged and follow the theme', () => {
    const place = WORLD_CHANNELS.find(c => c.key === 'PLACE');
    for (const entry of place.entries) assert.ok(place.kinds[entry], `untagged place: ${entry}`);
    assert.strictEqual(new Set(Object.values(place.kinds)).size >= 8, true, 'too few place kinds');
    assert.strictEqual(Object.keys(THEME_PLACE_KINDS).length, WORLD_THEMES.length, 'a theme has no allowed places');
    for (const theme of WORLD_THEMES) {
        const allowed = THEME_PLACE_KINDS[theme.label];
        assert.ok(allowed.length && place.entries.some(entry => allowed.includes(place.kinds[entry])), theme.label + ' has no fitting place');
    }
    const suburban = WORLD_THEMES.find(theme => theme.label === 'Suburban night').text;
    for (let seed = 1; seed <= 12; seed++) {
        const rolled = rollPreRoll({ seed, type: 'world', steer: { THEME: suburban } }).values.PLACE;
        assert.notStrictEqual(place.kinds[rolled], 'island', 'Suburban night still lands on an island');
    }
});
test('scale follows the theme and is written into the description', () => {
    const scale = WORLD_CHANNELS.find(c => c.key === 'SCALE');
    assert.strictEqual(scale.entries.length, 5);
    assert.strictEqual(Object.keys(THEME_SCALES).length, WORLD_THEMES.length, 'a theme has no allowed scales');
    const suburban = WORLD_THEMES.find(theme => theme.label === 'Suburban night').text;
    for (let seed = 1; seed <= 12; seed++) {
        const rolled = rollPreRoll({ seed, type: 'world', steer: { THEME: suburban } }).values.SCALE;
        assert.match(rolled, /metro suburb/, 'Suburban night got ' + rolled);
    }
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('the PLACE and SCALE in one sentence'), 'description does not lead with scale');
});

test('season follows the theme too', () => {
    assert.strictEqual(Object.keys(THEME_SEASONS).length, WORLD_THEMES.length, 'a theme has no allowed seasons');
    const summer = WORLD_THEMES.find(theme => theme.label === 'Endless summer').text;
    for (let seed = 1; seed <= 10; seed++) {
        const rolled = rollPreRoll({ seed, type: 'world', steer: { THEME: summer } }).values.SEASON;
        assert.match(rolled, /summer|festival/, 'Endless summer got ' + rolled);
    }
});

test('NPC genitals have proportions and kinks are explained', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('length and girth in inches'), 'cock size rule missing');
    assert.ok(world.includes('labia shape and size'), 'female proportions missing');
    assert.ok(world.includes('A bare noun is not a kink'), 'kink explanation rule missing');
    assert.ok(world.includes('Creampies — wants a cock to pulse'), 'worked kink example missing');
    assert.ok(world.includes('not biography'), 'fantasy-not-habit rule missing');
    assert.ok(world.includes('filled with what'), 'noun-resolution rule missing');
    assert.ok(world.includes('two cocks at once'), 'explicit example missing');
});

test('worlds get a premise, voice, cast and levers', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    for (const phrase of ['GIVE {{user}} A REASON TO BE HERE', 'A sandbox needs an entry point', 'SANDBOX LEVERS', 'a knowledge route', '\"Cast:\"', 'plain facts, not prose', '\"Quirks:\"']) {
        assert.ok(world.includes(phrase), 'missing: ' + phrase);
    }
    assert.ok(world.includes('Competence, clipboard duty'), 'quirk/kink split missing');
});

test('NSFL changes the consent contract', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('consent is also negotiable rather than assumed'), 'consent-by-NSFL rule missing');
    assert.ok(world.includes('CNC'), 'CNC missing');
    assert.ok(world.includes('With NSFL off, the default is ask first'), 'consent-first default missing');
    assert.ok(world.includes('NPCs may act before asking'), 'NSFL acting rule missing');
});

test('kinks are recognisable sexual appetites, not duties', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    for (const phrase of ['if it could be a hobby, a job or a social skill', 'Name the recognised kink', 'exhibitionism', 'breath play', 'hair-pulling', 'dom/sub', 'Competence, clipboard duty']) {
        assert.ok(world.includes(phrase), 'missing: ' + phrase);
    }
    assert.ok(!world.includes('Kinks: Being in charge at a door'), 'old duty-style example still present');
});

test('memorable NPC features are varied', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('vary what it is'), 'feature variety rule missing');
    assert.ok(world.includes('Do not give every NPC a scar or a chipped tooth'), 'anti-common quirk rule missing');
});

test('world length allows 700 and remembers recent bones', () => {
    const src = fs.readFileSync(path.join(root, 'world.js'), 'utf8');
    const world = extractTemplate(src, 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('Roughly 300-700 words'), 'length cap too low');
    assert.ok(src.includes("Keep the card's description to 700 words"), 'request cap too low');
    assert.ok(src.includes('Do not reuse their bones'), 'recent-bones instruction missing');
    assert.ok(src.includes('recentWorldBones(excludeDraftId)'), 'bones not gathered');
    assert.ok(src.includes("'theme: '"), 'bones summary lacks theme');
    assert.ok(src.includes('getDrafts'));
});

test('the prompt does not prescribe the same skeleton', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    for (const phrase of ["DO NOT REUSE THE LAST WORLD'S BONES", 'Give one or two pressures', 'Some entries should be open-ended', 'Zero is allowed', 'Only what {{user}}\'s life actually needs']) {
        assert.ok(world.includes(phrase), 'missing: ' + phrase);
    }
    assert.ok(!world.includes('At least a third of the entries'), 'third-of-entries mandate still present');
});

test('money, jobs and fairs are not mandatory', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('Money is one option, not a slot to fill'));
    assert.ok(world.includes('if the details say no job, do not invent employment'));
    assert.ok(world.includes('no parade, no fairground'));
    assert.ok(world.includes('Money only when the place runs on it'));
    assert.ok(!THEME_SEASONS['Party town'].includes(8), 'Party town still draws the festival season');
    const seasons = WORLD_CHANNELS.find(c => c.key === 'SEASON').entries;
    assert.ok(seasons[14], 'party Friday season missing');
});

test('NSFW is heat and NSFL is harm, not illness', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    for (const phrase of ['NSFW is heat', 'NSFL is harm and risk', 'roofies in a drink', 'NSFL is not an illness', 'THE CRUTCHES', 'Bonfires need somewhere to burn']) {
        assert.ok(world.includes(phrase), 'missing: ' + phrase);
    }
});

test('Party town varies its venues and powers', () => {
    const theme = WORLD_THEMES.find(t => t.label === 'Party town').text;
    assert.ok(theme.includes('house parties'), 'theme lost house parties');
    assert.ok(!theme.includes('rented hall'), 'theme still pushes a hall');
    assert.ok(THEME_PLACE_KINDS['Party town'].includes('partyrural'), 'no county-road venue');
    assert.ok(WORLD_CHANNELS.find(c => c.key === 'POWER').entries.some(e => /sisters own both bars/.test(e)), 'no non-priest power');
    const seasons = WORLD_CHANNELS.find(c => c.key === 'SEASON').entries;
    assert.ok(seasons[12] && seasons[13], 'party seasons missing');
});

test('steer details and a teenager-scale premise survive', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes("Everything the user's details state is canon"), 'steer fidelity rule missing');
    assert.ok(world.includes('both named parents'), 'parent obligation missing');
    assert.ok(world.includes('one look; one hook'), 'look in cast missing');
    assert.ok(world.includes('read attractive in their own way'), 'cast attractiveness missing');
    assert.ok(world.includes("at {{user}}'s own scale"), 'teen-scale pressure missing');
    assert.ok(world.includes('not the town master plan'), 'premise scale missing');
});

test('world pressures reach the user and people look like people', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('Some of it reaches {{user}} through friends, family, school'), 'personal stakes missing');
    assert.ok(world.includes('do not write that none of the pressures concern her'), 'anti-indifference guard missing');
    assert.ok(world.includes('warm, funny or easy beat'), 'warm opening beat missing');
    assert.ok(world.includes('attractive in their own way'), 'NPC attractiveness rule missing');
    const kinds = THEME_PLACE_KINDS['Party town'];
    assert.ok(kinds.includes('nightlife'), 'Party town cannot draw a nightlife place');
    assert.ok(WORLD_CHANNELS.find(c => c.key === 'PLACE').entries.some(e => /party strip|bowling alley/.test(e)), 'no playful places');
});

test('experience sources are act lists by tier', () => {
    const source = PRE_ROLL_CHANNELS.find(c => c.key === 'SOURCE OF EXPERIENCE');
    for (const line of Object.values(source.groups).flat()) {
        assert.ok(!/happy to keep|flinches|half remembers|long enough/.test(line), 'mood in act list: ' + line);
    }
    for (const line of source.groups.virgin) {
        assert.match(line, /^Virgin: masturbation/, 'virgin line is not masturbation only: ' + line);
        assert.ok(!/oral|fingering/.test(line), 'virgin line has partner acts: ' + line);
    }
    for (const line of Object.values(source.groups).flat().filter(l => !l.startsWith('Virgin'))) {
        assert.match(line, /^Masturbation/, 'non-virgin line does not lead with an act: ' + line);
    }
});

test('there is a virgin-with-some-experience tier', () => {
    const source = PRE_ROLL_CHANNELS.find(c => c.key === 'SOURCE OF EXPERIENCE');
    assert.ok(source.groups.virgin_some, 'tier missing');
    assert.ok(source.groups.virgin_some.every(line => !/vaginal|anal/.test(line)), 'penetration in a technical virgin line');
    assert.ok(source.groups.virgin_some.some(line => /oral/.test(line)), 'no oral in the technical virgin tier');
    assert.ok(source.groups.some.length >= 6, 'some tier is still rigid');
});

test('texture includes modern technology', () => {
    const texture = WORLD_CHANNELS.find(c => c.key === 'TEXTURE').entries.join(' ');
    assert.ok(/phone|group chat/i.test(texture), 'no modern phone texture');
    assert.ok(/coffee|speaker/i.test(texture), 'no modern teenage texture');
});

test('openings and pressures are derived, not catalogued', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('INVENT THE PRESSURE AND THE OPENING'), 'derivation section missing');
    assert.ok(world.includes('Derive pressure from what the theme makes scarce'), 'derivation rule missing');
    assert.ok(world.includes('Vary its shape between worlds'), 'opening variation missing');
    assert.match(world, /not necessarily a problem/i);
    assert.ok(!WORLD_CHANNELS.some(c => c.key === 'PRESSURE' || c.key === 'OPENING'), 'catalogue channels still present');
});

test('positive themes exist and every world needs a pleasure', () => {
    for (const label of ['Endless summer', 'Pool-and-cookout suburb', 'Festival week', 'Party town', 'Holiday resort', 'Main-street revival']) {
        assert.ok(WORLD_THEMES.some(theme => theme.label === label), 'positive theme missing: ' + label);
    }
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('Every world needs a pleasure'), 'pleasure rule missing');
    assert.ok(world.includes('Not every world is a town with a problem'), 'non-problem worlds missing');
});

test('the world prompt stays mixed and leaves creative room', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('TONE — MIXED, NOT BLEAK'), 'tone guidance missing');
    assert.ok(world.includes('CREATIVE LIBERTY'), 'creative liberty guidance missing');
    assert.ok(world.includes('Start in motion'), 'opening variation missing');
    assert.ok(world.includes('Use at most one explicit nod to the persona'), 'persona-trait limit missing');
    assert.ok(!world.includes('Include one line on what the world does not care about'), 'old formula line still demanded');
    assert.ok(WORLD_THEMES.find(theme => theme.label === 'Suburban night').text.includes('twenty minutes from a city'), 'suburban theme should describe a city suburb');
});

test('greetings split on --- and descriptions stay legible', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('one per array element'), 'array-per-greeting rule missing');
    assert.ok(world.includes('line containing only ---'), 'fallback separator instruction missing');
    assert.ok(world.includes('At most four named people in the prose'), 'name budget missing');
    assert.ok(world.includes('Let it breathe'), 'breathing room missing');
    assert.ok(world.includes('Roughly 300-700 words'), 'foundation budget wrong');
    assert.ok(world.includes('foundations, not a rulebook'), 'rulebook guard missing');
    assert.ok(world.includes('Skip administration'), 'admin guard missing');
    assert.ok(world.includes('Do not recap the persona'), 'creator notes rule missing');
    assert.match(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), /function splitGreetings/);
    assert.match(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), /function splitGreetings/);
});

test('NPC entries carry body and appetite when NSFW is on', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('When WORLD RULES says NSFW on'), 'NSFW has no effect on NPC entries');
    assert.ok(world.includes('"Body:"'), 'Body line missing');
    assert.ok(world.includes('"Genitals:"'), 'Genitals line missing');
    assert.ok(world.includes('"Sexuality:"'), 'Sexuality line missing');
    assert.ok(world.includes('"Kinks:"'), 'Kinks line missing');
    assert.ok(world.includes('150-240 words when NSFW is on'), 'length allowance missing');
});

test('NPC entries must be self-contained', () => {
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('The title is a label only and is not sent to the model'), 'title dependency not stated');
    assert.ok(world.includes('Name: full name. Age: n.'), 'named NPC lines missing');
    assert.ok(world.includes('Do not compress away the name, the age or the body'), 'NPC look requirement missing');
});

test('Suburban night exists and world consequences are spelled out', () => {
    assert.ok(WORLD_THEMES.some(theme => theme.label === 'Suburban night'), 'Suburban night theme missing');
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(world.includes('REAL CONSEQUENCES, NO PROTAGONIST PRIVILEGE'), 'consequence guidance missing');
    assert.ok(world.includes('Bad choices compound'), 'consequence examples missing');
    assert.ok(world.includes('WORLD RULES LINE'), 'rules line guidance missing');
});

test('the prompts say theme is atmosphere and ask for nuance', () => {
    const character = extractTemplate(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), 'DEFAULT_CHARACTER_PROMPT');
    const world = extractTemplate(fs.readFileSync(path.join(root, 'world.js'), 'utf8'), 'DEFAULT_WORLD_PROMPT');
    assert.ok(character.includes('CHARACTER THEME is atmosphere, not costume'), 'character theme guidance missing');
    assert.ok(character.includes('Nuance is the job'), 'character nuance guidance missing');
    assert.ok(world.includes('THEME IS PRESSURE, NOT COSTUME'), 'world theme guidance missing');
    assert.ok(world.includes('REALISM — THE WORLD HAS TO PAY ITS BILLS'), 'world realism guidance missing');
    assert.ok(world.includes('NSFW AND NSFL'), 'world NSFW guidance missing');
});

test('an unknown type falls back to the persona set instead of crashing', () => {
    assert.deepStrictEqual(channelsFor('nonsense'), PRE_ROLL_CHANNELS);
    assert.ok(formatPreRoll(rollPreRoll({ seed: 1, type: 'nonsense' }).values, 'nonsense').includes('MASK TEMPERAMENT'));
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
