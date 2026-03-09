import { NextRequest, NextResponse } from 'next/server';
import {
    DEFAULT_HUMANIZE_SETTINGS,
    DEFAULT_REWRITE_PRESET,
    isValidHumanizeSettings,
    isValidRewritePreset,
} from '@/lib/config';
import { saveUserDocument } from '@/lib/document-store';
import { SaveDocumentRequest } from '@/lib/documents';
import { SESSION_COOKIE_NAME, verifyFirebaseSessionCookie } from '@/lib/firebase-admin';
import { HumanizeSettings, RewritePreset } from '@/lib/prompt';
import { sanitizeInput, validateInput } from '@/lib/sanitize';

function getUnauthorizedResponse() {
    return NextResponse.json(
        { error: 'You must be logged in to save documents.' },
        { status: 401 }
    );
}

export async function POST(request: NextRequest) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
        return getUnauthorizedResponse();
    }

    let decodedToken;

    try {
        decodedToken = await verifyFirebaseSessionCookie(sessionCookie, true);
    } catch {
        return getUnauthorizedResponse();
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON body.' },
            { status: 400 }
        );
    }

    const requestBody = (body ?? {}) as Partial<SaveDocumentRequest>;
    const safeInputText = typeof requestBody.inputText === 'string' ? sanitizeInput(requestBody.inputText) : '';
    const safeOutputText = typeof requestBody.outputText === 'string' ? sanitizeInput(requestBody.outputText) : '';

    if (!safeInputText || !safeOutputText) {
        return NextResponse.json(
            { error: 'Both input and output text are required.' },
            { status: 400 }
        );
    }

    const inputValidation = validateInput(safeInputText);
    if (!inputValidation.valid) {
        return NextResponse.json(
            { error: inputValidation.error },
            { status: 400 }
        );
    }

    if (requestBody.settings !== undefined && !isValidHumanizeSettings(requestBody.settings)) {
        return NextResponse.json(
            { error: 'Invalid settings provided.' },
            { status: 400 }
        );
    }

    if (requestBody.preset !== undefined && !isValidRewritePreset(requestBody.preset)) {
        return NextResponse.json(
            { error: 'Invalid preset provided.' },
            { status: 400 }
        );
    }

    const safeSettings: HumanizeSettings = isValidHumanizeSettings(requestBody.settings)
        ? requestBody.settings
        : DEFAULT_HUMANIZE_SETTINGS;
    const safePreset: RewritePreset = isValidRewritePreset(requestBody.preset)
        ? requestBody.preset
        : DEFAULT_REWRITE_PRESET;

    try {
        const document = await saveUserDocument(decodedToken.uid, {
            documentId: typeof requestBody.documentId === 'string' ? requestBody.documentId : undefined,
            inputText: safeInputText,
            outputText: safeOutputText,
            preset: safePreset,
            settings: safeSettings,
        });

        return NextResponse.json({ document });
    } catch (error) {
        console.error('Failed to save user document:', error);

        return NextResponse.json(
            { error: 'Unable to save your document right now.' },
            { status: 500 }
        );
    }
}
