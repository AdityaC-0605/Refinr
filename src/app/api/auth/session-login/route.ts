import { NextRequest, NextResponse } from 'next/server';
import {
    SESSION_COOKIE_MAX_AGE_MS,
    SESSION_COOKIE_NAME,
    createFirebaseSessionCookie,
    isFirebaseAdminConfigured,
} from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    if (!isFirebaseAdminConfigured()) {
        return NextResponse.json(
            { error: 'Firebase Admin is not configured.' },
            { status: 503 }
        );
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

    const idToken = typeof (body as { idToken?: unknown })?.idToken === 'string'
        ? (body as { idToken: string }).idToken
        : '';

    if (!idToken) {
        return NextResponse.json(
            { error: 'ID token is required.' },
            { status: 400 }
        );
    }

    try {
        const sessionCookie = await createFirebaseSessionCookie(idToken);
        const response = NextResponse.json({ ok: true });

        response.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: sessionCookie,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: Math.floor(SESSION_COOKIE_MAX_AGE_MS / 1000),
        });

        return response;
    } catch (error) {
        console.error('Failed to create Firebase session cookie:', error);

        return NextResponse.json(
            { error: 'Unable to create a login session.' },
            { status: 401 }
        );
    }
}
