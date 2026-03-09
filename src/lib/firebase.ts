import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

interface FirebaseClientConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId: string;
}

function readFirebaseClientConfig(): FirebaseClientConfig | null {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

    if (!apiKey || !authDomain || !projectId || !appId) {
        return null;
    }

    return {
        apiKey,
        authDomain,
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId,
    };
}

export function hasFirebaseClientConfig(): boolean {
    return readFirebaseClientConfig() !== null;
}

export function getFirebaseClientApp(): FirebaseApp | null {
    const config = readFirebaseClientConfig();

    if (!config) {
        return null;
    }

    return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseAuthClient(): Auth | null {
    const app = getFirebaseClientApp();
    return app ? getAuth(app) : null;
}
