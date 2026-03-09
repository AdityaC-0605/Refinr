import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isValidHumanizeSettings,
    isValidRewritePreset,
    PRESET_RECOMMENDED_SETTINGS,
} from './config.ts';

test('isValidRewritePreset accepts supported presets and rejects invalid values', () => {
    assert.equal(isValidRewritePreset('none'), true);
    assert.equal(isValidRewritePreset('email'), true);
    assert.equal(isValidRewritePreset('linkedin-post'), true);
    assert.equal(isValidRewritePreset('newsletter'), false);
});

test('preset recommended settings provide defaults for every preset', () => {
    assert.equal(PRESET_RECOMMENDED_SETTINGS.none.rewriteIntent, 'humanize');
    assert.equal(PRESET_RECOMMENDED_SETTINGS.email.rewriteIntent, 'clarify');
    assert.equal(PRESET_RECOMMENDED_SETTINGS.email.tone, 'professional');
    assert.equal(PRESET_RECOMMENDED_SETTINGS['blog-post'].intensity, 'thorough');
    assert.equal(PRESET_RECOMMENDED_SETTINGS.essay.vocabLevel, 'advanced');
});

test('isValidHumanizeSettings requires a supported rewrite intent', () => {
    assert.equal(isValidHumanizeSettings({
        tone: 'professional',
        intensity: 'moderate',
        vocabLevel: 'standard',
        rewriteIntent: 'clarify',
        preserveLength: false,
    }), true);

    assert.equal(isValidHumanizeSettings({
        tone: 'professional',
        intensity: 'moderate',
        vocabLevel: 'standard',
        rewriteIntent: 'rewrite-better',
        preserveLength: false,
    }), false);
});
