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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = path.join(root, '.local');
fs.mkdirSync(scratch, { recursive: true });

// quality.js is a browser ES module and this repo has no package.json, so Node would treat .js as
// CommonJS. Copy it to .mjs so the real file can be imported rather than a reimplementation.
const qualityCopy = path.join(scratch, 'quality.mjs');
fs.copyFileSync(path.join(root, 'quality.js'), qualityCopy);
const quality = await import('file://' + qualityCopy + '?t=' + Date.now());

const NO_QUESTION_ENDING = 'End on a concrete beat (an action, a line of dialogue, or something happening) that {{user}} can react to. Never end with a question to the player such as "What do you do?", "What\'s your next move?" or "How do you respond?".';

/**
 * Extracts the source of `NAME = [...]` / `NAME = `...`` from a module, scanning past brackets and
 * backticks that appear inside string literals. A naive bracket counter stops early on text like
 * `"...[old line, new line]..."`, which silently truncated the world table to two of its entries.
 * @param {string} src Module source.
 * @param {string} name Declaration name.
 * @param {'array'|'template'} kind What to extract.
 * @returns {string|null} The literal source, ready for eval or template interpolation.
 */
function extractLiteral(src, name, kind) {
    const decl = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const ${name} = `);
    const found = decl.exec(src);
    if (!found) return null;
    let i = found.index + found[0].length;

    // Skip to the opening token, allowing wrappers such as migrateReviewPrompt(`...`).
    while (i < src.length && src[i] !== '[' && src[i] !== '`') i++;
    if (i >= src.length) return null;

    const open = src[i];
    const close = open === '[' ? ']' : '`';
    const start = i + 1;
    let depth = 1;
    i = start;
    while (i < src.length) {
        const c = src[i];
        if (c === '\\') { i += 2; continue; }
        if (open === '`' && c === '`') break;           // end of template
        if (open === '[') {
            if (c === "'" || c === '"' || c === '`') {  // skip string contents
                const quote = c;
                i++;
                while (i < src.length && src[i] !== quote) { if (src[i] === '\\') i++; i++; }
                i++;
                continue;
            }
            if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
            if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
            if (c === '[') depth++;
            else if (c === ']') { depth--; if (depth === 0) break; }
        }
        i++;
    }
    if (kind === 'template') return src.slice(start, i);
    return src.slice(start, i);
}

const extractArray = (src, name) => {
    const body = extractLiteral(src, name, 'array');
    return body === null ? null : '[' + body + ']';
};
const extractTemplate = (src, defName) => extractLiteral(src, defName, 'template');

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
test('a line the user edited is left alone', () => {
    const edited = 'my own playability wording, untouched';
    assert.strictEqual(quality.applyLineMigrations(edited, reviewPairs), edited);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
