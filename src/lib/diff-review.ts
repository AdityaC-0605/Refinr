import { diffWords } from 'diff';
import type { ChangeExplanation } from './humanize.ts';

export type ChangeDecision = 'accepted' | 'rejected';

export interface ReviewUnchangedCluster {
    type: 'unchanged';
    text: string;
}

export interface ReviewChangeCluster {
    type: 'change';
    id: number;
    removed: string;
    added: string;
    explanation: ChangeExplanation | null;
}

export type ReviewDiffCluster = ReviewUnchangedCluster | ReviewChangeCluster;

export interface ReviewDecisionSummary {
    total: number;
    accepted: number;
    rejected: number;
    pending: number;
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function scoreExplanationMatch(
    explanation: ChangeExplanation,
    removedText: string,
    addedText: string
): number {
    const normalizedRemoved = normalizeText(removedText);
    const normalizedAdded = normalizeText(addedText);
    const normalizedOriginal = normalizeText(explanation.original);
    const normalizedRevised = normalizeText(explanation.revised);

    let score = 0;

    if (normalizedRemoved && normalizedOriginal) {
        if (normalizedRemoved === normalizedOriginal) {
            score += 4;
        } else if (
            normalizedRemoved.includes(normalizedOriginal) ||
            normalizedOriginal.includes(normalizedRemoved)
        ) {
            score += 2;
        }
    }

    if (normalizedAdded && normalizedRevised) {
        if (normalizedAdded === normalizedRevised) {
            score += 4;
        } else if (
            normalizedAdded.includes(normalizedRevised) ||
            normalizedRevised.includes(normalizedAdded)
        ) {
            score += 2;
        }
    }

    if (normalizedRemoved && normalizedRevised && normalizedRemoved !== normalizedAdded) {
        const removedWords = normalizedRemoved.split(' ');
        const revisedWords = normalizedRevised.split(' ');
        const removedOverlap = removedWords.some(word => word.length > 3 && revisedWords.includes(word));

        if (removedOverlap) {
            score += 1;
        }
    }

    if (normalizedAdded && normalizedOriginal && normalizedAdded !== normalizedRemoved) {
        const addedWords = normalizedAdded.split(' ');
        const originalWords = normalizedOriginal.split(' ');
        const addedOverlap = addedWords.some(word => word.length > 3 && originalWords.includes(word));

        if (addedOverlap) {
            score += 1;
        }
    }

    return score;
}

export function buildReviewDiffClusters(
    original: string,
    edited: string,
    explanations: ChangeExplanation[] = [],
    showExplanations = false
): ReviewDiffCluster[] {
    const changes = diffWords(original, edited);
    const clusters: ReviewDiffCluster[] = [];
    const usedExplanationIndexes = new Set<number>();
    let changeId = 0;
    let index = 0;

    while (index < changes.length) {
        const part = changes[index];

        if (!part.added && !part.removed) {
            clusters.push({
                type: 'unchanged',
                text: part.value,
            });
            index += 1;
            continue;
        }

        let removedText = '';
        let addedText = '';

        while (index < changes.length && (changes[index].added || changes[index].removed)) {
            if (changes[index].removed) {
                removedText += changes[index].value;
            }

            if (changes[index].added) {
                addedText += changes[index].value;
            }

            index += 1;
        }

        let explanation: ChangeExplanation | null = null;

        if (showExplanations) {
            let bestIndex = -1;
            let bestScore = 0;

            explanations.forEach((candidate, candidateIndex) => {
                if (usedExplanationIndexes.has(candidateIndex)) {
                    return;
                }

                const score = scoreExplanationMatch(candidate, removedText, addedText);

                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = candidateIndex;
                }
            });

            if (bestIndex !== -1 && bestScore >= 3) {
                explanation = explanations[bestIndex];
                usedExplanationIndexes.add(bestIndex);
            }
        }

        clusters.push({
            type: 'change',
            id: changeId,
            removed: removedText,
            added: addedText,
            explanation,
        });
        changeId += 1;
    }

    return clusters;
}

export function applyDiffReviewDecisions(
    clusters: ReviewDiffCluster[],
    decisions: Partial<Record<number, ChangeDecision>>
): string {
    return clusters.map(cluster => {
        if (cluster.type === 'unchanged') {
            return cluster.text;
        }

        return decisions[cluster.id] === 'rejected' ? cluster.removed : cluster.added;
    }).join('');
}

export function summarizeReviewDecisions(
    clusters: ReviewDiffCluster[],
    decisions: Partial<Record<number, ChangeDecision>>
): ReviewDecisionSummary {
    const changeClusters = clusters.filter((cluster): cluster is ReviewChangeCluster => cluster.type === 'change');
    const accepted = changeClusters.filter(cluster => decisions[cluster.id] === 'accepted').length;
    const rejected = changeClusters.filter(cluster => decisions[cluster.id] === 'rejected').length;

    return {
        total: changeClusters.length,
        accepted,
        rejected,
        pending: changeClusters.length - accepted - rejected,
    };
}
