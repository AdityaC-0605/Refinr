/**
 * Voice DNA types — personal writing style fingerprinting
 */

export interface VoiceDNAStatistical {
    avgSentenceLength: number;
    sentenceLengthVariance: number;
    avgWordLength: number;
    vocabularyRichness: number;
    avgParagraphLength: number;
    punctuationStyle: PunctuationStyleVector;
    commonConnectors: string[];
    sentenceStarters: string[];
    passiveVoiceRatio: number;
    questionFrequency: number;
    averageSyllablesPerWord: number;
}

export interface PunctuationStyleVector {
    emDash: number;
    ellipsis: number;
    semicolon: number;
    colon: number;
}

export interface VoiceDNAQualitative {
    toneDescription: string;
    writingPersonality: string[];
    distinctiveHabits: string[];
    vocabularyProfile: string;
    rhythmDescription: string;
    examplePhrases: string[];
    avoidPatterns: string[];
}

export interface VoiceDNAProfile {
    userId: string;
    createdAt: string;
    updatedAt: string;
    sampleCount: number;
    totalWordCount: number;
    statistical: VoiceDNAStatistical;
    qualitative: VoiceDNAQualitative | null;
    promptFragment: string;
}

export interface VoiceMatchBreakdownItem {
    metric: string;
    score: number;
}

export interface VoiceMatchScore {
    score: number;
    breakdown: VoiceMatchBreakdownItem[];
}
