import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { HUMANIZE_BENCHMARK_CASES, type HumanizeBenchmarkCase } from './humanize-benchmarks.ts';
import { assessRewriteQuality } from './humanize.ts';

export interface BenchmarkCaseScore {
    id: string;
    title: string;
    score: number;
    qualityScore: number;
    matchedSignals: string[];
    missingSignals: string[];
    bannedHits: string[];
    issues: string[];
}

export interface BenchmarkSuiteResult {
    averageScore: number;
    results: BenchmarkCaseScore[];
}

function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function scoreBenchmarkCase(
    benchmarkCase: HumanizeBenchmarkCase,
    candidateText: string
): BenchmarkCaseScore {
    const assessment = assessRewriteQuality(
        benchmarkCase.originalText,
        candidateText,
        { settings: benchmarkCase.settings }
    );
    const normalizedCandidate = normalize(candidateText);

    const matchedSignals = benchmarkCase.expectedSignals.filter(signal =>
        normalizedCandidate.includes(normalize(signal))
    );
    const missingSignals = benchmarkCase.expectedSignals.filter(signal =>
        !normalizedCandidate.includes(normalize(signal))
    );
    const bannedHits = benchmarkCase.bannedPatterns
        .filter(pattern => pattern.test(candidateText))
        .map(pattern => pattern.source);

    const score = Math.max(
        0,
        Math.min(
            100,
            assessment.score + matchedSignals.length * 4 - missingSignals.length * 5 - bannedHits.length * 8
        )
    );

    return {
        id: benchmarkCase.id,
        title: benchmarkCase.title,
        score,
        qualityScore: assessment.score,
        matchedSignals,
        missingSignals,
        bannedHits,
        issues: assessment.issues,
    };
}

export function evaluateBenchmarkSuite(
    candidates: Record<string, string>
): BenchmarkSuiteResult {
    const results = HUMANIZE_BENCHMARK_CASES.map(benchmarkCase => {
        const candidate = candidates[benchmarkCase.id] ?? benchmarkCase.referenceOutput;
        return scoreBenchmarkCase(benchmarkCase, candidate);
    });

    const averageScore = results.length === 0
        ? 0
        : results.reduce((sum, result) => sum + result.score, 0) / results.length;

    return {
        averageScore,
        results,
    };
}

async function readCandidateFile(filePath: string): Promise<Record<string, string>> {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Candidate file must be a JSON object mapping benchmark ids to rewrite strings.');
    }

    return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
}

function printSuiteResult(result: BenchmarkSuiteResult) {
    console.log(`Humanizer benchmark average: ${result.averageScore.toFixed(1)}/100`);
    console.log('');

    result.results.forEach(caseResult => {
        console.log(`${caseResult.id} — ${caseResult.title}`);
        console.log(`  score: ${caseResult.score.toFixed(1)} (quality ${caseResult.qualityScore.toFixed(1)})`);
        if (caseResult.matchedSignals.length > 0) {
            console.log(`  matched: ${caseResult.matchedSignals.join(', ')}`);
        }
        if (caseResult.missingSignals.length > 0) {
            console.log(`  missing: ${caseResult.missingSignals.join(', ')}`);
        }
        if (caseResult.bannedHits.length > 0) {
            console.log(`  banned hits: ${caseResult.bannedHits.join(', ')}`);
        }
        if (caseResult.issues.length > 0) {
            console.log(`  issues: ${caseResult.issues.slice(0, 3).join(' | ')}`);
        }
        console.log('');
    });
}

async function main() {
    const candidateFileFlagIndex = process.argv.indexOf('--candidate-file');
    const candidates = candidateFileFlagIndex !== -1 && process.argv[candidateFileFlagIndex + 1]
        ? await readCandidateFile(process.argv[candidateFileFlagIndex + 1])
        : Object.fromEntries(
            HUMANIZE_BENCHMARK_CASES.map(benchmarkCase => [benchmarkCase.id, benchmarkCase.referenceOutput])
        );

    const result = evaluateBenchmarkSuite(candidates);
    printSuiteResult(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
