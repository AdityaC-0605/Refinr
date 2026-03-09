import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStreamingUserPrompt, buildUserPrompt } from './prompt.ts';

test('buildUserPrompt includes input-specific guardrails', () => {
    const prompt = buildUserPrompt(
        'We launched the feature on March 1, 2026.\n\n- Keep the rollout dates\n- Keep the KPI references'
    );

    assert.match(prompt, /INPUT-SPECIFIC GUARDRAILS/);
    assert.match(prompt, /Preserve names, numbers, dates, URLs, references, and factual claims/i);
    assert.match(prompt, /Preserve the paragraph structure/i);
    assert.match(prompt, /Preserve the list structure/i);
    assert.match(prompt, /Keep what already works|Keep strong sentences strong/i);
});

test('buildStreamingUserPrompt warns against generic ai filler', () => {
    const prompt = buildStreamingUserPrompt('This is a stiff paragraph that also says moreover several times. Moreover, it keeps dragging.');

    assert.match(prompt, /Avoid AI-cliche phrasing and generic filler/i);
    assert.match(prompt, /Replace formulaic transitions|smoother movement between ideas/i);
});

test('buildUserPrompt surfaces source-specific rewrite priorities', () => {
    const prompt = buildUserPrompt(
        'There are several reasons this proposal was considered important. Additionally, it was designed to be reviewed by the team. Additionally, it was very, very repetitive.'
    );

    assert.match(prompt, /PRIMARY ISSUES TO FIX/);
    assert.match(prompt, /Replace repeated formulaic transitions/i);
    assert.match(prompt, /Strengthen weak sentence openings/i);
    assert.match(prompt, /Convert passive constructions to active ones/i);
    assert.match(prompt, /Trim filler and verbal padding/i);
});

test('buildUserPrompt anchors concrete details and named terms', () => {
    const prompt = buildUserPrompt(
        'On March 1, 2026, OpenAI launched GPT-4.1 for the Acme Analytics team at https://example.com.'
    );

    assert.match(prompt, /CONCRETE DETAILS TO KEEP ANCHORED/);
    assert.match(prompt, /March 1/);
    assert.match(prompt, /2026/);
    assert.match(prompt, /OpenAI/);
    assert.match(prompt, /GPT-4/);
    assert.match(prompt, /Acme Analytics/);
    assert.match(prompt, /https:\/\/example\.com/);
});

test('buildStreamingUserPrompt adds matching micro examples for common failure modes', () => {
    const prompt = buildStreamingUserPrompt(
        'Additionally, we are excited to leverage this update in today’s fast-paced world.',
        'linkedin-post'
    );

    assert.match(prompt, /MICRO EXAMPLES OF THE KIND OF EDIT TO MAKE/);
    assert.match(prompt, /Before: Additionally, our team is excited to leverage this initiative/i);
    assert.match(prompt, /Better: We’re glad to share this update with our community/i);
});

test('buildUserPrompt includes the requested rewrite intent', () => {
    const prompt = buildUserPrompt(
        'This paragraph is wordy and drifts around the point before it finally says anything useful.',
        'none',
        {
            tone: 'professional',
            intensity: 'moderate',
            vocabLevel: 'standard',
            rewriteIntent: 'concise',
            preserveLength: false,
        }
    );

    assert.match(prompt, /Primary intent: Make the draft materially leaner/i);
});
