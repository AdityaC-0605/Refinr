import type { HumanizeSettings, RewritePreset } from './prompt.ts';

export interface StoredDocument {
    id: string;
    title: string;
    inputText: string;
    outputText: string;
    preset: RewritePreset;
    rewriteIntent: HumanizeSettings['rewriteIntent'];
    tone: HumanizeSettings['tone'];
    intensity: HumanizeSettings['intensity'];
    vocabLevel: HumanizeSettings['vocabLevel'];
    createdAt: string;
    updatedAt: string;
}

export interface StoredDocumentVersion {
    id: string;
    inputText: string;
    outputText: string;
    preset: RewritePreset;
    rewriteIntent: HumanizeSettings['rewriteIntent'];
    tone: HumanizeSettings['tone'];
    intensity: HumanizeSettings['intensity'];
    vocabLevel: HumanizeSettings['vocabLevel'];
    createdAt: string;
}

export interface SaveDocumentRequest {
    documentId?: string;
    inputText: string;
    outputText: string;
    preset: RewritePreset;
    settings: HumanizeSettings;
}

export function deriveDocumentTitle(inputText: string, preset: RewritePreset): string {
    const firstMeaningfulLine = inputText
        .split('\n')
        .map(line => line.trim())
        .find(Boolean);

    const baseTitle = (firstMeaningfulLine ?? 'Untitled draft').replace(/\s+/g, ' ').trim();
    const clippedTitle = baseTitle.length > 68 ? `${baseTitle.slice(0, 65).trimEnd()}...` : baseTitle;

    if (clippedTitle !== 'Untitled draft') {
        return clippedTitle;
    }

    if (preset === 'none') {
        return clippedTitle;
    }

    return `${preset.replace(/-/g, ' ')} draft`;
}
