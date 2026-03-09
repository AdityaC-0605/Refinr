import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVoiceMatchScore } from './voice-scoring.ts';
import { extractStatisticalProfile } from './voice-analysis.ts';
import type { VoiceDNAProfile } from './voice-types.ts';

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. This sentence is a classic pangram used in typing tests.

However, not everyone agrees that pangrams are useful. Some people prefer to type random words. Others simply enjoy the rhythm of well-crafted sentences.

In particular, writers often focus on sentence variety. A short sentence hits hard. Meanwhile, a longer sentence can carry the reader through a more complex thought with greater nuance and subtlety.

Furthermore, the choice of vocabulary matters tremendously. Simple words convey clarity; complex words signal sophistication. The balance between the two defines a writer's unique fingerprint.`;

function buildMockProfile(text: string): VoiceDNAProfile {
    return {
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sampleCount: 1,
        totalWordCount: 100,
        statistical: extractStatisticalProfile(text),
        qualitative: null,
        promptFragment: 'Test prompt fragment',
    };
}

test('computeVoiceMatchScore returns a score between 0 and 100', () => {
    const profile = buildMockProfile(SAMPLE_TEXT);
    const result = computeVoiceMatchScore(SAMPLE_TEXT, profile);
    assert.ok(result.score >= 0, 'score should be >= 0');
    assert.ok(result.score <= 100, 'score should be <= 100');
});

test('computeVoiceMatchScore returns 5 breakdown items', () => {
    const profile = buildMockProfile(SAMPLE_TEXT);
    const result = computeVoiceMatchScore(SAMPLE_TEXT, profile);
    assert.equal(result.breakdown.length, 5, 'should have 5 breakdown items');
});

test('identical text produces a high score', () => {
    const profile = buildMockProfile(SAMPLE_TEXT);
    const result = computeVoiceMatchScore(SAMPLE_TEXT, profile);
    assert.ok(result.score >= 85, `identical text should score >= 85, got ${result.score}`);
});

test('very different text produces a lower score', () => {
    const profile = buildMockProfile(SAMPLE_TEXT);
    const veryDifferent = 'Yes. No. OK. Fine. Done. Stop. Go. Run.';
    const result = computeVoiceMatchScore(veryDifferent, profile);
    assert.ok(result.score < 80, `very different text should score < 80, got ${result.score}`);
});

test('breakdown items have metric names and scores', () => {
    const profile = buildMockProfile(SAMPLE_TEXT);
    const result = computeVoiceMatchScore(SAMPLE_TEXT, profile);

    for (const item of result.breakdown) {
        assert.ok(typeof item.metric === 'string', 'metric should be a string');
        assert.ok(item.metric.length > 0, 'metric should be non-empty');
        assert.ok(typeof item.score === 'number', 'score should be a number');
        assert.ok(item.score >= 0 && item.score <= 100, 'score should be 0-100');
    }
});

test('score includes expected metrics', () => {
    const profile = buildMockProfile(SAMPLE_TEXT);
    const result = computeVoiceMatchScore(SAMPLE_TEXT, profile);
    const metricNames = result.breakdown.map(b => b.metric);

    assert.ok(metricNames.includes('Sentence Length'), 'should include Sentence Length');
    assert.ok(metricNames.includes('Vocabulary Richness'), 'should include Vocabulary Richness');
    assert.ok(metricNames.includes('Rhythm Variance'), 'should include Rhythm Variance');
    assert.ok(metricNames.includes('Punctuation Style'), 'should include Punctuation Style');
    assert.ok(metricNames.includes('Connector Usage'), 'should include Connector Usage');
});
