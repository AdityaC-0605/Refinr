import test from 'node:test';
import assert from 'node:assert/strict';
import { HUMANIZE_BENCHMARK_CASES } from './humanize-benchmarks.ts';
import { evaluateBenchmarkSuite, scoreBenchmarkCase } from './humanize-eval.ts';

test('reference benchmark outputs score strongly', () => {
    const benchmarkCase = HUMANIZE_BENCHMARK_CASES[0];
    const result = scoreBenchmarkCase(benchmarkCase, benchmarkCase.referenceOutput);

    assert.ok(result.score >= 85);
    assert.equal(result.bannedHits.length, 0);
});

test('evaluateBenchmarkSuite aggregates case scores', () => {
    const candidates = Object.fromEntries(
        HUMANIZE_BENCHMARK_CASES.map(benchmarkCase => [benchmarkCase.id, benchmarkCase.referenceOutput])
    );
    const result = evaluateBenchmarkSuite(candidates);

    assert.equal(result.results.length, HUMANIZE_BENCHMARK_CASES.length);
    assert.ok(result.averageScore >= 85);
});
