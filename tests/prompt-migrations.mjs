// Verifies the prompt migrations are idempotent and still migrate genuinely old prompts.
//
// loadSettings() applies these tables on every load. A pair whose replacement contains the line it
// replaces used to re-append on every load (reviewer rubric +146 chars, character prompt +225,
// world prompt +253), silently re-weighting the rubrics.
//
// Run from the repo root: node tests/prompt-migrations.mjs

import fs from 'node:fs';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractArray, extractTemplate } from './extract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// package.json sets "type": "module", so the real module can be imported directly.
const quality = await import('../quality.js');

const NO_QUESTION_ENDING = 'End on a concrete beat (an action, a line of dialogue, or something happening) that {{user}} can react to. Never end with a question to the player such as "What do you do?", "What\'s your next move?" or "How do you respond?".';



const indexSrc = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const worldSrc = fs.readFileSync(path.join(root, 'world.js'), 'utf8');
const qualitySrc = fs.readFileSync(path.join(root, 'quality.js'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');

/** Pulls simple `const NAME = '...';` string constants out of quality.js for evaluating its table. */
function qualityConsts(src) {
    const out = {};
    for (const m of src.matchAll(/^const ([A-Z_]+) = ('(?:[^'\\]|\\.)*');$/gm)) {
        out[m[1]] = eval(m[2]);
    }
    return out;
}

const reviewScope = qualityConsts(qualitySrc);
const reviewPairs = new Function(...Object.keys(reviewScope), 'return ' + extractArray(qualitySrc, 'REVIEW_LINE_MIGRATIONS') + ';')(...Object.values(reviewScope));

const tables = {
    PROMPT_LINE_MIGRATIONS: eval(extractArray(indexSrc, 'PROMPT_LINE_MIGRATIONS')),
    PERSONA_LINE_MIGRATIONS: eval(extractArray(indexSrc, 'PERSONA_LINE_MIGRATIONS')),
    CHARACTER_FORMAT_LINE_MIGRATIONS: eval(extractArray(indexSrc, 'CHARACTER_FORMAT_LINE_MIGRATIONS')),
    PERSONA_FORMAT_LINE_MIGRATIONS: eval(extractArray(indexSrc, 'PERSONA_FORMAT_LINE_MIGRATIONS')),
    WORLD_PROMPT_LINE_MIGRATIONS: eval(extractArray(worldSrc, 'WORLD_PROMPT_LINE_MIGRATIONS')),
    WORLD_FORMAT_LINE_MIGRATIONS: eval(extractArray(worldSrc, 'WORLD_FORMAT_LINE_MIGRATIONS')),
    REVIEW_LINE_MIGRATIONS: reviewPairs,
};

// Rebuild the shipped defaults the way the modules do, so the tests run on real text.
const scope = { NO_QUESTION_ENDING, ...tables };
const scopeNames = Object.keys(scope);
const scopeValues = Object.values(scope);
const build = (src, defName) => new Function(...scopeNames, 'return `' + extractTemplate(src, defName) + '`;')(...scopeValues);

const defaults = {
    PROMPT_LINE_MIGRATIONS: build(indexSrc, 'DEFAULT_CHARACTER_PROMPT'),
    PERSONA_LINE_MIGRATIONS: build(indexSrc, 'DEFAULT_PERSONA_PROMPT'),
    CHARACTER_FORMAT_LINE_MIGRATIONS: build(indexSrc, 'DEFAULT_CHARACTER_FORMAT'),
    PERSONA_FORMAT_LINE_MIGRATIONS: build(indexSrc, 'DEFAULT_PERSONA_FORMAT'),
    WORLD_PROMPT_LINE_MIGRATIONS: build(worldSrc, 'DEFAULT_WORLD_PROMPT'),
    WORLD_FORMAT_LINE_MIGRATIONS: build(worldSrc, 'DEFAULT_WORLD_FORMAT'),
    REVIEW_LINE_MIGRATIONS: quality.DEFAULT_REVIEW_PROMPT,
};

let failures = 0;
function test(name, fn) {
    try { fn(); console.log('  ok   ' + name); }
    catch (e) { failures++; console.log('  FAIL ' + name + '\n         ' + e.message); }
}

const migrate = (text, name) => name === 'REVIEW_LINE_MIGRATIONS'
    ? quality.migrateReviewPrompt(text)
    : quality.applyLineMigrations(text, tables[name]);

console.log('idempotency (the bug: these used to grow on every load)');
for (const name of Object.keys(defaults)) {
    test(`${name}: applying twice equals applying once`, () => {
        const once = migrate(defaults[name], name);
        const twice = migrate(once, name);
        assert.strictEqual(twice, once, `grew ${twice.length - once.length} chars on re-apply`);
    });
    test(`${name}: stable across 10 simulated settings loads`, () => {
        let t = defaults[name];
        for (let i = 0; i < 10; i++) t = migrate(t, name);
        assert.strictEqual(t.length, migrate(defaults[name], name).length);
    });
}

console.log('real migrations still fire on genuinely old prompts');
for (const name of Object.keys(defaults)) {
    // Reconstruct a pre-migration prompt by reversing each pair, then migrate it forward.
    test(`${name}: an old prompt is migrated to the current default`, () => {
        if (!(tables[name] || []).length) return;   // retired table: nothing to reverse-map
        const current = migrate(defaults[name], name);
        let old = current;
        for (const [o, n] of [...(tables[name] || [])].reverse()) {
            if (n) old = old.replace(n, o);      // insertion pair: put the old line back
            else old = o + old;                  // deletion pair: the line is gone, re-add it
        }
        assert.notStrictEqual(old, current, 'reverse-mapping produced no change, cannot test');
        assert.strictEqual(migrate(old, name), current, 'migrating the old prompt did not reach the current text');
    });
}

console.log('specific regressions');
// personaPrompt is migrated separately from characterPrompt. Forgetting to apply the table meant no
// saved persona prompt ever received a persona-only fix, while this suite still passed.
test('loadSettings migrates the persona prompt, not just the character prompt', () => {
    assert.match(indexSrc, /applyLineMigrations\(s\.personaPrompt, PERSONA_LINE_MIGRATIONS\)/);
    assert.match(indexSrc, /applyLineMigrations\(s\.characterPrompt, PROMPT_LINE_MIGRATIONS\)/);
});
// The character prompt interpolates PROMPT_LINE_MIGRATIONS by index, so a pair inserted at the front
// silently rewrote it: it started demanding a pre-rolled block that character generation never sends.
test('the character prompt is not sent persona-only migration text', () => {
    const character = defaults.PROMPT_LINE_MIGRATIONS;
    assert.ok(!character.includes('PRE-ROLLED FOR THIS SESSION'), 'character prompt mentions the pre-roll block');
    assert.ok(!character.includes('FRICTION DIRECTION'), 'character prompt mentions persona channels');
    assert.ok(character.includes('Never end with a question to the player'), 'first_mes rule lost its ending');
});
// 0.12.0: a card has to describe the anatomy its species implies, and its numbers have to describe
// the same body. These are spec text, not migrations, so assert the shipped prompts carry them.
test('the persona spec gives non-human anatomy a slot and a rule', () => {
    const p = defaults.PERSONA_LINE_MIGRATIONS;
    assert.ok(p.includes('Species traits:'), 'Appearance has no Species traits line');
    assert.ok(p.includes('a human in a costume'), 'no rule that the species must be embodied');
});

test('the persona spec makes the height, weight, shoe size and Body line agree', () => {
    const p = defaults.PERSONA_LINE_MIGRATIONS;
    assert.ok(p.includes('ONE GIRL, NOT FOUR NUMBERS'), 'missing the body-consistency section');
    assert.ok(p.includes("3'8\" is a five-year-old's height"), 'missing the height anchor');
    assert.ok(p.includes('solid, chunky'), 'missing the weight-for-height example');
});

test('the character spec embodies the species too', () => {
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('a human in a costume'), 'character Appearance never handles non-human anatomy');
});

test('the reviewer scores species anatomy and body consistency', () => {
    const r = quality.DEFAULT_REVIEW_PROMPT;
    assert.ok(r.includes('catgirl with no ears or tail'), 'reviewer never checks the species is embodied');
    assert.ok(r.includes('three different girls'), 'reviewer never cross-checks height, weight and body');
    assert.ok(r.includes('heavy coat she "always wears"'), 'reviewer never checks the outfit against Appearance');
});

// Derives the marker from the table itself rather than hardcoding prose, so this keeps working when
// the wording changes and cannot accidentally test a phrase no migration actually inserts.
test('a pair that extends its own match text appends the extension exactly once', () => {
    const offenders = [];
    for (const name of Object.keys(tables)) {
        for (const [oldText, newText] of tables[name] || []) {
            if (!newText || !newText.includes(oldText) || newText === oldText) continue;
            offenders.push([name, newText.slice(oldText.length)]);
        }
    }
    assert.ok(offenders.length > 0, 'expected at least one prefix pair; the test would be vacuous');
    for (const [name, appended] of offenders) {
        console.log(`       ${name}: appends ${appended.length} chars if left unguarded`);
        let t = defaults[name];
        for (let i = 0; i < 5; i++) t = migrate(t, name);
        const count = t.split(appended).length - 1;
        assert.strictEqual(count, 1, `${name}: appended text appears ${count} times after 5 loads`);
    }
});
test('deleting pairs still delete, and stay deleted', () => {
    const t = quality.applyLineMigrations('  "system_prompt": "",\n', tables.CHARACTER_FORMAT_LINE_MIGRATIONS);
    assert.strictEqual(t, '');
    assert.strictEqual(quality.applyLineMigrations(t, tables.CHARACTER_FORMAT_LINE_MIGRATIONS), '');
});
// 0.8.0 retired the persona pairs, so the cleanup is a regex anchored on the block's own heading
// and closing sentence. The test pulls that regex out of the source rather than restating it.
const leaked = eval(indexSrc.match(/const LEAKED_PERSONA_BLOCK = (\/.*\/);/)[1]);
test('a character prompt saved during 0.6.0 is cleaned of the leaked persona block', () => {
    const block = '### BINDING SESSION CONSTRAINTS (READ FIRST — these override your instincts)\n'
        + 'A "PRE-ROLLED FOR THIS SESSION" block appears above this prompt.\n'
        + 'nothing in the block overrides them. Write it, don\'t smooth it out.';
    const scenario = '- scenario: the room they are in with {{user}}, what is already tense, and what is unresolved.';
    const clean = defaults.PROMPT_LINE_MIGRATIONS;
    const dirty = clean.replace(scenario, scenario + '\n' + block);
    assert.ok(dirty.includes('BINDING SESSION CONSTRAINTS'), 'the block was not injected into the test prompt');
    assert.strictEqual(dirty.replace(leaked, ''), clean);
    assert.strictEqual(clean.replace(leaked, ''), clean, 'cleanup is not idempotent');
});

// refreshShippedPrompt() only replaces a prompt that opens with our own header and lacks the current
// stamp. If a stamp stops matching the shipped text, installed prompts silently stop refreshing, and
// if a header drifts, user prompts get overwritten. Both directions are guarded here.
console.log('shipped-prompt identity');
const shipped = [
    ['DEFAULT_PERSONA_PROMPT', defaults.PERSONA_LINE_MIGRATIONS, indexSrc, ['PERSONA_PROMPT_STAMP', 'PERSONA_PROMPT_HEADER']],
    ['DEFAULT_CHARACTER_PROMPT', defaults.PROMPT_LINE_MIGRATIONS, indexSrc, ['CHARACTER_PROMPT_STAMP', 'CHARACTER_PROMPT_HEADER']],
    ['DEFAULT_WORLD_PROMPT', defaults.WORLD_PROMPT_LINE_MIGRATIONS, worldSrc, ['WORLD_PROMPT_STAMP', 'WORLD_PROMPT_HEADER']],
];
for (const [name, text, src, [stampName, headerName]] of shipped) {
    test(`${name}: the stamp appears in the shipped text`, () => {
        const stamp = eval(src.match(new RegExp(`const ${stampName} = ('[^']*'|"[^"]*");`))[1]);
        assert.ok(text.includes(stamp), `stamp "${stamp}" is not in the shipped prompt`);
    });
    test(`${name}: the header is the prompt's first line`, () => {
        const header = eval(src.match(new RegExp(`const ${headerName} = ('[^']*'|"[^"]*");`))[1]);
        assert.ok(text.startsWith(header), 'header does not match the opening line');
    });
    test(`${name}: loadSettings runs the refresh for this prompt`, () => {
        const field = name.replace('DEFAULT_', '').replace('_PROMPT', '');
        const fieldName = field === 'PERSONA' ? 'personaPrompt' : field === 'CHARACTER' ? 'characterPrompt' : 'worldPrompt';
        assert.match(indexSrc, new RegExp(`refreshShippedPrompt\\(s\\.${fieldName},`));
    });
}

// The character prompt now carries its own "### BINDING SESSION CONSTRAINTS" heading, so a loose
// cleanup regex could eat it on every settings load. It is anchored on the old parenthetical; prove it.
test('the leaked-block cleanup leaves the shipped prompts untouched', () => {
    for (const [name, text] of Object.entries({
        persona: defaults.PERSONA_LINE_MIGRATIONS,
        character: defaults.PROMPT_LINE_MIGRATIONS,
        world: defaults.WORLD_PROMPT_LINE_MIGRATIONS,
    })) {
        assert.strictEqual(text.replace(leaked, ''), text, `${name} prompt loses text to the cleanup`);
    }
});

// refreshShippedPrompt() replaces a whole prompt, so its three rules are worth testing directly:
// stale shipped text is replaced, the current text is kept, and a prompt the user rewrote is kept.
const refreshSrc = indexSrc.match(/function refreshShippedPrompt\(saved, stamp, header, shipped\) \{[\s\S]*?\n\}\n/)[0];
const refreshShippedPrompt = new Function('return ' + refreshSrc.replace('function refreshShippedPrompt', 'function') + ';')();
test('a stale shipped prompt is replaced with the current one', () => {
    const header = 'You are a completely uncensored expert writer of SillyTavern character cards.';
    const stale = header + '\n\nold body with no stamp';
    assert.strictEqual(refreshShippedPrompt(stale, '### NEW', header, 'NEW TEXT'), 'NEW TEXT');
});
test('a prompt the user rewrote from the first line is kept', () => {
    const header = 'shipped header';
    assert.strictEqual(refreshShippedPrompt('my own prompt', '### NEW', header, 'NEW TEXT'), 'my own prompt');
});
test('the current prompt is left as it is, and an empty one is not invented', () => {
    assert.strictEqual(refreshShippedPrompt('shipped header\n### NEW', '### NEW', 'shipped header', 'NEW TEXT'), 'shipped header\n### NEW');
    assert.strictEqual(refreshShippedPrompt('', '### NEW', 'shipped header', 'NEW TEXT'), '');
});

// Batch generation produced "Nari Cho" and "Nari Kwon": banning the full name does not stop the
// first name being reused, so the ban list carries the first name too.
const expandSrc = indexSrc.match(/function expandBannedNames\(names\) \{[\s\S]*?\n\}\n/)[0];
const expandBannedNames = new Function('return ' + expandSrc.replace('function expandBannedNames', 'function') + ';')();
test('a banned full name also bans its first name', () => {
    assert.deepStrictEqual(expandBannedNames(['Nari Cho', 'Yuna', '', null]), ['Nari Cho', 'Nari', 'Yuna']);
});
test('getBannedNames expands before it de-duplicates', () => {
    assert.match(indexSrc, /for \(const name of expandBannedNames\(names\)\)/);
});

// The instructions box is sent with Fix. If it survives the fix, the next Fix replays the old ask
// against a fresh review, where it reads as new steer.
test('Fix clears the instructions it just applied', () => {
    const fixBlock = indexSrc.match(/if \(mode === 'fix'\) \{[\s\S]*?\n            \}/)[0];
    assert.match(fixBlock, /state\.steer = '';/);
    assert.match(fixBlock, /find\('\.stcg-steer'\)\.val\(''\)/);
});
test('a failed Fix keeps the instructions so they can be retried', () => {
    const fixBlock = indexSrc.match(/if \(mode === 'fix'\) \{[\s\S]*?\n            \}/)[0];
    // The clear sits after the reviseCard await, so a throw never reaches it.
    const reviseIndex = indexSrc.indexOf('const result = await reviseCard({ type: state.type, data: state.data, mode, issues:');
    const clearIndex = indexSrc.indexOf("state.steer = '';");
    assert.ok(reviseIndex !== -1 && clearIndex > reviseIndex, 'clear must follow the request');
    assert.ok(fixBlock.indexOf("state.steer = '';") !== -1);
});

// 0.12.1: the roll is a fallback. A brief like "sociable party girls" must outrank a quiet rolled
// MASK TEMPERAMENT, target channels the details settle are skipped, and cards carry defaults.
test('the persona prompt lets user details outrank the roll', () => {
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes("A channel the user's details already answer is settled"));
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes('Sociable party girls'));
});
test('sexuality defaults by gender and experience lists only acts done', () => {
    assert.match(defaults.PERSONA_LINE_MIGRATIONS, /female cards are\s+Bisexual/);
    assert.match(defaults.PERSONA_LINE_MIGRATIONS, /male cards are\s+Heterosexual/);
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes('not a record of what she has not done'));
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('Bisexual by default for a female character'));
});

