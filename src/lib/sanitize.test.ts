import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_INPUT_CHARACTERS, MAX_INPUT_WORDS, MIN_INPUT_WORDS } from './config.ts';
import { countWords, sanitizeInput, validateInput } from './sanitize.ts';

test('sanitizeInput removes html and zero-width characters', () => {
    const sanitized = sanitizeInput('<p>Hello\u200B world</p>');
    assert.equal(sanitized, 'Hello world');
});

test('countWords handles repeated whitespace', () => {
    assert.equal(countWords('one   two\nthree'), 3);
});

test('validateInput rejects too-short input', () => {
    const text = Array.from({ length: MIN_INPUT_WORDS - 1 }, () => 'word').join(' ');
    const result = validateInput(text);
    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /at least/i);
});

test('validateInput rejects too many words', () => {
    const text = Array.from({ length: MAX_INPUT_WORDS + 1 }, () => 'word').join(' ');
    const result = validateInput(text);
    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /Maximum/i);
});

test('validateInput rejects too many characters', () => {
    const text = `${Array.from({ length: MIN_INPUT_WORDS }, () => 'word').join(' ')} ${'a'.repeat(MAX_INPUT_CHARACTERS)}`;
    const result = validateInput(text);
    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /characters/i);
});
