import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyAllGrammarSuggestions,
    applyGrammarSuggestion,
    buildAnnotatedTextSegments,
    mapLanguageToolIssueType,
    mapToneFindingsToIssues,
    type GrammarIssue,
} from './output-checks.ts';

test('mapLanguageToolIssueType normalizes LanguageTool issue types', () => {
    assert.equal(mapLanguageToolIssueType('misspelling'), 'spelling');
    assert.equal(mapLanguageToolIssueType('style'), 'style');
    assert.equal(mapLanguageToolIssueType('grammar'), 'grammar');
});

test('applyGrammarSuggestion replaces a single flagged range', () => {
    const nextText = applyGrammarSuggestion('Ths sentence has a typo.', {
        offset: 0,
        length: 3,
    }, 'This');

    assert.equal(nextText, 'This sentence has a typo.');
});

test('applyAllGrammarSuggestions applies top replacements from right to left', () => {
    const issues: GrammarIssue[] = [
        {
            id: '0',
            message: 'Fix typo',
            shortDescription: '',
            offset: 0,
            length: 3,
            replacements: ['This'],
            issueType: 'spelling',
        },
        {
            id: '1',
            message: 'Fix verb',
            shortDescription: '',
            offset: 4,
            length: 2,
            replacements: ['is'],
            issueType: 'grammar',
        },
    ];

    const nextText = applyAllGrammarSuggestions('Ths am ready.', issues);

    assert.equal(nextText, 'This is ready.');
});

test('mapToneFindingsToIssues maps exact sentence matches to offsets', () => {
    const issues = mapToneFindingsToIssues(
        'This is steady. This one is too casual!',
        [{
            sentence: 'This one is too casual!',
            reason: 'It sounds too casual.',
            severity: 'strong',
        }]
    );

    assert.equal(issues.length, 1);
    assert.equal(issues[0].offset, 16);
});

test('buildAnnotatedTextSegments marks overlapping grammar and tone ranges', () => {
    const segments = buildAnnotatedTextSegments(
        'This is steady.',
        [{
            id: 'g1',
            message: 'Fix word',
            shortDescription: '',
            offset: 0,
            length: 4,
            replacements: ['That'],
            issueType: 'grammar',
        }],
        [{
            id: 't1',
            sentence: 'This is steady.',
            reason: 'It is too formal.',
            severity: 'mild',
            offset: 0,
            length: 15,
        }]
    );

    assert.equal(segments[0].grammarIssueType, 'grammar');
    assert.equal(segments[0].toneSeverity, 'mild');
});
