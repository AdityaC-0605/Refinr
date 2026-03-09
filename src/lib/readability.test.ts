import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateReadability,
    getReadabilityColor,
    getReadabilityLabel,
} from './readability.ts';

test('calculateReadability returns empty metrics for blank text', () => {
    const result = calculateReadability('');
    assert.equal(result.wordCount, 0);
    assert.equal(result.sentenceCount, 0);
    assert.equal(result.fleschKincaid, 0);
});

test('calculateReadability returns sensible metrics for simple prose', () => {
    const result = calculateReadability('This is a simple sentence. This is another one.');
    assert.equal(result.wordCount, 9);
    assert.equal(result.sentenceCount, 2);
    assert.ok(result.fleschKincaid > 0);
    assert.ok(result.gradeLevel >= 0);
});

test('readability helpers map thresholds correctly', () => {
    assert.equal(getReadabilityLabel(92), 'Very Easy');
    assert.equal(getReadabilityLabel(55), 'Fairly Difficult');
    assert.equal(getReadabilityColor(75), 'var(--accent-emerald)');
    assert.equal(getReadabilityColor(45), 'var(--accent-rose)');
});
