import test from 'node:test';
import assert from 'node:assert/strict';
import {
    assessRewriteQuality,
    chooseBetterRewrite,
    cleanModelEditedText,
    generateChangeSummary,
    getClientIpFromHeaders,
    getStreamTextDelta,
    isRetryableError,
    normalizeChangeSummary,
    parseExplanationResponse,
    parseHumanizeResponse,
    shouldGenerateAlternativeRewrite,
    shouldRunPolishPassWithSettings,
} from './humanize.ts';
import type { ChangeExplanation } from './humanize.ts';
import type { HumanizeSettings } from './prompt.ts';

test('getClientIpFromHeaders prefers the first forwarded IP', () => {
    const headers = new Headers({
        'x-forwarded-for': '203.0.113.9, 70.41.3.18',
        'x-real-ip': '192.0.2.1',
    });

    assert.equal(getClientIpFromHeaders(headers), '203.0.113.9');
});

test('isRetryableError detects transient provider failures', () => {
    assert.equal(isRetryableError('429 RESOURCE_EXHAUSTED'), true);
    assert.equal(isRetryableError('Service Unavailable'), true);
    assert.equal(isRetryableError('Invalid argument'), false);
});

test('normalizeChangeSummary adds academic disclosure guidance when needed', () => {
    const summary = normalizeChangeSummary(
        ['Improved sentence flow.'],
        'Abstract\nThis research paper explores a methodology.'
    );

    assert.equal(summary.length, 2);
    assert.match(summary[1], /disclosure policy/i);
});

test('parseHumanizeResponse handles fenced JSON output', () => {
    const parsed = parseHumanizeResponse(
        '```json\n{"edited_text":"Refined text.","change_summary":["Tightened phrasing."]}\n```',
        'Original text.'
    );

    assert.equal(parsed.edited_text, 'Refined text.');
    assert.deepEqual(parsed.change_summary, ['Tightened phrasing.']);
});

test('parseHumanizeResponse falls back to raw text on malformed output', () => {
    const parsed = parseHumanizeResponse('Plain response body', 'Original text.');
    assert.equal(parsed.edited_text, 'Plain response body');
    assert.equal(parsed.change_summary.length, 1);
});

test('cleanModelEditedText strips common wrapper text and summaries', () => {
    const cleaned = cleanModelEditedText(`Here is a refined version:

"This paragraph now reads more naturally."

Change summary:
- Tightened phrasing`);

    assert.equal(cleaned, 'This paragraph now reads more naturally.');
});

test('parseHumanizeResponse cleans wrapped edited_text fields', () => {
    const parsed = parseHumanizeResponse(
        '{"edited_text":"Edited text: \\"This version is clearer.\\"","change_summary":["Improved clarity."]}',
        'Original text.'
    );

    assert.equal(parsed.edited_text, 'This version is clearer.');
});

test('assessRewriteQuality flags generic ai filler', () => {
    const assessment = assessRewriteQuality(
        'The announcement is stiff and repetitive, but it includes the launch date and pricing details.',
        'In today’s fast-paced world, it is important to note that we are excited to leverage this launch.'
    );

    assert.ok(assessment.score < 78);
    assert.match(assessment.issues.join(' '), /generic ai-sounding phrases|grounded/i);
});

test('chooseBetterRewrite prefers the stronger candidate', () => {
    const preferred = chooseBetterRewrite(
        'The update is stiff and repetitive.',
        'The update is stiff and repetitive.',
        'The update now sounds clearer, tighter, and more direct.'
    );

    assert.equal(preferred, 'The update now sounds clearer, tighter, and more direct.');
});

test('assessRewriteQuality penalizes dropped concrete details', () => {
    const assessment = assessRewriteQuality(
        'OpenAI announced GPT-4.1 on March 1, 2026, and linked the notes at https://example.com.',
        'The company announced a new model recently and shared the notes online.'
    );

    assert.ok(assessment.score < 78);
    assert.match(assessment.issues.join(' '), /Preserve important concrete details/i);
});

test('assessRewriteQuality penalizes dropped named phrases and collapsed structure', () => {
    const assessment = assessRewriteQuality(
        'Acme Analytics called the rollout "Project Lighthouse."\n\nWhat should happen next?',
        'The team renamed the rollout and explained the next step in a single paragraph.'
    );

    assert.ok(assessment.score < 78);
    assert.match(assessment.issues.join(' '), /Project Lighthouse|paragraph structure|direct questions/i);
});

