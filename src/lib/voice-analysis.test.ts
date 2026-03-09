import test from 'node:test';
import assert from 'node:assert/strict';
import {
    extractStatisticalProfile,
    buildPromptFragment,
    parseQualitativeResponse,
} from './voice-analysis.ts';

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. This sentence is a classic pangram used in typing tests.

However, not everyone agrees that pangrams are useful. Some people prefer to type random words. Others simply enjoy the rhythm of well-crafted sentences.

In particular, writers often focus on sentence variety. A short sentence hits hard. Meanwhile, a longer sentence can carry the reader through a more complex thought with greater nuance and subtlety.

Furthermore, the choice of vocabulary matters tremendously. Simple words convey clarity; complex words signal sophistication. The balance between the two defines a writer's unique fingerprint.`;

test('extractStatisticalProfile computes avgSentenceLength', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.avgSentenceLength > 0, 'avgSentenceLength should be positive');
    assert.ok(profile.avgSentenceLength < 50, 'avgSentenceLength should be reasonable');
});

test('extractStatisticalProfile computes sentenceLengthVariance', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.sentenceLengthVariance >= 0, 'sentenceLengthVariance should be non-negative');
});

test('extractStatisticalProfile computes vocabularyRichness (TTR)', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.vocabularyRichness > 0, 'vocabularyRichness should be positive');
    assert.ok(profile.vocabularyRichness <= 1, 'vocabularyRichness should be <= 1');
});

test('extractStatisticalProfile computes avgWordLength', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.avgWordLength > 2, 'avgWordLength should be > 2 for English text');
    assert.ok(profile.avgWordLength < 12, 'avgWordLength should be reasonable');
});

test('extractStatisticalProfile detects punctuation style', () => {
    const textWithSpecialPunct = 'This is a test — with em dashes. Also... ellipsis; and semicolons: and colons.';
    const profile = extractStatisticalProfile(textWithSpecialPunct);
    assert.ok(profile.punctuationStyle.emDash > 0, 'should detect em dash');
    assert.ok(profile.punctuationStyle.ellipsis > 0, 'should detect ellipsis');
    assert.ok(profile.punctuationStyle.semicolon > 0, 'should detect semicolon');
    assert.ok(profile.punctuationStyle.colon > 0, 'should detect colon');
});

test('extractStatisticalProfile finds common connectors', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(Array.isArray(profile.commonConnectors), 'commonConnectors should be an array');
    assert.ok(profile.commonConnectors.includes('however'), 'should detect "however"');
});

test('extractStatisticalProfile finds sentence starters', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(Array.isArray(profile.sentenceStarters), 'sentenceStarters should be an array');
    assert.ok(profile.sentenceStarters.length > 0, 'should find at least one starter');
});

test('extractStatisticalProfile computes passive voice ratio', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.passiveVoiceRatio >= 0, 'passiveVoiceRatio should be >= 0');
    assert.ok(profile.passiveVoiceRatio <= 1, 'passiveVoiceRatio should be <= 1');
});

test('extractStatisticalProfile computes question frequency', () => {
    const textWithQuestions = 'What is the meaning? I wonder about it. Do you know? Perhaps not.';
    const profile = extractStatisticalProfile(textWithQuestions);
    assert.ok(profile.questionFrequency > 0, 'questionFrequency should be > 0 for text with questions');
});

test('extractStatisticalProfile computes averageSyllablesPerWord', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.averageSyllablesPerWord >= 1, 'averageSyllablesPerWord should be >= 1');
    assert.ok(profile.averageSyllablesPerWord < 4, 'averageSyllablesPerWord should be reasonable');
});

test('extractStatisticalProfile computes avgParagraphLength', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    assert.ok(profile.avgParagraphLength > 0, 'avgParagraphLength should be positive');
});

test('buildPromptFragment produces a non-empty string for statistical only', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    const fragment = buildPromptFragment(profile, null);
    assert.ok(fragment.length > 0, 'fragment should be non-empty');
    assert.ok(fragment.includes('words per sentence'), 'fragment should mention sentence length target');
});

test('buildPromptFragment includes qualitative data when available', () => {
    const profile = extractStatisticalProfile(SAMPLE_TEXT);
    const qualitative = {
        toneDescription: 'Direct and confident.',
        writingPersonality: ['analytical', 'precise'],
        distinctiveHabits: ['Uses short follow-up sentences for emphasis'],
        vocabularyProfile: 'Favors crisp, specific terms.',
        rhythmDescription: 'Mixes short and medium sentences.',
        examplePhrases: ['hits hard', 'well-crafted'],
        avoidPatterns: ['Overly flowery language'],
    };
    const fragment = buildPromptFragment(profile, qualitative);
    assert.ok(fragment.includes('analytical'), 'should include personality traits');
    assert.ok(fragment.includes('hits hard'), 'should include example phrases');
    assert.ok(fragment.includes('Overly flowery'), 'should include avoid patterns');
});

test('parseQualitativeResponse parses valid JSON', () => {
    const validJson = JSON.stringify({
        toneDescription: 'Warm and measured.',
        writingPersonality: ['warm', 'measured'],
        distinctiveHabits: ['Short opener'],
        vocabularyProfile: 'Everyday words.',
        rhythmDescription: 'Flowing cadence.',
        examplePhrases: ['for what it is worth'],
        avoidPatterns: ['Jargon'],
    });
    const result = parseQualitativeResponse(validJson);
    assert.ok(result !== null, 'should parse valid JSON');
    assert.equal(result?.toneDescription, 'Warm and measured.');
});

test('parseQualitativeResponse returns null for invalid JSON', () => {
    assert.equal(parseQualitativeResponse('not json at all'), null);
});

test('parseQualitativeResponse strips markdown fences', () => {
    const fenced = '```json\n{"toneDescription":"Test","writingPersonality":[],"distinctiveHabits":[],"vocabularyProfile":"","rhythmDescription":"","examplePhrases":[],"avoidPatterns":[]}\n```';
    const result = parseQualitativeResponse(fenced);
    assert.ok(result !== null, 'should parse fenced JSON');
    assert.equal(result?.toneDescription, 'Test');
});
