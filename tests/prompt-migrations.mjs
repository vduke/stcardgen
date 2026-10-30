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

test('a line the user edited is left alone', () => {
    const edited = 'my own playability wording, untouched';
    assert.strictEqual(quality.applyLineMigrations(edited, reviewPairs), edited);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