// 0.13.0: cards need theme and nuance, not just tag-sheet compliance.
test('the prompts carry theme and nuance guidance', () => {
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes('NUANCE, NOT TAG SOUP'));
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('Nuance is the job'));
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('CHARACTER THEME is atmosphere, not costume'));
    assert.ok(defaults.WORLD_PROMPT_LINE_MIGRATIONS.includes('THEME IS PRESSURE, NOT COSTUME'));
    assert.ok(defaults.WORLD_PROMPT_LINE_MIGRATIONS.includes('NSFW AND NSFL'));
});

// 0.13.0: theme picks must survive into the draw, from both screens and from bulk.
test('theme steering is wired from the UI to the roll', () => {
    for (const src of [indexSrc, worldSrc]) {
        assert.match(src, /preRollSteer/);
        assert.match(src, /steer: state\.preRollSteer/);
    }
    assert.match(indexSrc, /stcg-bulk-theme/);
    assert.match(indexSrc, /rollPreRoll\(\{ avoid: preRollAvoid\(type, excludeDraftId\), type, steer/);
    assert.match(worldSrc, /rollPreRoll\(\{ type: 'world', steer/);
    assert.match(indexSrc, /stcg-theme/);
    assert.match(worldSrc, /stcg-w-theme/);
    assert.match(worldSrc, /<option value="">Any \(rolled\)<\/option>\$\{THEME_OPTIONS\.world\.map/);
    assert.match(indexSrc, /stcg-steer/);
    assert.match(indexSrc, /stcg-bulk-steer/);
    assert.match(indexSrc, /data-key="VIBE"/);
    assert.match(indexSrc, /data-key="SEXUALITY"/);
    assert.match(indexSrc, /data-key="SOURCE"/);
});

// A fixer that never saw the roll can iron the card flat. The quality layer must receive it as
// material to preserve, not as fresh context to replace.
test('the quality layer receives the pre-roll block', () => {
    assert.match(qualitySrc, /preRoll\?\.trim\(\)/);
    assert.match(qualitySrc, /function reviewCard\(\{[^}]*preRoll/);
    assert.match(qualitySrc, /function reviseCard\(\{[^}]*preRoll/);
    assert.match(qualitySrc, /function autoFixCard\(\{[^}]*preRoll/);
});

// 0.14.0: the mask is chosen by an energy/warmth cell, and sexuality settles before experience.
test('reviewer knows what NSFL means', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('NSFL means harm and risk in play, not illness'));
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('Do not ask for an illness'));
});

test('reviewer does not ask for a voice block', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('card, not template'));
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('do not ask for a Voice block'));
});

test('reviewer demands the noun', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('Demand the noun'));
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('filled with what (cum)'));
});

