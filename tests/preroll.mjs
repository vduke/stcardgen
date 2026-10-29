// Checks the pre-roll tables and block rendering.
//
// The pre-roll exists to stop a batch of personas converging on the same character. Two things can
// quietly break that: a table that reuses the model's default and unfavourable habits, and a block
// that fails to name every channel. Both are checked here.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRE_ROLL_CHANNELS, rollPreRoll, formatPreRoll, parsePreRoll } from '../preroll.js';
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
        assert.ok(channel.entries.length >= 12, `${channel.key} has only ${channel.entries.length}`);
        assert.strictEqual(new Set(channel.entries).size, channel.entries.length, `${channel.key} has duplicate entries`);
    }
});
test('the prompt is told about exactly the channels that are rolled', () => {
    const prompt = extractTemplate(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), 'DEFAULT_PERSONA_PROMPT');
    for (const channel of PRE_ROLL_CHANNELS) {
        assert.ok(prompt.includes(channel.label), `prompt never names ${channel.label}`);
    }
    // Appearance must not be pre-rolled: the image is the authority on it.
    const binding = prompt.slice(prompt.indexOf('BINDING SESSION CONSTRAINTS'), prompt.indexOf('### THE CONVERGENCE PROBLEM'));
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
    assert.ok(/binding/i.test(block));
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
    const bannedSection = prompt.slice(prompt.indexOf('**Banned phrases'), prompt.indexOf('### AGE IS A FACT'));
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

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
