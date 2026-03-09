import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyDiffReviewDecisions,
    buildReviewDiffClusters,
    summarizeReviewDecisions,
} from './diff-review.ts';

test('buildReviewDiffClusters creates stable numbered change clusters', () => {
    const clusters = buildReviewDiffClusters(
        'The update was very long and repetitive.',
        'The update was tighter and more direct.'
    );

    const changeClusters = clusters.filter(cluster => cluster.type === 'change');

    assert.equal(changeClusters.length > 0, true);
    assert.deepEqual(changeClusters.map(cluster => cluster.id), changeClusters.map((_, index) => index));
});

test('applyDiffReviewDecisions rebuilds text with rejected changes restored', () => {
    const clusters = buildReviewDiffClusters(
        'The update was very long and repetitive.',
        'The update was tighter and more direct.'
    );
    const changeClusters = clusters.filter(cluster => cluster.type === 'change');

    const revertedText = applyDiffReviewDecisions(
        clusters,
        Object.fromEntries(changeClusters.map(cluster => [cluster.id, 'rejected']))
    );

    assert.equal(revertedText, 'The update was very long and repetitive.');
});

test('summarizeReviewDecisions counts accepted, rejected, and pending changes', () => {
    const clusters = buildReviewDiffClusters(
        'The update was very long and repetitive. It also felt stiff.',
        'The update was tighter and more direct. It felt natural.'
    );
    const changeClusters = clusters.filter(cluster => cluster.type === 'change');

    const summary = summarizeReviewDecisions(clusters, {
        0: 'accepted',
        1: 'rejected',
    });

    assert.equal(summary.total, changeClusters.length);
    assert.equal(summary.accepted, 1);
    assert.equal(summary.rejected, 1);
    assert.equal(summary.pending, changeClusters.length - 2);
});
