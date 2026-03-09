/**
 * Voice DNA — Score how closely a text matches a user's voice profile
 */

import type { VoiceDNAProfile, VoiceMatchScore, VoiceMatchBreakdownItem, PunctuationStyleVector } from './voice-types.ts';
import { extractStatisticalProfile } from './voice-analysis.ts';

/* ─── Weight Config ─── */

const WEIGHTS = {
    sentenceLength: 0.30,
    vocabularyRichness: 0.25,
    rhythmVariance: 0.20,
    punctuationStyle: 0.15,
    connectors: 0.10,
} as const;

/* ─── Helpers ─── */

function proximityScore(actual: number, target: number, tolerance: number): number {
    if (tolerance <= 0) {
        return actual === target ? 100 : 0;
    }

    const distance = Math.abs(actual - target);
    const normalized = Math.max(0, 1 - distance / tolerance);

    return Math.round(normalized * 100);
}

function cosineSimilarity(a: PunctuationStyleVector, b: PunctuationStyleVector): number {
    const aVec = [a.emDash, a.ellipsis, a.semicolon, a.colon];
    const bVec = [b.emDash, b.ellipsis, b.semicolon, b.colon];

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < aVec.length; i++) {
        dot += aVec[i] * bVec[i];
        magA += aVec[i] ** 2;
        magB += bVec[i] ** 2;
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);

    if (magnitude === 0) {
        // Both are zero vectors — perfect match (neither uses special punctuation)
        return 1;
    }

    return dot / magnitude;
}

function connectorOverlapScore(targetConnectors: string[], actualConnectors: string[]): number {
    if (targetConnectors.length === 0) {
        return actualConnectors.length === 0 ? 100 : 60;
    }

    const targetSet = new Set(targetConnectors);
    let matches = 0;

    for (const connector of actualConnectors) {
        if (targetSet.has(connector)) {
            matches++;
        }
    }

    return Math.round((matches / targetConnectors.length) * 100);
}

/* ─── Main Scoring Function ─── */

export function computeVoiceMatchScore(text: string, profile: VoiceDNAProfile): VoiceMatchScore {
    const textStats = extractStatisticalProfile(text);
    const target = profile.statistical;

    const breakdown: VoiceMatchBreakdownItem[] = [];

    // 1. Sentence length match
    const sentenceLengthScore = proximityScore(
        textStats.avgSentenceLength,
        target.avgSentenceLength,
        target.avgSentenceLength * 0.5
    );
    breakdown.push({ metric: 'Sentence Length', score: sentenceLengthScore });

    // 2. Vocabulary richness
    const vocabScore = proximityScore(
        textStats.vocabularyRichness,
        target.vocabularyRichness,
        target.vocabularyRichness * 0.4
    );
    breakdown.push({ metric: 'Vocabulary Richness', score: vocabScore });

    // 3. Rhythm variance
    const rhythmScore = proximityScore(
        textStats.sentenceLengthVariance,
        target.sentenceLengthVariance,
        target.sentenceLengthVariance * 0.6
    );
    breakdown.push({ metric: 'Rhythm Variance', score: rhythmScore });

    // 4. Punctuation similarity
    const punctScore = Math.round(
        cosineSimilarity(textStats.punctuationStyle, target.punctuationStyle) * 100
    );
    breakdown.push({ metric: 'Punctuation Style', score: punctScore });

    // 5. Connector overlap
    const connScore = connectorOverlapScore(
        target.commonConnectors,
        textStats.commonConnectors
    );
    breakdown.push({ metric: 'Connector Usage', score: connScore });

    // Weighted total
    const totalScore = Math.round(
        sentenceLengthScore * WEIGHTS.sentenceLength +
        vocabScore * WEIGHTS.vocabularyRichness +
        rhythmScore * WEIGHTS.rhythmVariance +
        punctScore * WEIGHTS.punctuationStyle +
        connScore * WEIGHTS.connectors
    );

    return {
        score: Math.max(0, Math.min(100, totalScore)),
        breakdown,
    };
}
