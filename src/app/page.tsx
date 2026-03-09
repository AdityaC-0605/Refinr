'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import InteractiveTilt from '@/components/InteractiveTilt';
import AnnotatedOutputText from '@/components/AnnotatedOutputText';
import GrammarChecker from '@/components/GrammarChecker';
import Header from '@/components/Header';
import TextEditor from '@/components/TextEditor';
import ToneChecker from '@/components/ToneChecker';
import ToneSelector from '@/components/ToneSelector';
import OutputPanel, { ViewMode } from '@/components/OutputPanel';
import DiffView from '@/components/DiffView';
import ReadabilityScore from '@/components/ReadabilityScore';
import ChangeSummary from '@/components/ChangeSummary';
import EthicsModal from '@/components/EthicsModal';
import Footer from '@/components/Footer';
import { HumanizeSettings, RewritePreset } from '@/lib/prompt';
import {
    DEFAULT_HUMANIZE_SETTINGS,
    DEFAULT_REWRITE_PRESET,
    PRESET_RECOMMENDED_SETTINGS,
} from '@/lib/config';
import { StoredDocument, StoredDocumentVersion } from '@/lib/documents';
import {
    applyDiffReviewDecisions,
    buildReviewDiffClusters,
    summarizeReviewDecisions,
    type ChangeDecision,
    type ReviewChangeCluster,
} from '@/lib/diff-review';
import { type GrammarIssue, type ToneIssue } from '@/lib/output-checks';
import { ChangeExplanation, generateChangeSummary } from '@/lib/humanize';
import { validateInput, sanitizeInput } from '@/lib/sanitize';
import styles from './page.module.css';

interface HumanizeResult {
    editedText: string;
    changeSummary: string[];
}

interface StreamCompletePayload {
    edited_text: string;
    change_summary: string[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ParsedSseEvent {
    event: string;
    data: string;
}

interface StoredDocumentResponse {
    document?: StoredDocument;
    error?: string;
}

interface StoredDocumentVersionResponse {
    document?: StoredDocument;
    version?: StoredDocumentVersion;
    error?: string;
}

interface ExplanationResponse {
    explanations?: ChangeExplanation[];
    error?: string;
}

interface UndoState {
    currentDocumentId: string | null;
    inputText: string;
    originalText: string;
    result: HumanizeResult;
    resultPreset: RewritePreset;
    resultSettings: HumanizeSettings | null;
    reviewBaseEditedText: string | null;
    reviewDecisions: Partial<Record<number, ChangeDecision>>;
}

type ParagraphStatus = 'idle' | 'streaming' | 'done' | 'error';

function parseSseEvent(rawEvent: string): ParsedSseEvent | null {
    const lines = rawEvent.split('\n');
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('event:')) {
            event = line.slice(6).trim();
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        }
    }

    if (dataLines.length === 0) {
        return null;
    }

    return {
        event,
        data: dataLines.join('\n'),
    };
}

function splitParagraphs(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();

    if (!normalized) {
        return [];
    }

    return normalized
        .split(/\n\s*\n/g)
        .map(paragraph => paragraph.trim())
        .filter(Boolean);
}

function joinParagraphs(paragraphs: string[]): string {
    return paragraphs.join('\n\n');
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        window.setTimeout(resolve, ms);
    });
}

async function streamRefinementRequest(payload: {
    text: string;
    settings: HumanizeSettings;
    preset: RewritePreset;
    voiceDNAActive?: boolean;
    onChunk?: (text: string) => void;
}): Promise<StreamCompletePayload> {
    const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to process text' })) as { error?: string };
        throw new Error(data.error || 'Failed to process text');
    }

    if (!response.body) {
        throw new Error('Streaming response body is unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let rawBuffer = '';
    let pendingWord = '';
    let finalPayload: StreamCompletePayload | null = null;

    const flushStreamingDelta = (delta: string, flushAll = false) => {
        if (!delta) {
            return;
        }

        const combined = pendingWord + delta;

        if (flushAll) {
            pendingWord = '';
            payload.onChunk?.(combined);
            return;
        }

        const lastWhitespaceIndex = Math.max(
            combined.lastIndexOf(' '),
            combined.lastIndexOf('\n'),
            combined.lastIndexOf('\t')
        );

        if (lastWhitespaceIndex === -1) {
            pendingWord = combined;
            return;
        }

        const visibleText = combined.slice(0, lastWhitespaceIndex + 1);
        pendingWord = combined.slice(lastWhitespaceIndex + 1);
        payload.onChunk?.(visibleText);
    };

    while (true) {
        const { done, value } = await reader.read();
        rawBuffer += decoder.decode(value ?? new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');

        let boundaryIndex = rawBuffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
            const rawEvent = rawBuffer.slice(0, boundaryIndex);
            rawBuffer = rawBuffer.slice(boundaryIndex + 2);

            const parsedEvent = parseSseEvent(rawEvent);
            if (parsedEvent) {
                const eventPayload = JSON.parse(parsedEvent.data) as {
                    text?: string;
                    error?: string;
                    edited_text?: string;
                    change_summary?: string[];
                };

                if (parsedEvent.event === 'chunk' && typeof eventPayload.text === 'string') {
                    flushStreamingDelta(eventPayload.text);
                }

                if (parsedEvent.event === 'error') {
                    throw new Error(eventPayload.error || 'Streaming request failed.');
                }

                if (
                    parsedEvent.event === 'complete' &&
                    typeof eventPayload.edited_text === 'string' &&
                    Array.isArray(eventPayload.change_summary)
                ) {
                    finalPayload = {
                        edited_text: eventPayload.edited_text,
                        change_summary: eventPayload.change_summary,
                    };
                }
            }

            boundaryIndex = rawBuffer.indexOf('\n\n');
        }

        if (done) {
            break;
        }
    }

    if (!finalPayload) {
        throw new Error('Streaming completed without a final result.');
    }

    if (pendingWord) {
        flushStreamingDelta('', true);
    }

    return finalPayload;
}

async function fetchStoredDocument(documentId: string): Promise<StoredDocument> {
    const response = await fetch(`/api/documents/${documentId}`);
    const payload = await response.json().catch(() => ({ error: 'Unable to load the selected document.' })) as StoredDocumentResponse;

    if (!response.ok || !payload.document) {
        throw new Error(payload.error || 'Unable to load the selected document.');
    }

    return payload.document;
}

async function fetchStoredDocumentVersion(documentId: string, versionId: string): Promise<{
    document: StoredDocument;
    version: StoredDocumentVersion;
}> {
    const response = await fetch(`/api/documents/${documentId}/versions/${versionId}`);
    const payload = await response.json().catch(() => ({ error: 'Unable to load the selected version.' })) as StoredDocumentVersionResponse;

    if (!response.ok || !payload.document || !payload.version) {
        throw new Error(payload.error || 'Unable to load the selected version.');
    }

    return {
        document: payload.document,
        version: payload.version,
    };
}

async function saveStoredDocument(payload: {
    documentId?: string;
    inputText: string;
    outputText: string;
    preset: RewritePreset;
    settings: HumanizeSettings;
}): Promise<StoredDocument> {
    const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({ error: 'Unable to save this document.' })) as StoredDocumentResponse;

    if (!response.ok || !responsePayload.document) {
        throw new Error(responsePayload.error || 'Unable to save this document.');
    }

    return responsePayload.document;
}

