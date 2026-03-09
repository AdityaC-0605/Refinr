import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifyFirebaseSessionCookie } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    try {
        await verifyFirebaseSessionCookie(sessionCookie, true);
        return NextResponse.next();
    } catch {
        const response = NextResponse.redirect(new URL('/', request.url));
        response.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: '',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0,
        });
        return response;
    }
}

export const config = {
    matcher: ['/documents/:path*'],
};
