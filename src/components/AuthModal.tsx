'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import styles from './AuthModal.module.css';

export default function AuthModal() {
    const {
        authEnabled,
        authMode,
        continueWithGoogle,
        closeAuthModal,
        isAuthModalOpen,
        loginWithEmail,
        signupWithEmail,
        user,
        openAuthModal,
    } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthModalOpen) {
            setError(null);
            setPassword('');
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeAuthModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeAuthModal, isAuthModalOpen]);

    useEffect(() => {
        if (user && isAuthModalOpen) {
            closeAuthModal();
            setError(null);
            setPassword('');
        }
    }, [closeAuthModal, isAuthModalOpen, user]);

    if (!isAuthModalOpen) {
        return null;
    }

    const handleEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            if (authMode === 'login') {
                await loginWithEmail(email.trim(), password);
            } else {
                await signupWithEmail(email.trim(), password);
            }
        } catch (authError) {
            setError(authError instanceof Error ? authError.message : 'Unable to continue.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogle = async () => {
        setSubmitting(true);
        setError(null);

        try {
            await continueWithGoogle();
        } catch (authError) {
            setError(authError instanceof Error ? authError.message : 'Unable to continue with Google.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
            <button
                type="button"
                className={styles.scrim}
                onClick={closeAuthModal}
                aria-label="Close authentication dialog"
            />
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div>
                        <span className={styles.eyebrow}>Account</span>
                        <h2 className={styles.title} id="auth-modal-title">
                            {authMode === 'login' ? 'Log in to save your drafts' : 'Create your Refinr account'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={closeAuthModal}
                        aria-label="Close authentication dialog"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.modeSwitch}>
                    <button
                        type="button"
                        className={`${styles.modeButton} ${authMode === 'login' ? styles.modeButtonActive : ''}`}
                        onClick={() => openAuthModal('login')}
                    >
                        Log in
                    </button>
                    <button
                        type="button"
                        className={`${styles.modeButton} ${authMode === 'signup' ? styles.modeButtonActive : ''}`}
                        onClick={() => openAuthModal('signup')}
                    >
                        Sign up
                    </button>
                </div>

                <p className={styles.subtitle}>
                    Use email/password or Google to save refined documents and reopen them later from your workspace.
                </p>

                {!authEnabled && (
                    <div className={styles.notice}>
                        Firebase client configuration is missing. Add your Firebase env vars to `.env.local` to enable authentication.
                    </div>
                )}

                <form className={styles.form} onSubmit={handleEmailAuth}>
                    <label className={styles.field}>
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                            disabled={submitting || !authEnabled}
                        />
                    </label>

                    <label className={styles.field}>
                        <span>Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            placeholder="••••••••"
                            autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                            minLength={6}
                            required
                            disabled={submitting || !authEnabled}
                        />
                    </label>

                    {error && <div className={styles.error}>{error}</div>}

                    <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={submitting || !authEnabled}
                    >
                        {submitting ? 'Working...' : authMode === 'login' ? 'Log in with email' : 'Create account'}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span />
                    <strong>or</strong>
                    <span />
                </div>

                <button
                    type="button"
                    className={styles.googleButton}
                    onClick={handleGoogle}
                    disabled={submitting || !authEnabled}
                >
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