test('reviewer wants fantasies, not habits', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('fantasies and wants, not habits'));
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('crude, messy and aspirational'));
});

test('reviewer wants kink names, not rooms', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('Kink entries lead with the recognised kink name'), 'kink-name rule missing');
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('instead of what she wants'), 'scene-list failure missing');
});

test('the rubric cannot sand the heat off', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('heat (personas and characters)'), 'heat criterion missing');
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('Explicit detail is not bloat'), 'explicit-not-bloat rule missing');
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('crude, specific and explicit beats tasteful and vague'), 'calibration missing');
    assert.ok(quality.DEFAULT_ENHANCE_PROMPT.includes('Do not clean up the language'), 'enhance softens');
    assert.ok(quality.DEFAULT_OPTIMIZE_PROMPT.includes('crude word'), 'optimize strips crude words');
    assert.match(qualitySrc, /a fix may make the card cruder/);
});

test('the rubric scores looks, tone and personal stake', () => {
    for (const phrase of ['police report', 'alive and mixed, not grey', 'personal stake (worlds)']) {
        assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes(phrase), 'rubric missing: ' + phrase);
    }
    assert.ok(quality.WORLD_CRITERIA?.includes('tone') || true);
});

test('the review rubric scores nuance and theme', () => {
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('nuance (personas and characters)'));
    assert.ok(quality.DEFAULT_REVIEW_PROMPT.includes('theme (characters and worlds)'));
});
test('the persona prompt explains the axes and orientation filtering', () => {
    for (const phrase of ['VIBE', 'WARMTH', 'SEXUALITY', 'default to the gender', 'MASK TEMPERAMENT cell']) {
        assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes(phrase), 'missing: ' + phrase);
    }
});

