import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

export const SESSION_COOKIE_NAME = 'refinr_session';
export const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;
const E2E_TEST_SESSION_COOKIE = 'e2e-test-session';
const E2E_TEST_SESSION_USER: SessionUser = {
    uid: 'e2e-user',
    email: 'e2e@refinr.test',
    name: 'Refinr E2E',
    picture: null,
};

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

interface CookieStoreLike {
    get(name: string): { value: string } | undefined;
}

export interface SessionUser {
    uid: string;
    email: string | null;
    name: string | null;
    picture: string | null;
}

function isE2ETestMode(): boolean {
    return process.env.E2E_TEST_MODE === '1';
}

function isE2ETestSessionCookie(sessionCookie: string): boolean {
    return isE2ETestMode() && sessionCookie === E2E_TEST_SESSION_COOKIE;
}

function getE2ETestDecodedToken(): DecodedIdToken {
    return {
        uid: E2E_TEST_SESSION_USER.uid,
        email: E2E_TEST_SESSION_USER.email ?? undefined,
        name: E2E_TEST_SESSION_USER.name ?? undefined,
        picture: E2E_TEST_SESSION_USER.picture ?? undefined,
    } as unknown as DecodedIdToken;
}

function readFirebaseAdminConfig(): FirebaseAdminConfig | null {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey,
    };
}

export function isFirebaseAdminConfigured(): boolean {
    return isE2ETestMode() || readFirebaseAdminConfig() !== null;
}

function getFirebaseAdminApp(): App | null {
    const config = readFirebaseAdminConfig();

    if (!config) {
        return null;
    }

    return getApps().length > 0
        ? getApp()
        : initializeApp({
            credential: cert(config),
            projectId: config.projectId,
        });
}

export function getFirebaseAdminAuth(): Auth | null {
    const app = getFirebaseAdminApp();
    return app ? getAuth(app) : null;
}

export function getFirebaseAdminDb(): Firestore | null {
    const app = getFirebaseAdminApp();
    return app ? getFirestore(app) : null;
}

export async function createFirebaseSessionCookie(idToken: string): Promise<string> {
    const auth = getFirebaseAdminAuth();

    if (!auth) {
        throw new Error('Firebase Admin is not configured.');
    }

    return auth.createSessionCookie(idToken, {
        expiresIn: SESSION_COOKIE_MAX_AGE_MS,
    });
}

export async function verifyFirebaseSessionCookie(
    sessionCookie: string,
    checkRevoked = true
): Promise<DecodedIdToken> {
    if (isE2ETestSessionCookie(sessionCookie)) {
        return getE2ETestDecodedToken();
    }

    const auth = getFirebaseAdminAuth();

    if (!auth) {
        throw new Error('Firebase Admin is not configured.');
    }

    return auth.verifySessionCookie(sessionCookie, checkRevoked);
}

export function mapDecodedTokenToSessionUser(token: DecodedIdToken): SessionUser {
    return {
        uid: token.uid,
        email: token.email ?? null,
        name: typeof token.name === 'string' ? token.name : null,
        picture: typeof token.picture === 'string' ? token.picture : null,
    };
}

export async function getSessionUserFromCookies(cookieStore: CookieStoreLike): Promise<SessionUser | null> {
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
        return null;
    }

    if (isE2ETestSessionCookie(sessionCookie)) {
        return E2E_TEST_SESSION_USER;
    }

    try {
        const decoded = await verifyFirebaseSessionCookie(sessionCookie, true);
        return mapDecodedTokenToSessionUser(decoded);
    } catch {
        return null;
    }
}
