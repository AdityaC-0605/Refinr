import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from './firebase-admin.ts';
import type { VoiceDNAProfile } from './voice-types.ts';

const profileCache = new Map<string, VoiceDNAProfile>();

interface FirestoreProfileRecord {
    userId?: string;
    createdAt?: Timestamp | Date | string;
    updatedAt?: Timestamp | Date | string;
    sampleCount?: number;
    totalWordCount?: number;
    statistical?: VoiceDNAProfile['statistical'];
    qualitative?: VoiceDNAProfile['qualitative'];
    promptFragment?: string;
}

function toIsoString(value: Timestamp | Date | string | undefined): string {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return new Date().toISOString();
}

function mapProfileRecord(record: FirestoreProfileRecord, userId: string): VoiceDNAProfile | null {
    if (!record.statistical || !record.promptFragment) {
        return null;
    }

    return {
        userId,
        createdAt: toIsoString(record.createdAt),
        updatedAt: toIsoString(record.updatedAt),
        sampleCount: record.sampleCount ?? 0,
        totalWordCount: record.totalWordCount ?? 0,
        statistical: record.statistical,
        qualitative: record.qualitative ?? null,
        promptFragment: record.promptFragment,
    };
}

function getProfileDocRef(userId: string) {
    const db = getFirebaseAdminDb();

    if (!db) {
        return null;
    }

    return db.collection('users').doc(userId).collection('voiceDNA').doc('profile');
}

export async function loadVoiceProfile(userId: string): Promise<VoiceDNAProfile | null> {
    const cached = profileCache.get(userId);

    if (cached) {
        return cached;
    }

    try {
        const docRef = getProfileDocRef(userId);

        if (!docRef) {
            return null;
        }

        const snapshot = await docRef.get();

        if (!snapshot.exists) {
            return null;
        }

        const profile = mapProfileRecord(snapshot.data() as FirestoreProfileRecord, userId);

        if (profile) {
            profileCache.set(userId, profile);
        }

        return profile;
    } catch {
        return null;
    }
}

export async function saveVoiceProfile(userId: string, profile: VoiceDNAProfile): Promise<boolean> {
    try {
        const docRef = getProfileDocRef(userId);

        if (!docRef) {
            return false;
        }

        await docRef.set({
            userId: profile.userId,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            sampleCount: profile.sampleCount,
            totalWordCount: profile.totalWordCount,
            statistical: profile.statistical,
            qualitative: profile.qualitative,
            promptFragment: profile.promptFragment,
        });

        profileCache.set(userId, profile);
        return true;
    } catch {
        return false;
    }
}

export async function deleteVoiceProfile(userId: string): Promise<boolean> {
    try {
        const docRef = getProfileDocRef(userId);

        if (!docRef) {
            return false;
        }

        await docRef.delete();
        profileCache.delete(userId);
        return true;
    } catch {
        return false;
    }
}