async function fetchChangeExplanations(payload: {
    originalText: string;
    revisedText: string;
}): Promise<ChangeExplanation[]> {
    const response = await fetch('/api/refine/explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({ explanations: [] })) as ExplanationResponse;

    if (!response.ok) {
        throw new Error(responsePayload.error || 'Unable to load explanations.');
    }

    return Array.isArray(responsePayload.explanations) ? responsePayload.explanations : [];
}

export default function Home() {
    const { openAuthModal, sessionReady, user } = useAuth();
    // State
    const [inputText, setInputText] = useState('');
    const [preset, setPreset] = useState<RewritePreset>(DEFAULT_REWRITE_PRESET);
    const [settings, setSettings] = useState<HumanizeSettings>(DEFAULT_HUMANIZE_SETTINGS);
    const [result, setResult] = useState<HumanizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('output');
    const [showExplanations, setShowExplanations] = useState(false);
    const [explanations, setExplanations] = useState<ChangeExplanation[]>([]);
    const [explanationsLoading, setExplanationsLoading] = useState(false);
    const [explanationsDisabled, setExplanationsDisabled] = useState(false);
    const [originalText, setOriginalText] = useState('');
    const [toolbarOpen, setToolbarOpen] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
    const [requestedDocumentId, setRequestedDocumentId] = useState<string | null>(null);
    const [requestedVersionId, setRequestedVersionId] = useState<string | null>(null);
    const [paragraphMode, setParagraphMode] = useState(false);
    const [paragraphOutputs, setParagraphOutputs] = useState<Array<string | null>>([]);
    const [paragraphStatuses, setParagraphStatuses] = useState<ParagraphStatus[]>([]);
    const [paragraphErrors, setParagraphErrors] = useState<Array<string | null>>([]);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [resultSettings, setResultSettings] = useState<HumanizeSettings | null>(null);
    const [resultPreset, setResultPreset] = useState<RewritePreset>(DEFAULT_REWRITE_PRESET);
    const [versionPreviewLabel, setVersionPreviewLabel] = useState<string | null>(null);
    const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
    const [toneIssues, setToneIssues] = useState<ToneIssue[]>([]);
    const [reviewBaseEditedText, setReviewBaseEditedText] = useState<string | null>(null);
    const [reviewDecisions, setReviewDecisions] = useState<Partial<Record<number, ChangeDecision>>>({});
    const [voiceDNAActive, setVoiceDNAActive] = useState(false);
    const [voiceDNAAvailable, setVoiceDNAAvailable] = useState(false);
    const [voiceMatchScore, setVoiceMatchScore] = useState<{ score: number; breakdown: Array<{ metric: string; score: number }> } | null>(null);
    const pendingSaveRef = useRef(false);
    const undoStackRef = useRef<UndoState[]>([]);
    const loadedDocumentIdRef = useRef<string | null>(null);
    const loadedVersionIdRef = useRef<string | null>(null);
    const explanationRequestKeyRef = useRef<string | null>(null);
    const paragraphInputList = paragraphMode ? splitParagraphs(inputText) : [];
    const canRunParagraphMode = paragraphInputList.length > 0 && paragraphInputList.some(paragraph => paragraph.trim().length > 0);

    // Fetch Voice DNA profile availability
    useEffect(() => {
        if (sessionReady && user) {
            fetch('/api/voice/profile')
                .then(res => res.json())
                .then((data: { profile?: unknown }) => {
                    setVoiceDNAAvailable(!!data.profile);
                })
                .catch(() => setVoiceDNAAvailable(false));
        } else {
            setVoiceDNAAvailable(false);
            setVoiceDNAActive(false);
        }
    }, [sessionReady, user]);

    const diffComparisonEditedText = reviewBaseEditedText ?? result?.editedText ?? '';
    const reviewClusters = useMemo(
        () => originalText && diffComparisonEditedText
            ? buildReviewDiffClusters(originalText, diffComparisonEditedText, explanations, showExplanations && !explanationsDisabled)
            : [],
        [diffComparisonEditedText, explanations, explanationsDisabled, originalText, showExplanations]
    );
    const reviewSummary = useMemo(
        () => summarizeReviewDecisions(reviewClusters, reviewDecisions),
        [reviewClusters, reviewDecisions]
    );

    const pushUndoState = () => {
        if (!result) {
            return;
        }

        undoStackRef.current = [
            {
                currentDocumentId,
                inputText,
                originalText,
                result,
                resultPreset,
                resultSettings,
                reviewBaseEditedText,
                reviewDecisions,
            },
            ...undoStackRef.current,
        ].slice(0, 5);
    };

    const resetParagraphResults = (paragraphs: string[]) => {
        setParagraphOutputs(paragraphs.map(() => null));
        setParagraphStatuses(paragraphs.map(() => 'idle'));
        setParagraphErrors(paragraphs.map(() => null));
    };

    const resetExplanations = () => {
        explanationRequestKeyRef.current = null;
        setExplanations([]);
        setExplanationsLoading(false);
    };

    const resetReviewState = (nextBaseEditedText: string | null = null) => {
        setReviewDecisions({});
        setReviewBaseEditedText(nextBaseEditedText);
    };

    const applyReviewedResult = (
        baseEditedText: string,
        decisions: Partial<Record<number, ChangeDecision>>
    ) => {
        if (!originalText || !result) {
            return;
        }

        const nextClusters = buildReviewDiffClusters(originalText, baseEditedText);
        const nextEditedText = applyDiffReviewDecisions(nextClusters, decisions);

        setReviewBaseEditedText(baseEditedText);
        setReviewDecisions(decisions);
        setResult({
            editedText: nextEditedText,
            changeSummary: generateChangeSummary(originalText, nextEditedText),
        });
        setSaveStatus('idle');
        setError(null);
    };

    const handleResultTextChange = (nextEditedText: string) => {
        if (!result || nextEditedText === result.editedText) {
            return;
        }

        pushUndoState();
        setStreamingText('');
        setResult({
            editedText: nextEditedText,
            changeSummary: generateChangeSummary(originalText, nextEditedText),
        });
        resetReviewState(nextEditedText);
        resetExplanations();
        setSaveStatus('idle');
        setError(null);
    };

    const applyAggregateParagraphResult = (
        sourceParagraphs: string[],
        nextOutputs: Array<string | null>,
        nextSettings: HumanizeSettings,
        nextPreset: RewritePreset
    ) => {
        const combinedParagraphs = sourceParagraphs.map((paragraph, index) => nextOutputs[index] ?? paragraph);
        const combinedText = joinParagraphs(combinedParagraphs);

        setOriginalText(joinParagraphs(sourceParagraphs));
        setStreamingText('');
        setResult({
            editedText: combinedText,
            changeSummary: generateChangeSummary(joinParagraphs(sourceParagraphs), combinedText),
        });
        resetReviewState(combinedText);
        setResultSettings(nextSettings);
        setResultPreset(nextPreset);
        setViewMode('output');
        setSaveStatus('idle');
    };

    const updateEditorUrl = (documentId: string | null, versionId: string | null = null) => {
        const params = new URLSearchParams();

        if (documentId) {
            params.set('document', documentId);
        }

        if (documentId && versionId) {
            params.set('version', versionId);
        }

        const nextUrl = params.toString() ? `/?${params.toString()}` : '/';
        window.history.replaceState({}, '', nextUrl);
        setRequestedDocumentId(documentId);
        setRequestedVersionId(versionId);
    };

    const handleUndo = () => {
        const previousState = undoStackRef.current.shift();

        if (!previousState) {
            return;
        }

        setCurrentDocumentId(previousState.currentDocumentId);
        setInputText(previousState.inputText);
        setOriginalText(previousState.originalText);
        setStreamingText('');
        setResult(previousState.result);
        setResultPreset(previousState.resultPreset);
        setResultSettings(previousState.resultSettings);
        setReviewBaseEditedText(previousState.reviewBaseEditedText);
        setReviewDecisions(previousState.reviewDecisions);
        resetExplanations();
        setViewMode('output');
        setError(null);
        setSaveStatus('idle');
        setVersionPreviewLabel(null);
        loadedDocumentIdRef.current = previousState.currentDocumentId;
        loadedVersionIdRef.current = null;
        updateEditorUrl(previousState.currentDocumentId);
    };

    const handleEditVersion = () => {
        setVersionPreviewLabel(null);
        setError(null);
        setSaveStatus('idle');
        resetReviewState(result?.editedText ?? null);
        resetExplanations();
        loadedDocumentIdRef.current = currentDocumentId;
        loadedVersionIdRef.current = null;
        updateEditorUrl(currentDocumentId);
    };

    const handleReviewDecision = (changeId: number, decision: ChangeDecision | 'pending') => {
        if (!result) {
            return;
        }

        const baseEditedText = reviewBaseEditedText ?? result.editedText;
        const currentDecision = reviewDecisions[changeId];
        const nextDecision = decision === 'pending' ? undefined : decision;

        if (currentDecision === nextDecision) {
            return;
        }

        pushUndoState();

        const nextDecisions = { ...reviewDecisions };

        if (decision === 'pending') {
            delete nextDecisions[changeId];
        } else {
            nextDecisions[changeId] = decision;
        }

        applyReviewedResult(baseEditedText, nextDecisions);
    };

    const handleReviewDecisionBatch = (decision: ChangeDecision) => {
        if (!result || reviewSummary.total === 0) {
            return;
        }

        const baseEditedText = reviewBaseEditedText ?? result.editedText;
        pushUndoState();

        const nextDecisions = Object.fromEntries(
            reviewClusters
                .filter((cluster): cluster is ReviewChangeCluster => cluster.type === 'change')
                .map(cluster => [cluster.id, decision])
        ) as Partial<Record<number, ChangeDecision>>;

        applyReviewedResult(baseEditedText, nextDecisions);
    };

    const handleResetReview = () => {
        if (!result || reviewSummary.total === 0) {
            return;
        }

        const baseEditedText = reviewBaseEditedText ?? result.editedText;
        pushUndoState();
        applyReviewedResult(baseEditedText, {});
    };

    const handleRefineParagraph = async (
        index: number,
        sourceParagraphs: string[],
        requestSettings: HumanizeSettings,
        requestPreset: RewritePreset,
        deferAggregateUpdate = false
    ): Promise<string> => {
        const paragraphText = sourceParagraphs[index];

        setParagraphStatuses(prev => prev.map((status, currentIndex) => currentIndex === index ? 'streaming' : status));
        setParagraphErrors(prev => prev.map((message, currentIndex) => currentIndex === index ? null : message));
        setParagraphOutputs(prev => prev.map((text, currentIndex) => currentIndex === index ? '' : text));

        try {
            const payload = await streamRefinementRequest({
                text: paragraphText,
                settings: requestSettings,
                preset: requestPreset,
                onChunk: chunk => {
                    setParagraphOutputs(prev => prev.map((text, currentIndex) => (
                        currentIndex === index ? `${text ?? ''}${chunk}` : text
                    )));
                },
            });

            let nextOutputs: Array<string | null> = [];
            setParagraphOutputs(prev => {
                nextOutputs = prev.map((text, currentIndex) => currentIndex === index ? payload.edited_text : text);
                return nextOutputs;
            });
            setParagraphStatuses(prev => prev.map((status, currentIndex) => currentIndex === index ? 'done' : status));

            if (!deferAggregateUpdate) {
                applyAggregateParagraphResult(sourceParagraphs, nextOutputs, requestSettings, requestPreset);
            }

            return payload.edited_text;
        } catch (paragraphError) {
            setParagraphOutputs(prev => prev.map((text, currentIndex) => currentIndex === index ? null : text));
            setParagraphStatuses(prev => prev.map((status, currentIndex) => currentIndex === index ? 'error' : status));
            setParagraphErrors(prev => prev.map((message, currentIndex) => (
                currentIndex === index
                    ? paragraphError instanceof Error ? paragraphError.message : 'Unable to refine this paragraph.'
                    : message
            )));
            throw paragraphError;
        }
    };

    const handleRefineAllParagraphs = async () => {
        const sourceParagraphs = splitParagraphs(inputText);

        if (sourceParagraphs.length === 0) {
            setError('Add some text before using Paragraph Mode.');
            return;
        }

        pushUndoState();
        setLoading(true);
        setError(null);
        setResult(null);
        resetReviewState();
        resetExplanations();
        setStreamingText('');
        setViewMode('output');
        setSaveStatus('idle');
        setVersionPreviewLabel(null);
        loadedVersionIdRef.current = null;
        resetParagraphResults(sourceParagraphs);
        const requestSettings: HumanizeSettings = { ...settings };
        const requestPreset = preset;
        let hadFailure = false;
        const finalOutputs: Array<string | null> = sourceParagraphs.map(() => null);

        try {
            for (let index = 0; index < sourceParagraphs.length; index += 1) {
                try {
                    finalOutputs[index] = await handleRefineParagraph(index, sourceParagraphs, requestSettings, requestPreset, true);
                } catch {
                    hadFailure = true;
                }

                if (index < sourceParagraphs.length - 1) {
                    await delay(200);
                }
            }

            applyAggregateParagraphResult(sourceParagraphs, finalOutputs, requestSettings, requestPreset);

            if (hadFailure) {
                setError('Some paragraphs could not be refined. Original text was kept for those blocks.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefineSingleParagraph = async (index: number) => {
        const sourceParagraphs = splitParagraphs(inputText);

        if (!sourceParagraphs[index]?.trim()) {
            return;
        }

        pushUndoState();
        setLoading(true);
        setError(null);
        setResult(null);
        resetReviewState();
        resetExplanations();
        setStreamingText('');
        setViewMode('output');
        setSaveStatus('idle');
        setVersionPreviewLabel(null);
        loadedVersionIdRef.current = null;
        const requestSettings: HumanizeSettings = { ...settings };
        const requestPreset = preset;

        try {
            await handleRefineParagraph(index, sourceParagraphs, requestSettings, requestPreset);
        } catch (paragraphError) {
            setError(paragraphError instanceof Error ? paragraphError.message : 'Unable to refine this paragraph.');
        } finally {
            setLoading(false);
        }
    };

    const handleHumanize = async () => {
        if (paragraphMode) {
            await handleRefineAllParagraphs();
            return;
        }

        const clean = sanitizeInput(inputText);
        const validation = validateInput(clean);

        if (!validation.valid) {
            setError(validation.error || 'Invalid input');
            return;
        }

        pushUndoState();
        setLoading(true);
        setError(null);
        setResult(null);
        resetExplanations();
        setStreamingText('');
        setOriginalText(clean);
        setViewMode('output');
        setSaveStatus('idle');
        setVersionPreviewLabel(null);
        loadedVersionIdRef.current = null;
        const requestSettings: HumanizeSettings = { ...settings };
        const requestPreset = preset;
        setVoiceMatchScore(null);

        try {
            const finalPayload = await streamRefinementRequest({
                text: clean,
                settings: requestSettings,
                preset: requestPreset,
                voiceDNAActive,
                onChunk: chunk => {
                    setStreamingText(prev => prev + chunk);
                },
            }) as StreamCompletePayload & { voiceMatchScore?: { score: number; breakdown: Array<{ metric: string; score: number }> } };

            setStreamingText(finalPayload.edited_text);
            setResult({
                editedText: finalPayload.edited_text,
                changeSummary: finalPayload.change_summary,
            });
            resetReviewState(finalPayload.edited_text);
            setResultSettings(requestSettings);
            setResultPreset(requestPreset);
            if (finalPayload.voiceMatchScore) {
                setVoiceMatchScore(finalPayload.voiceMatchScore);
            }
        } catch (err) {
            setStreamingText('');
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isDisabled = !inputText.trim() || !validateInput(inputText).valid;

    useEffect(() => {
        const syncRequestedParams = () => {
            const params = new URLSearchParams(window.location.search);
            setRequestedDocumentId(params.get('document'));
            setRequestedVersionId(params.get('version'));
        };

        syncRequestedParams();
        window.addEventListener('popstate', syncRequestedParams);

        return () => {
            window.removeEventListener('popstate', syncRequestedParams);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
                if (undoStackRef.current.length === 0) {
                    return;
                }

                event.preventDefault();
                const previousState = undoStackRef.current.shift();

                if (!previousState) {
                    return;
                }

                setCurrentDocumentId(previousState.currentDocumentId);
                setInputText(previousState.inputText);
                setOriginalText(previousState.originalText);
                setStreamingText('');
                setResult(previousState.result);
                setResultPreset(previousState.resultPreset);
                setResultSettings(previousState.resultSettings);
                setReviewBaseEditedText(previousState.reviewBaseEditedText);
                setReviewDecisions(previousState.reviewDecisions);
                setViewMode('output');
                setError(null);
                setSaveStatus('idle');
                setVersionPreviewLabel(null);
                loadedDocumentIdRef.current = previousState.currentDocumentId;
                loadedVersionIdRef.current = null;
                const params = new URLSearchParams();

                if (previousState.currentDocumentId) {
                    params.set('document', previousState.currentDocumentId);
                }

                const nextUrl = params.toString() ? `/?${params.toString()}` : '/';
                window.history.replaceState({}, '', nextUrl);
                setRequestedDocumentId(previousState.currentDocumentId);
                setRequestedVersionId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (!paragraphMode) {
            return;
        }

        const sourceParagraphs = splitParagraphs(inputText);

        if (sourceParagraphs.length === 0) {
            resetParagraphResults([]);
            return;
        }

        const canHydrateFromResult = Boolean(
            result &&
            originalText &&
            joinParagraphs(sourceParagraphs) === originalText
        );
        const hydratedOutputs = canHydrateFromResult
            ? splitParagraphs(result?.editedText ?? '')
            : [];

        if (hydratedOutputs.length === sourceParagraphs.length) {
            setParagraphOutputs(hydratedOutputs);
            setParagraphStatuses(hydratedOutputs.map(() => 'done'));
            setParagraphErrors(hydratedOutputs.map(() => null));
            return;
        }

        resetParagraphResults(sourceParagraphs);
    }, [inputText, originalText, paragraphMode, result]);

    const handlePresetChange = (nextPreset: RewritePreset) => {
        setPreset(nextPreset);
        const recommended = PRESET_RECOMMENDED_SETTINGS[nextPreset];
        setSettings(prev => ({
            ...prev,
            rewriteIntent: recommended.rewriteIntent,
            tone: recommended.tone,
            intensity: recommended.intensity,
            vocabLevel: recommended.vocabLevel,
        }));
    };

    const handleUseResultAsInput = () => {
        if (!result?.editedText) return;

        setInputText(result.editedText);
        setResult(null);
        setOriginalText('');
        resetReviewState();
        resetExplanations();
        setViewMode('output');
        setError(null);
        setSaveStatus('idle');
        setResultSettings(null);
        setResultPreset(DEFAULT_REWRITE_PRESET);
        setVersionPreviewLabel(null);
        loadedVersionIdRef.current = null;
    };

    const handleParagraphModeChange = () => {
        const nextMode = !paragraphMode;
        setParagraphMode(nextMode);

        if (nextMode) {
            resetParagraphResults(splitParagraphs(inputText));
            setViewMode('output');
            return;
        }

        setParagraphOutputs([]);
        setParagraphStatuses([]);
        setParagraphErrors([]);
    };

    const handleParagraphInputChange = (index: number, nextValue: string) => {
        const nextParagraphs = splitParagraphs(inputText);
        nextParagraphs[index] = nextValue;
        const nextText = joinParagraphs(nextParagraphs);

        setInputText(nextText);
        setError(null);
        setResult(null);
        resetReviewState();
        resetExplanations();
        setOriginalText('');
        setStreamingText('');
        setViewMode('output');
        setSaveStatus('idle');
        setResultSettings(null);
        setResultPreset(DEFAULT_REWRITE_PRESET);
        setVersionPreviewLabel(null);
        loadedVersionIdRef.current = null;
        resetParagraphResults(nextParagraphs);
    };

    useEffect(() => {
        if (!requestedDocumentId) {
            loadedDocumentIdRef.current = null;
            loadedVersionIdRef.current = null;
            return;
        }

        if (requestedVersionId) {
            return;
        }

        if (!sessionReady) {
            return;
        }

        if (!user) {
            setError('Log in to reload saved documents from your workspace.');
            return;
        }

        if (loadedDocumentIdRef.current === requestedDocumentId) {
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                const document = await fetchStoredDocument(requestedDocumentId);

                if (cancelled) {
                    return;
                }

                const restoredSettings: HumanizeSettings = {
                    rewriteIntent: document.rewriteIntent ?? DEFAULT_HUMANIZE_SETTINGS.rewriteIntent,
                    tone: document.tone,
                    intensity: document.intensity,
                    vocabLevel: document.vocabLevel,
                    preserveLength: DEFAULT_HUMANIZE_SETTINGS.preserveLength,
                };

                setCurrentDocumentId(document.id);
                setInputText(document.inputText);
                setOriginalText(document.inputText);
                setPreset(document.preset);
                setSettings(restoredSettings);
                setStreamingText('');
                setResult({
                    editedText: document.outputText,
                    changeSummary: generateChangeSummary(document.inputText, document.outputText),
                });
                resetReviewState(document.outputText);
                resetExplanations();
                setResultSettings(restoredSettings);
                setResultPreset(document.preset);
                setViewMode('output');
                setError(null);
                setSaveStatus('idle');
                setVersionPreviewLabel(null);
                loadedDocumentIdRef.current = requestedDocumentId;
                loadedVersionIdRef.current = null;
            } catch (documentError) {
                if (cancelled) {
                    return;
                }

                loadedDocumentIdRef.current = null;
                setError(documentError instanceof Error ? documentError.message : 'Unable to load the selected document.');
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [requestedDocumentId, requestedVersionId, sessionReady, user]);

    useEffect(() => {
        if (!requestedDocumentId || !requestedVersionId) {
            return;
        }

        if (!sessionReady) {
            return;
        }

        if (!user) {
            setError('Log in to reload saved document versions from your workspace.');
            return;
        }

        const versionQueryKey = `${requestedDocumentId}:${requestedVersionId}`;

        if (loadedVersionIdRef.current === versionQueryKey) {
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                const { document, version } = await fetchStoredDocumentVersion(requestedDocumentId, requestedVersionId);

                if (cancelled) {
                    return;
                }

                const restoredSettings: HumanizeSettings = {
                    rewriteIntent: version.rewriteIntent ?? DEFAULT_HUMANIZE_SETTINGS.rewriteIntent,
                    tone: version.tone,
                    intensity: version.intensity,
                    vocabLevel: version.vocabLevel,
                    preserveLength: DEFAULT_HUMANIZE_SETTINGS.preserveLength,
                };

                setCurrentDocumentId(document.id);
                setInputText(version.inputText);
                setOriginalText(version.inputText);
                setPreset(version.preset);
                setSettings(restoredSettings);
                setStreamingText('');
                setResult({
                    editedText: version.outputText,
                    changeSummary: generateChangeSummary(version.inputText, version.outputText),
                });
                resetReviewState(version.outputText);
                resetExplanations();
                setResultSettings(restoredSettings);
                setResultPreset(version.preset);
                setViewMode('output');
                setError(null);
                setSaveStatus('idle');
                setVersionPreviewLabel(`Previewing a saved version from ${new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                }).format(new Date(version.createdAt))}`);
                loadedDocumentIdRef.current = null;
                loadedVersionIdRef.current = versionQueryKey;
            } catch (versionError) {
                if (cancelled) {
                    return;
                }

                loadedVersionIdRef.current = null;
                setError(versionError instanceof Error ? versionError.message : 'Unable to load the selected version.');
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [requestedDocumentId, requestedVersionId, sessionReady, user]);

    useEffect(() => {
        if (!showExplanations || explanationsDisabled || !result || !originalText || !diffComparisonEditedText || loading) {
            if (!showExplanations) {
                setExplanationsLoading(false);
            }
            return;
        }

        const requestKey = `${originalText}\u0000${diffComparisonEditedText}`;

        if (explanationRequestKeyRef.current === requestKey) {
            return;
        }

        explanationRequestKeyRef.current = requestKey;
        let cancelled = false;
        setExplanationsLoading(true);

        void (async () => {
            try {
                const nextExplanations = await fetchChangeExplanations({
                    originalText,
                    revisedText: diffComparisonEditedText,
                });

                if (cancelled) {
                    return;
                }

                if (nextExplanations.length === 0) {
                    setExplanations([]);
                    setExplanationsDisabled(true);
                    return;
                }

                setExplanations(nextExplanations);
            } catch {
                if (cancelled) {
                    return;
                }

                setExplanations([]);
                setExplanationsDisabled(true);
            } finally {
                if (!cancelled) {
                    setExplanationsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [diffComparisonEditedText, explanationsDisabled, loading, originalText, result, showExplanations]);

    useEffect(() => {
        if (!pendingSaveRef.current || !user || !sessionReady) {
            return;
        }

        pendingSaveRef.current = false;
        if (!result?.editedText) {
            return;
        }

        const sourceInput = originalText || sanitizeInput(inputText);

        void (async () => {
            setSaveStatus('saving');

            try {
                const document = await saveStoredDocument({
                    documentId: currentDocumentId ?? undefined,
                    inputText: sourceInput,
                    outputText: result.editedText,
                    preset: resultPreset,
                    settings: resultSettings ?? settings,
                });

                setCurrentDocumentId(document.id);
                setSaveStatus('saved');
            } catch (saveError) {
                setSaveStatus('error');
                setError(saveError instanceof Error ? saveError.message : 'Unable to save this document.');
            }
        })();
    }, [
        currentDocumentId,
        inputText,
        originalText,
        result,
        resultPreset,
        resultSettings,
        sessionReady,
        settings,
        user,
    ]);

    const handleSaveDocument = async () => {
        if (!result?.editedText) {
            return;
        }

        setError(null);

        if (!user) {
            pendingSaveRef.current = true;
            openAuthModal('login');
            return;
        }

        if (!sessionReady) {
            setSaveStatus('error');
            setError('Your login session is still syncing. Try again in a second.');
            return;
        }

        const sourceInput = originalText || sanitizeInput(inputText);
        setSaveStatus('saving');

        try {
            const document = await saveStoredDocument({
                documentId: currentDocumentId ?? undefined,
                inputText: sourceInput,
                outputText: result.editedText,
                preset: resultPreset,
                settings: resultSettings ?? settings,
            });

            setCurrentDocumentId(document.id);
            setSaveStatus('saved');
        } catch (saveError) {
            setSaveStatus('error');
            setError(saveError instanceof Error ? saveError.message : 'Unable to save this document.');
        }
    };

    const paragraphOutputContent = paragraphMode && paragraphInputList.length > 0 ? (
        <div className={styles.paragraphOutputStage}>
            {paragraphInputList.map((paragraph, index) => {
                const outputText = paragraphOutputs[index];
                const status = paragraphStatuses[index] ?? 'idle';
                const errorMessage = paragraphErrors[index];
                const isStreamingParagraph = status === 'streaming';
                const hasRefinedOutput = typeof outputText === 'string' && outputText.trim().length > 0;

                return (
                    <article
                        key={`output-${index}`}
                        className={`${styles.paragraphCard} ${styles.paragraphOutputCard} ${!hasRefinedOutput ? styles.paragraphOutputMuted : ''}`}
                    >
                        <div className={styles.paragraphCardHeader}>
                            <span className={styles.paragraphCardLabel}>Output {index + 1}</span>
                            <span className={styles.paragraphStatus}>
                                {status === 'done' ? 'Refined' : status === 'streaming' ? 'Streaming' : status === 'error' ? 'Needs retry' : 'Original'}
                            </span>
                        </div>
                        <p className={styles.paragraphOutputText}>
                            {hasRefinedOutput ? outputText : paragraph}
                            {isStreamingParagraph && <span className={styles.inlineParagraphCursor} />}
                        </p>
                        {errorMessage && <p className={styles.paragraphError}>{errorMessage}</p>}
                    </article>
                );
            })}
        </div>
    ) : undefined;

    const annotatedOutputContent = result && !paragraphMode ? (
        <AnnotatedOutputText
            text={result.editedText}
            grammarIssues={grammarIssues}
            toneIssues={toneIssues}
        />
    ) : undefined;

    return (
        <div className={styles.page}>
            <Header />
            <EthicsModal />

            <main className={styles.main}>
                {/* Hero */}
                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <div className={styles.heroEyebrow}>
                            <span className={styles.heroEyebrowDot} />
                            Refinr editorial cockpit
                        </div>
                        <h1 className={styles.heroTitle}>
                            Turn flat AI copy into
                            <span className={styles.heroTitleAccent}> living prose</span>
                        </h1>
                        <p className={styles.heroSubtitle}>
                            A more tactile editing surface for shaping rhythm, tone, and clarity.
                            Premium feel, transparent output, and zero detector-bypass positioning.
                        </p>
                        <div className={styles.heroActions}>
                            <a href="#editor" className={styles.primaryAction}>
                                Start refining
                            </a>
                            <Link href="/about" className={styles.secondaryAction}>
                                Why it stays ethical
                            </Link>
                        </div>
                        <div className={styles.heroBadges}>
                            <span className={styles.heroBadge}>Readable diffs</span>
                            <span className={styles.heroBadge}>Live tone controls</span>
                            <span className={styles.heroBadge}>Disclosure-first workflow</span>
                        </div>
                    </div>
                    <div className={styles.heroStage}>
                        <div className={styles.heroStageHalo} />
                        <InteractiveTilt className={styles.stageTilt} maxTilt={10}>
                            <div className={styles.stageCard}>
                                <div className={styles.stageCardHeader}>
                                    <span className={styles.stageCardLabel}>Refinement deck</span>
                                    <span className={styles.stageCardStatus}>Live</span>
                                </div>
                                <div className={styles.stageCardBody}>
                                    <div className={styles.stagePrimaryMetric}>
                                        <span className={styles.stageMetricLabel}>Current profile</span>
                                        <strong className={styles.stageMetricValue}>
                                            {settings.rewriteIntent} · {settings.tone}
                                        </strong>
                                    </div>
                                    <div className={styles.stageSettingsGrid}>
                                        <div className={styles.stageSetting}>
                                            <span className={styles.stageSettingLabel}>Intent</span>
                                            <span className={styles.stageSettingValue}>{settings.rewriteIntent}</span>
                                        </div>
                                        <div className={styles.stageSetting}>
                                            <span className={styles.stageSettingLabel}>Tone</span>
                                            <span className={styles.stageSettingValue}>{settings.tone}</span>
                                        </div>
                                        <div className={styles.stageSetting}>
                                            <span className={styles.stageSettingLabel}>Vocabulary</span>
                                            <span className={styles.stageSettingValue}>{settings.vocabLevel}</span>
                                        </div>
                                        <div className={styles.stageSetting}>
                                            <span className={styles.stageSettingLabel}>Length</span>
                                            <span className={styles.stageSettingValue}>
                                                {settings.preserveLength ? 'Preserved' : 'Flexible'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.stagePulseRow}>
                                        <span className={styles.stagePulseLabel}>Editorial signals</span>
                                        <div className={styles.stagePulseBars}>
                                            <span className={styles.stagePulseBar} />
                                            <span className={styles.stagePulseBar} />
                                            <span className={styles.stagePulseBar} />
                                            <span className={styles.stagePulseBar} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </InteractiveTilt>
                        <div className={`${styles.floatingChip} ${styles.floatingChipOne}`}>Natural cadence</div>
                        <div className={`${styles.floatingChip} ${styles.floatingChipTwo}`}>Visible edits</div>
                        <div className={`${styles.floatingChip} ${styles.floatingChipThree}`}>Measured readability</div>
                    </div>
                </section>

                <section className={styles.featureStrip}>
                    <InteractiveTilt className={styles.featureTilt} maxTilt={7}>
                        <article className={styles.featureCard}>
                            <span className={styles.featureIndex}>01</span>
                            <h2 className={styles.featureTitle}>Sharper atmosphere</h2>
                            <p className={styles.featureText}>
                                A layered, cinematic workspace that feels like an editor’s instrument panel instead of a flat form.
                            </p>
                        </article>
                    </InteractiveTilt>
                    <InteractiveTilt className={styles.featureTilt} maxTilt={7}>
                        <article className={styles.featureCard}>
                            <span className={styles.featureIndex}>02</span>
                            <h2 className={styles.featureTitle}>Tighter review loop</h2>
                            <p className={styles.featureText}>
                                Output, diff, readability, and change notes stay visually connected so the rewrite feels inspectable.
                            </p>
                        </article>
                    </InteractiveTilt>
                    <InteractiveTilt className={styles.featureTilt} maxTilt={7}>
                        <article className={styles.featureCard}>
                            <span className={styles.featureIndex}>03</span>
                            <h2 className={styles.featureTitle}>Ethics still front and center</h2>
                            <p className={styles.featureText}>
                                The UI feels more premium now, but the core position remains transparent editing, not evasion.
                            </p>
                        </article>
                    </InteractiveTilt>
                </section>

                {/* Toolbar - Tone Selector */}
                <section className={styles.toolbarShell}>
                    <div className={styles.toolbarHeading}>
                        <div>
                            <p className={styles.toolbarKicker}>Control board</p>
                            <h2 className={styles.toolbarTitle}>Shape the rewrite before it happens</h2>
                        </div>
                        <div className={styles.toolbarSummary}>
                            <span>{preset === 'none' ? 'manual' : preset.replace('-', ' ')}</span>
                            <span>{settings.rewriteIntent}</span>
                            <span>{settings.tone}</span>
                            <span>{settings.intensity}</span>
                            <span>{settings.vocabLevel}</span>
                        </div>
                    </div>
                    <div className={styles.modeRow}>
                        <div className={styles.modeInfo}>
                            <span className={styles.modeLabel}>Paragraph Mode</span>
                            <p className={styles.modeText}>Refine each paragraph independently while keeping the current tone, preset, and vocabulary controls.</p>
                        </div>
                        <button
                            type="button"
                            className={`${styles.modeToggle} ${paragraphMode ? styles.modeToggleActive : ''}`}
                            onClick={handleParagraphModeChange}
                            aria-pressed={paragraphMode}
                        >
                            {paragraphMode ? 'On' : 'Off'}
                        </button>
                    </div>
                    {versionPreviewLabel && (
                        <div className={styles.versionPreviewBanner}>
                            <div>
                                <span className={styles.versionPreviewEyebrow}>Read-only preview</span>
                                <p className={styles.versionPreviewText}>{versionPreviewLabel}</p>
                            </div>
                            <button
                                type="button"
                                className={styles.versionPreviewButton}
                                onClick={handleEditVersion}
                            >
                                Edit this version
                            </button>
                        </div>
                    )}
                    <div className={styles.toolbar}>
                        <button
                            type="button"
                            className={styles.toolbarToggle}
                            onClick={() => setToolbarOpen(!toolbarOpen)}
                        >
                            {toolbarOpen ? '▲' : '▼'} Settings — {settings.rewriteIntent} · {settings.tone} · {settings.intensity}
                        </button>
                        <div className={`${styles.toolbarContent} ${toolbarOpen ? styles.toolbarContentOpen : ''}`}>
                            <ToneSelector
                                preset={preset}
                                settings={settings}
                                onPresetChange={handlePresetChange}
                                onChange={setSettings}
                                onHumanize={handleHumanize}
                                loading={loading}
                                disabled={isDisabled}
                                voiceDNAAvailable={voiceDNAAvailable}
                                voiceDNAActive={voiceDNAActive}
                                onVoiceDNAToggle={setVoiceDNAActive}
                                isLoggedIn={!!user}
                            />
                        </div>
                        <div className={styles.toolbarDesktop}>
                            <ToneSelector
                                preset={preset}
                                settings={settings}
                                onPresetChange={handlePresetChange}
                                onChange={setSettings}
                                onHumanize={handleHumanize}
                                loading={loading}
                                disabled={isDisabled}
                                voiceDNAAvailable={voiceDNAAvailable}
                                voiceDNAActive={voiceDNAActive}
                                onVoiceDNAToggle={setVoiceDNAActive}
                                isLoggedIn={!!user}
                            />
                        </div>
                        {versionPreviewLabel && <div className={styles.toolbarOverlay} aria-hidden="true" />}
                    </div>
                </section>

                {/* Editor Split Pane */}
                <div className={styles.editorShell} id="editor">
                    <div className={styles.editorShellHeader}>
                        <div>
                            <p className={styles.editorShellKicker}>Workspace</p>
                            <h2 className={styles.editorShellTitle}>Draft on the left, refined prose on the right</h2>
                        </div>
                        <p className={styles.editorShellText}>
                            Upload rough text, run the pass, then review every change with output actions and readability context.
                        </p>
                    </div>
                    <div className={styles.editorArea}>
                        <div className={styles.inputPane}>
                            {paragraphMode ? (
                                <div className={styles.paragraphEditor}>
                                    <div className={styles.paragraphEditorHeader}>
                                        <div>
                                            <span className={styles.paragraphEditorEyebrow}>Paragraph controls</span>
                                            <p className={styles.paragraphEditorText}>
                                                Refine individual blocks or run the whole document sequentially with a short delay between calls.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.paragraphRefineAll}
                                            onClick={() => void handleRefineAllParagraphs()}
                                            disabled={!canRunParagraphMode || loading || !!versionPreviewLabel}
                                        >
                                            {loading ? 'Refining...' : 'Refine All'}
                                        </button>
                                    </div>

                                    {error && <div className={styles.paragraphAlert}>{error}</div>}

                                    {paragraphInputList.length === 0 ? (
                                        <div className={styles.paragraphEmptyState}>
                                            Add some text to split it into paragraph cards.
                                        </div>
                                    ) : (
                                        <div className={styles.paragraphList}>
                                            {paragraphInputList.map((paragraph, index) => (
                                                <article key={`input-${index}`} className={styles.paragraphCard}>
                                                    <div className={styles.paragraphCardHeader}>
                                                        <span className={styles.paragraphCardLabel}>Paragraph {index + 1}</span>
                                                        <button
                                                            type="button"
                                                            className={styles.paragraphRefineOne}
                                                            onClick={() => void handleRefineSingleParagraph(index)}
                                                            disabled={loading || !!versionPreviewLabel || !paragraph.trim()}
                                                            aria-label={`Refine paragraph ${index + 1}`}
                                                        >
                                                            ✨
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        className={styles.paragraphTextarea}
                                                        value={paragraph}
                                                        onChange={event => handleParagraphInputChange(index, event.target.value)}
                                                        disabled={loading || !!versionPreviewLabel}
                                                    />
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <TextEditor
                                    value={inputText}
                                    onChange={setInputText}
                                    disabled={loading || !!versionPreviewLabel}
                                />
                            )}
                        </div>
                        <div className={styles.outputPane}>
                            <OutputPanel
                                text={paragraphMode ? (result?.editedText || '') : result?.editedText || streamingText}
                                loading={loading}
                                error={paragraphMode && paragraphInputList.length > 0 ? null : error}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                hasResult={paragraphMode ? paragraphInputList.length > 0 : !!result || streamingText.length > 0}
                                showResultActions={paragraphMode ? !!result : undefined}
                                onUseAsInput={handleUseResultAsInput}
                                onSaveDocument={result ? handleSaveDocument : undefined}
                                saveStatus={saveStatus}
                                onUndo={handleUndo}
                                canUndo={undoStackRef.current.length > 0}
                                readOnlyPreview={!!versionPreviewLabel}
                                outputContent={paragraphMode ? paragraphOutputContent : annotatedOutputContent}
                                showStreamingCursor={loading && streamingText.length > 0}
                                voiceMatchScore={voiceDNAActive ? voiceMatchScore : null}
                                diffContent={
                                    result ? (
                                        <div className={styles.diffPane}>
                                            <div className={styles.diffControls}>
                                                <div className={styles.diffControlsPrimary}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.diffToggle} ${showExplanations ? styles.diffToggleActive : ''}`}
                                                        onClick={() => setShowExplanations(prev => !prev)}
                                                        aria-pressed={showExplanations}
                                                    >
                                                        {showExplanations ? 'Hide Explanations' : 'Show Explanations'}
                                                    </button>
                                                    {showExplanations && explanationsLoading && !explanationsDisabled && (
                                                        <span className={styles.diffStatus}>Generating explanations...</span>
                                                    )}
                                                </div>
                                                {reviewSummary.total > 0 && !versionPreviewLabel && (
                                                    <div className={styles.reviewToolbar}>
                                                        <span className={styles.reviewSummary}>
                                                            {reviewSummary.accepted} kept · {reviewSummary.rejected} reverted · {reviewSummary.pending} pending
                                                        </span>
                                                        <div className={styles.reviewToolbarActions}>
                                                            <button
                                                                type="button"
                                                                className={styles.reviewToolbarButton}
                                                                onClick={() => handleReviewDecisionBatch('accepted')}
                                                                disabled={reviewSummary.pending === 0 && reviewSummary.rejected === 0}
                                                            >
                                                                Keep all
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.reviewToolbarButton}
                                                                onClick={() => handleReviewDecisionBatch('rejected')}
                                                                disabled={reviewSummary.pending === 0 && reviewSummary.accepted === 0}
                                                            >
                                                                Revert all
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.reviewToolbarButton}
                                                                onClick={handleResetReview}
                                                                disabled={reviewSummary.accepted === 0 && reviewSummary.rejected === 0}
                                                            >
                                                                Reset review
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <DiffView
                                                original={originalText}
                                                edited={diffComparisonEditedText}
                                                explanations={showExplanations && !explanationsDisabled ? explanations : []}
                                                showExplanations={showExplanations && !explanationsDisabled}
                                                reviewDecisions={reviewDecisions}
                                                onReviewDecision={!versionPreviewLabel ? handleReviewDecision : undefined}
                                            />
                                        </div>
                                    ) : undefined
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Panels: Readability + Change Summary */}
                {result && (
                    <div className={styles.bottomPanels}>
                        <div className={styles.scorePanel}>
                            <div className={styles.scorePanelHeader}>📊 Readability Analysis</div>
                            <div className={styles.analysisStack}>
                                <ReadabilityScore
                                    originalText={originalText}
                                    editedText={result.editedText}
                                />
                                <GrammarChecker
                                    text={result.editedText}
                                    readOnly={!!versionPreviewLabel}
                                    onTextChange={handleResultTextChange}
                                    onIssuesChange={setGrammarIssues}
                                />
                                <ToneChecker
                                    text={result.editedText}
                                    targetTone={(resultSettings ?? settings).tone}
                                    settings={resultSettings ?? settings}
                                    preset={resultPreset}
                                    readOnly={!!versionPreviewLabel}
                                    onTextChange={handleResultTextChange}
                                    onIssuesChange={setToneIssues}
                                />
                            </div>
                        </div>
                        <div className={styles.changesPanel}>
                            <ChangeSummary changes={result.changeSummary} />
                        </div>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
