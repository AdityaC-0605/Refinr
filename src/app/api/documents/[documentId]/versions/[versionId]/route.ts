import { NextRequest, NextResponse } from 'next/server';
import { getUserDocument, getUserDocumentVersion } from '@/lib/document-store';
import { SESSION_COOKIE_NAME, verifyFirebaseSessionCookie } from '@/lib/firebase-admin';

function getUnauthorizedResponse() {
    return NextResponse.json(
        { error: 'You must be logged in to view document versions.' },
        { status: 401 }
    );
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ documentId: string; versionId: string }> }
) {
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

    const { documentId, versionId } = await context.params;

    try {
        const document = await getUserDocument(decodedToken.uid, documentId);

        if (!document) {
            return NextResponse.json(
                { error: 'Document not found.' },
                { status: 404 }
            );
        }

        const version = await getUserDocumentVersion(decodedToken.uid, documentId, versionId);

        if (!version) {
            return NextResponse.json(
                { error: 'Version not found.' },
                { status: 404 }
            );
        }

        return NextResponse.json({ document, version });
    } catch (error) {
        console.error('Failed to fetch document version:', error);

        return NextResponse.json(
            { error: 'Unable to load that version right now.' },
            { status: 500 }
        );
    }
}
