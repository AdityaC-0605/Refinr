import type { HumanizeSettings, RewritePreset } from './prompt.ts';

export interface StreamCompletePayload {
    edited_text: string;
    change_summary: string[];
}

interface ParsedSseEvent {
    event: string;
    data: string;
}

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

export async function streamRefinementRequest(payload: {
    text: string;
    settings: HumanizeSettings;
    preset: RewritePreset;
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