test('assessRewriteQuality respects preserveLength and simplified vocab settings', () => {
    const settings: HumanizeSettings = {
        tone: 'professional',
        intensity: 'moderate',
        vocabLevel: 'simplified',
        rewriteIntent: 'clarify',
        preserveLength: true,
    };

    const assessment = assessRewriteQuality(
        'We shared a short update with three concrete points.',
        'We disseminated an extensive and significantly more elaborate communiqué that unpacked the update in a much denser way than before.',
        { settings }
    );

    assert.ok(assessment.score < 78);
    assert.match(assessment.issues.join(' '), /preserve-length|simpler, more accessible wording/i);
});

test('shouldRunPolishPassWithSettings uses a higher bar for thorough rewrites', () => {
    const original = 'The proposal is repetitive and stiff, but the meaning is clear enough to keep, and the team wants the draft to stay mostly intact while sounding a little more direct for the review meeting.';
    const edited = 'Moreover, it is important to note that the proposal is repetitive and stiff, but the meaning is clear enough to keep, and the team wants the draft to stay mostly intact while sounding a little more direct for the review meeting.';

    const lightSettings: HumanizeSettings = {
        tone: 'professional',
        intensity: 'light',
        vocabLevel: 'standard',
        rewriteIntent: 'humanize',
        preserveLength: false,
    };
    const thoroughSettings: HumanizeSettings = {
        ...lightSettings,
        intensity: 'thorough',
    };

    assert.equal(shouldRunPolishPassWithSettings(original, edited, lightSettings), false);
    assert.equal(shouldRunPolishPassWithSettings(original, edited, thoroughSettings), true);
});

test('shouldGenerateAlternativeRewrite is more aggressive for thorough rewrites', () => {
    const original = 'The draft is serviceable, but it still sounds stiff and a little corporate in places while keeping the same structure, and the team wants it to feel more natural without losing the core meaning.';
    const edited = 'Moreover, the draft is serviceable, but it still sounds stiff and a little corporate in places while keeping the same structure, and the team wants it to feel more natural without losing the core meaning.';

    const lightSettings: HumanizeSettings = {
        tone: 'professional',
        intensity: 'light',
        vocabLevel: 'standard',
        rewriteIntent: 'humanize',
        preserveLength: false,
    };
    const thoroughSettings: HumanizeSettings = {
        ...lightSettings,
        intensity: 'thorough',
    };

    assert.equal(shouldGenerateAlternativeRewrite(original, edited, lightSettings), false);
    assert.equal(shouldGenerateAlternativeRewrite(original, edited, thoroughSettings), true);
});

test('assessRewriteQuality enforces concise intent more aggressively', () => {
    const assessment = assessRewriteQuality(
        'The update explains three changes to onboarding and then repeats the same point twice in slightly different words.',
        'The update explains three changes to onboarding and then repeats the same point twice in slightly different words while adding extra context that makes the paragraph even longer.',
        {
            settings: {
                tone: 'professional',
                intensity: 'moderate',
                vocabLevel: 'standard',
                rewriteIntent: 'concise',
                preserveLength: false,
            },
        }
    );

    assert.ok(assessment.score < 78);
    assert.match(assessment.issues.join(' '), /noticeably leaner/i);
});

test('getStreamTextDelta removes already-seen prefix when chunks are cumulative', () => {
    assert.equal(getStreamTextDelta('Hello world', 'Hello '), 'world');
    assert.equal(getStreamTextDelta('new text', ''), 'new text');
});

test('generateChangeSummary returns multiple stable summary lines', () => {
    const summary = generateChangeSummary(
        'This is a stiff and repetitive paragraph. It repeats itself a lot.',
        'This paragraph reads more naturally and avoids repetition.'
    );

    assert.ok(summary.length >= 3);
    assert.match(summary[0], /sentence structure|transitions/i);
});

test('parseExplanationResponse extracts valid explanation entries from JSON', () => {
    const parsed = parseExplanationResponse(`[
        {
            "original": "This is the old sentence.",
            "revised": "This is the revised sentence.",
            "reason": "Tightened the sentence for clarity."
        }
    ]`) as ChangeExplanation[];

    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].reason, 'Tightened the sentence for clarity.');
});

test('parseExplanationResponse returns an empty array for malformed JSON', () => {
    assert.deepEqual(parseExplanationResponse('not-json'), []);
});
