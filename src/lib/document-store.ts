import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from './firebase-admin.ts';
import {
    SaveDocumentRequest,
    StoredDocument,
    StoredDocumentVersion,
    deriveDocumentTitle,
} from './documents.ts';
import { toIsoString } from './timestamp.ts';

const E2E_TEST_USER_ID = 'e2e-user';
const E2E_FIXTURE_DOCUMENTS: StoredDocument[] = [
    {
        id: 'e2e-doc-1',
        title: 'Quarterly update draft',
        inputText: 'This quarterly update feels stiff and repetitive, and it needs a clearer executive tone.',
        outputText: 'This quarterly update now reads with a clearer executive tone and less repetition.',
        preset: 'email',
        rewriteIntent: 'clarify',
        tone: 'professional',
        intensity: 'moderate',
        vocabLevel: 'standard',
        createdAt: '2026-03-01T08:30:00.000Z',
        updatedAt: '2026-03-04T10:15:00.000Z',
    },
    {
        id: 'e2e-doc-2',
        title: 'LinkedIn launch post',
        inputText: 'We are excited to announce our product launch and would like it to sound more direct.',
        outputText: 'We are excited to share our launch with a more direct, polished voice.',
        preset: 'linkedin-post',
        rewriteIntent: 'persuasive',
        tone: 'friendly',
        intensity: 'light',
        vocabLevel: 'standard',
        createdAt: '2026-02-20T12:00:00.000Z',
        updatedAt: '2026-02-22T09:45:00.000Z',
    },
];
const E2E_FIXTURE_VERSIONS: Record<string, StoredDocumentVersion[]> = {
    'e2e-doc-1': [
        {
            id: 'e2e-ver-2',
            inputText: 'This quarterly update feels stiff and repetitive, and it needs a clearer executive tone.',
            outputText: 'This quarterly update now reads with a clearer executive tone and less repetition.',
            preset: 'email',
            rewriteIntent: 'clarify',
            tone: 'professional',
            intensity: 'moderate',
            vocabLevel: 'standard',
            createdAt: '2026-03-04T10:15:00.000Z',
        },
        {
            id: 'e2e-ver-1',
            inputText: 'This quarterly update feels stiff and repetitive.',
            outputText: 'This quarterly update now feels more direct and polished.',
            preset: 'email',
            rewriteIntent: 'tighten',
            tone: 'professional',
            intensity: 'light',
            vocabLevel: 'standard',
            createdAt: '2026-03-02T08:00:00.000Z',
        },
    ],
    'e2e-doc-2': [
        {
            id: 'e2e-ver-3',
            inputText: 'We are excited to announce our product launch and would like it to sound more direct.',
            outputText: 'We are excited to share our launch with a more direct, polished voice.',
            preset: 'linkedin-post',
            rewriteIntent: 'persuasive',
            tone: 'friendly',
            intensity: 'light',
            vocabLevel: 'standard',
            createdAt: '2026-02-22T09:45:00.000Z',
        },
    ],
};

function isE2ETestMode(): boolean {
    return process.env.E2E_TEST_MODE === '1';
}

function isE2ETestUser(userId: string): boolean {
    return isE2ETestMode() && userId === E2E_TEST_USER_ID;
}

interface FirestoreDocumentRecord {
    id?: string;
    title?: string;
    inputText?: string;
    outputText?: string;
    preset?: StoredDocument['preset'];
    rewriteIntent?: StoredDocument['rewriteIntent'];
    tone?: StoredDocument['tone'];
    intensity?: StoredDocument['intensity'];
    vocabLevel?: StoredDocument['vocabLevel'];
    createdAt?: Timestamp | Date | string;
    updatedAt?: Timestamp | Date | string;
}

interface FirestoreVersionRecord {
    id?: string;
    inputText?: string;
    outputText?: string;
    preset?: StoredDocumentVersion['preset'];
    rewriteIntent?: StoredDocumentVersion['rewriteIntent'];
    tone?: StoredDocumentVersion['tone'];
    intensity?: StoredDocumentVersion['intensity'];
    vocabLevel?: StoredDocumentVersion['vocabLevel'];
    createdAt?: Timestamp | Date | string;
}

function mapDocumentRecord(id: string, record: FirestoreDocumentRecord): StoredDocument {
    return {
        id,
        title: record.title ?? 'Untitled draft',
        inputText: record.inputText ?? '',
        outputText: record.outputText ?? '',
        preset: record.preset ?? 'none',
        rewriteIntent: record.rewriteIntent ?? 'humanize',
        tone: record.tone ?? 'professional',
        intensity: record.intensity ?? 'moderate',
        vocabLevel: record.vocabLevel ?? 'standard',
        createdAt: toIsoString(record.createdAt),
        updatedAt: toIsoString(record.updatedAt),
    };
}

