import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDocumentTitle } from './documents.ts';

test('deriveDocumentTitle prefers the first meaningful line', () => {
    const title = deriveDocumentTitle('\n\nQuarterly update\nBody copy', 'none');

    assert.equal(title, 'Quarterly update');
});

test('deriveDocumentTitle clips overly long titles', () => {
    const title = deriveDocumentTitle(
        'This is a very long first line that should be clipped before it becomes unwieldy inside the documents grid',
        'none'
    );

    assert.match(title, /\.\.\.$/);
    assert.ok(title.length <= 68);
});