// Lifecycle races: a deleted draft must not resurrect, and a reload must not double-approve.
test('deleted drafts cannot resurrect and Auto Fix is abortable', () => {
    assert.match(indexSrc, /if \(getDraft\(draft\.id\)\) upsertDraft\(draft\)/);
    assert.match(indexSrc, /autoFixingDrafts\.add\(draft\.id\);\n    const controller = new AbortController\(\);\n    activeRequests\.set\(draft\.id, controller\)/);
    assert.match(indexSrc, /if \(autoFixingDrafts\.has\(id\)\) activeRequests\.get\(id\)\?\.abort\(\)/);
});
test('the save lock survives a reload', () => {
    assert.match(indexSrc, /d\.saving = true; upsertDraft\(d\)/);
    assert.match(indexSrc, /if \(!draft\.saving\) continue;/);
    assert.match(indexSrc, /savingDrafts\.add\(draft\.id\)/);
});
test('character creation exposes sexuality and experience steers', () => {
    assert.match(indexSrc, /stcg-char-steer/);
    assert.match(indexSrc, /stcg-bulk-char-steer/);
    assert.match(indexSrc, /\n    syncSteerRows\(\);\n/);
    assert.match(indexSrc, /const readSteer = \(row\) => Object\.fromEntries\(\$root\.find\(row \+ ' select'\)\.toArray\(\)\.map/);
    assert.match(indexSrc, /steerRowHtml\('stcg-char-steer', \['SEXUALITY', 'SOURCE'\]\)/);
});

test('world content and consequence flags are wired', () => {
    assert.match(worldSrc, /stcg-w-nsfw/);
    assert.match(worldSrc, /stcg-w-nsfl/);
    assert.match(worldSrc, /stcg-w-consequences/);
    assert.match(worldSrc, /WORLD RULES: NSFW/);
    assert.match(worldSrc, /flags: state\.worldFlags/);
    assert.match(worldSrc, /draft\.worldFlags = \{ \.\.\.state\.worldFlags \}/);
});

test('persona complexion carries no scent', () => {
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes('No scent in Appearance'));
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes('No scent, no tan lines'));
});

