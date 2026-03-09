import { NextRequest, NextResponse } from 'next/server';
import { getUserDocument, listUserDocumentVersions } from '@/lib/document-store';
import { SESSION_COOKIE_NAME, verifyFirebaseSessionCookie } from '@/lib/firebase-admin';

function getUnauthorizedResponse() {
    return NextResponse.json(
        { error: 'You must be logged in to view document history.' },
        { status: 401 }
    );
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ documentId: string }> }
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

    const { documentId } = await context.params;

    try {
        const document = await getUserDocument(decodedToken.uid, documentId);

        if (!document) {
            return NextResponse.json(
                { error: 'Document not found.' },
                { status: 404 }
            );
        }

        const versions = await listUserDocumentVersions(decodedToken.uid, documentId);
        return NextResponse.json({ document, versions });
    } catch (error) {
        console.error('Failed to fetch document history:', error);

        return NextResponse.json(
            { error: 'Unable to load document history right now.' },
            { status: 500 }
        );
    }
}