function mapVersionRecord(id: string, record: FirestoreVersionRecord): StoredDocumentVersion {
    return {
        id,
        inputText: record.inputText ?? '',
        outputText: record.outputText ?? '',
        preset: record.preset ?? 'none',
        rewriteIntent: record.rewriteIntent ?? 'humanize',
        tone: record.tone ?? 'professional',
        intensity: record.intensity ?? 'moderate',
        vocabLevel: record.vocabLevel ?? 'standard',
        createdAt: toIsoString(record.createdAt),
    };
}

function getDocumentsCollection(userId: string) {
    const db = getFirebaseAdminDb();

    if (!db) {
        throw new Error('Firebase Admin is not configured.');
    }

    return db.collection('users').doc(userId).collection('documents');
}

function getVersionsCollection(userId: string, documentId: string) {
    return getDocumentsCollection(userId).doc(documentId).collection('versions');
}

export async function saveUserDocument(userId: string, payload: SaveDocumentRequest): Promise<StoredDocument> {
    if (isE2ETestUser(userId)) {
        const existing = payload.documentId
            ? E2E_FIXTURE_DOCUMENTS.find(document => document.id === payload.documentId)
            : null;
        const now = new Date().toISOString();

        return {
            id: existing?.id ?? payload.documentId ?? 'e2e-doc-saved',
            title: deriveDocumentTitle(payload.inputText, payload.preset),
            inputText: payload.inputText,
            outputText: payload.outputText,
            preset: payload.preset,
            rewriteIntent: payload.settings.rewriteIntent,
            tone: payload.settings.tone,
            intensity: payload.settings.intensity,
            vocabLevel: payload.settings.vocabLevel,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
    }

    const documents = getDocumentsCollection(userId);
    const documentRef = payload.documentId
        ? documents.doc(payload.documentId)
        : documents.doc();
    const versionRef = getVersionsCollection(userId, documentRef.id).doc();

    const existingSnapshot = await documentRef.get();

    await Promise.all([
        documentRef.set({
            id: documentRef.id,
            title: deriveDocumentTitle(payload.inputText, payload.preset),
            inputText: payload.inputText,
            outputText: payload.outputText,
            preset: payload.preset,
            rewriteIntent: payload.settings.rewriteIntent,
            tone: payload.settings.tone,
            intensity: payload.settings.intensity,
            vocabLevel: payload.settings.vocabLevel,
            createdAt: existingSnapshot.exists
                ? existingSnapshot.get('createdAt') ?? FieldValue.serverTimestamp()
                : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true }),
        versionRef.set({
            id: versionRef.id,
            inputText: payload.inputText,
            outputText: payload.outputText,
            preset: payload.preset,
            rewriteIntent: payload.settings.rewriteIntent,
            tone: payload.settings.tone,
            intensity: payload.settings.intensity,
            vocabLevel: payload.settings.vocabLevel,
            createdAt: FieldValue.serverTimestamp(),
        }),
    ]);

    const savedSnapshot = await documentRef.get();
    return mapDocumentRecord(documentRef.id, savedSnapshot.data() as FirestoreDocumentRecord);
}

export async function getUserDocument(userId: string, documentId: string): Promise<StoredDocument | null> {
    if (isE2ETestUser(userId)) {
        return E2E_FIXTURE_DOCUMENTS.find(document => document.id === documentId) ?? null;
    }

    const snapshot = await getDocumentsCollection(userId).doc(documentId).get();

    if (!snapshot.exists) {
        return null;
    }

    return mapDocumentRecord(snapshot.id, snapshot.data() as FirestoreDocumentRecord);
}

export async function listUserDocuments(userId: string): Promise<StoredDocument[]> {
    if (isE2ETestUser(userId)) {
        return E2E_FIXTURE_DOCUMENTS;
    }

    const snapshot = await getDocumentsCollection(userId)
        .orderBy('updatedAt', 'desc')
        .get();

    return snapshot.docs.map(doc => mapDocumentRecord(doc.id, doc.data() as FirestoreDocumentRecord));
}

export async function listUserDocumentVersions(
    userId: string,
    documentId: string
): Promise<StoredDocumentVersion[]> {
    if (isE2ETestUser(userId)) {
        return E2E_FIXTURE_VERSIONS[documentId] ?? [];
    }

    const snapshot = await getVersionsCollection(userId, documentId)
        .orderBy('createdAt', 'desc')
        .get();

    return snapshot.docs.map(doc => mapVersionRecord(doc.id, doc.data() as FirestoreVersionRecord));
}

export async function getUserDocumentVersion(
    userId: string,
    documentId: string,
    versionId: string
): Promise<StoredDocumentVersion | null> {
    if (isE2ETestUser(userId)) {
        return E2E_FIXTURE_VERSIONS[documentId]?.find(version => version.id === versionId) ?? null;
    }

    const snapshot = await getVersionsCollection(userId, documentId).doc(versionId).get();

    if (!snapshot.exists) {
        return null;
    }

    return mapVersionRecord(snapshot.id, snapshot.data() as FirestoreVersionRecord);
}