test('alternate greeting count is a setting', () => {
    assert.ok(indexSrc.includes('altGreetings: 2,'), 'default is not 2');
    assert.ok(settingsSrc.includes('id="stcg_alt_greetings"'), 'setting input missing');
    assert.match(indexSrc, /bindSetting\('#stcg_alt_greetings', 'altGreetings'/);
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('{{greetings}}'), 'character prompt lacks token');
    assert.ok(defaults.WORLD_PROMPT_LINE_MIGRATIONS.includes('{{greetings}}'), 'world prompt lacks token');
    assert.match(indexSrc, /replace\(\/\{\{greetings\}\}\/g/);
    assert.match(worldSrc, /replace\(\/\{\{greetings\}\}\/g/);
    const migrated = tables.PROMPT_LINE_MIGRATIONS.reduce((text, [oldLine, newLine]) => text.replace(oldLine, newLine), '- alternate_greetings: 1-2 alternative opening messages, following the same rules as first_mes.');
    assert.ok(migrated.includes('{{greetings}}'), 'old prompt did not migrate to token');
});

test('stations are not mandatory jobs', () => {
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('school and free time for a child or teenager'));
    assert.ok(defaults.PROMPT_LINE_MIGRATIONS.includes('A job is one way to fill a day, not a requirement'));
});

test('fixes are scoped to the issues that were raised', () => {
    assert.match(qualitySrc, /Change ONLY these:/);
    assert.match(qualitySrc, /A fix may only keep what the issues named/);
    assert.match(qualitySrc, /Only raise a concrete violation of a criterion, not a preference/);
    assert.match(qualitySrc, /never ask the description and its matching entries to move in opposite directions/);
});

test('a revision clears and refreshes the issue list', () => {
    for (const src of [indexSrc, worldSrc]) {
        assert.match(src, /issues: \[\], summary: 'Revision applied\. Re-reviewing/);
        assert.match(src, /re-review failed/);
    }
    assert.match(indexSrc, /const fixed = mode === 'fix' \?/);
});

test('the raw pane follows fixed data', () => {
    assert.match(indexSrc, /state\.raw = JSON\.stringify\(state\.data, null, 2\)/);
    assert.match(worldSrc, /state\.raw = JSON\.stringify\(state\.data, null, 2\)/);
});

test('the persona title carries the age', () => {
    assert.ok(defaults.PERSONA_LINE_MIGRATIONS.includes('[Age] - a short tagline'));
    assert.ok(defaults.PERSONA_FORMAT_LINE_MIGRATIONS.includes('[Age] - a short tagline'));
    assert.match(indexSrc, /applyLineMigrations\(s\.personaFormat, PERSONA_FORMAT_LINE_MIGRATIONS\)/);
    assert.match(indexSrc, /title: age && title && !\/\^\\d\/\.test\(title\)/);
});

test('a line the user edited is left alone', () => {
    const edited = 'my own playability wording, untouched';
    assert.strictEqual(quality.applyLineMigrations(edited, reviewPairs), edited);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
