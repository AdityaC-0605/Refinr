'use client';

import {
    GoogleAuthProvider,
    User,
    createUserWithEmailAndPassword,
    onIdTokenChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from 'firebase/auth';
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react';
import { getFirebaseAuthClient, hasFirebaseClientConfig } from '@/lib/firebase';
import AuthModal from './AuthModal';

type AuthMode = 'login' | 'signup';
const E2E_AUTH_STORAGE_KEY = 'refinr-e2e-authenticated';
const E2E_TEST_USER = {
    uid: 'e2e-user',
    email: 'e2e@refinr.test',
    displayName: 'Refinr E2E',
} as User;

interface AuthContextValue {
    authEnabled: boolean;
    authReady: boolean;
    sessionReady: boolean;
    user: User | null;
    isAuthModalOpen: boolean;
    authMode: AuthMode;
    openAuthModal: (mode?: AuthMode) => void;
    closeAuthModal: () => void;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    signupWithEmail: (email: string, password: string) => Promise<void>;
    continueWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncSessionCookie(idToken: string | null) {
    const endpoint = idToken ? '/api/auth/session-login' : '/api/auth/session-logout';
    const options = idToken
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        }
        : { method: 'POST' };

    const response = await fetch(endpoint, options);

    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to sync your login session.' })) as {
            error?: string;
        };

        throw new Error(payload.error || 'Unable to sync your login session.');
    }
}

function isE2ETestMode(): boolean {
    return process.env.NEXT_PUBLIC_E2E_TEST_MODE === '1';
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider.');
    }

    return context;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const authEnabled = hasFirebaseClientConfig();
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(!authEnabled);
    const [sessionReady, setSessionReady] = useState(!authEnabled);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>('login');

    useEffect(() => {
        const auth = getFirebaseAuthClient();

        if (!auth) {
            if (isE2ETestMode()) {
                const isAuthenticated = window.localStorage.getItem(E2E_AUTH_STORAGE_KEY) === 'true';
                setUser(isAuthenticated ? E2E_TEST_USER : null);
            }
            setAuthReady(true);
            setSessionReady(true);
            return;
        }

        const unsubscribe = onIdTokenChanged(auth, async nextUser => {
            setSessionReady(false);

            try {
                if (nextUser) {
                    const idToken = await nextUser.getIdToken();
                    await syncSessionCookie(idToken);
                } else {
                    await syncSessionCookie(null);
                }

                setUser(nextUser);
            } catch (error) {
                console.error('Failed to sync Firebase session cookie:', error);
                setUser(nextUser);
            } finally {
                setAuthReady(true);
                setSessionReady(true);
            }
        });

        return unsubscribe;
    }, [authEnabled]);

    const openAuthModal = (mode: AuthMode = 'login') => {
        setAuthMode(mode);
        setIsAuthModalOpen(true);
    };

    const closeAuthModal = () => {
        setIsAuthModalOpen(false);
    };

    const loginWithEmail = async (email: string, password: string) => {
        const auth = getFirebaseAuthClient();

        if (!auth) {
            throw new Error('Firebase authentication is not configured.');
        }

        await signInWithEmailAndPassword(auth, email, password);
    };

    const signupWithEmail = async (email: string, password: string) => {
        const auth = getFirebaseAuthClient();

        if (!auth) {
            throw new Error('Firebase authentication is not configured.');
        }

        await createUserWithEmailAndPassword(auth, email, password);
    };

    const continueWithGoogle = async () => {
        const auth = getFirebaseAuthClient();

        if (!auth) {
            throw new Error('Firebase authentication is not configured.');
        }

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
    };

    const logout = async () => {
        const auth = getFirebaseAuthClient();

        if (!auth) {
            if (isE2ETestMode()) {
                window.localStorage.removeItem(E2E_AUTH_STORAGE_KEY);
            }
            setUser(null);
            return;
        }

        await signOut(auth);
    };

    const value: AuthContextValue = {
        authEnabled,
        authReady,
        sessionReady,
        user,
        isAuthModalOpen,
        authMode,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        signupWithEmail,
        continueWithGoogle,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            <AuthModal />
        </AuthContext.Provider>
    );
}
