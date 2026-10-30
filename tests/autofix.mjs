// The Auto Fix loop's stopping rules, without a model.
//
// A loop with only a round cap spends every round and can hand back a card that scores worse than the
// one it started from. autoFixStep() is the decision function the loop uses, so the rules that matter
// (stop at the threshold, stop when nothing is fixable, stop at the cap, stop after a regression) can
// be checked here instead of by burning two model calls per round.
//
// Run from the repo root: node tests/autofix.mjs

import assert from 'node:assert';
import { autoFixStep, QUALITY_PANEL_HTML } from '../quality.js';

let failures = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ok   ${name}`);
    } catch (error) {
        failures++;
        console.log(`  FAIL ${name}\n       ${error.message}`);
    }
}

const base = { score: 5, threshold: 8, hasBannedNames: false, fixableIssues: 3, round: 0, maxRounds: 3, bestScore: null };

test('a card under the threshold with fixable issues gets fixed', () => {
    assert.equal(autoFixStep(base), 'fix');
});

test('a card at the threshold is done', () => {
    assert.equal(autoFixStep({ ...base, score: 8 }), 'done');
    assert.equal(autoFixStep({ ...base, score: 8.5 }), 'done');
});

test('a banned name keeps it working even when the score is high enough', () => {
    assert.equal(autoFixStep({ ...base, score: 9, hasBannedNames: true }), 'fix');
});

test('nothing fixable means stop rather than spin', () => {
    assert.equal(autoFixStep({ ...base, fixableIssues: 0 }), 'stop');
});

test('the round cap stops the loop', () => {
    assert.equal(autoFixStep({ ...base, round: 2, maxRounds: 3 }), 'fix');
    assert.equal(autoFixStep({ ...base, round: 3, maxRounds: 3 }), 'stop');
});

test('a fix that scored worse than the best version stops the loop', () => {
    assert.equal(autoFixStep({ ...base, score: 6, bestScore: 7 }), 'stop');
    // Equal to the best is not a regression; another round may still help.
    assert.equal(autoFixStep({ ...base, score: 7, bestScore: 7, fixableIssues: 2 }), 'fix');
});

test('the threshold is never bypassed by the cap', () => {
    // At the cap with the score under the threshold, the loop stops but the caller still returns the
    // best version it saw; no round may be skipped while rounds remain.
    assert.equal(autoFixStep({ ...base, round: 2, maxRounds: 3, score: 7.9 }), 'fix');
});

test('the quality panel offers Auto Fix next to Fix issues', () => {
    assert.match(QUALITY_PANEL_HTML, /stcg-q-autofix/);
    assert.match(QUALITY_PANEL_HTML, /Review and fix on repeat/);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
