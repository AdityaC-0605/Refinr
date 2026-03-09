import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DocumentsWorkspace from './DocumentsWorkspace';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { listUserDocuments } from '@/lib/document-store';
import { getSessionUserFromCookies, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import styles from './page.module.css';

export const metadata = {
    title: 'My Documents — Refinr',
    description: 'Open your saved Refinr documents and continue editing them in the main workspace.',
};

export default async function DocumentsPage() {
    if (!isFirebaseAdminConfigured()) {
        redirect('/');
    }

    const cookieStore = await cookies();
    const sessionUser = await getSessionUserFromCookies(cookieStore);

    if (!sessionUser) {
        redirect('/');
    }

    const documents = await listUserDocuments(sessionUser.uid);

    return (
        <div className={styles.page}>
            <Header />
            <DocumentsWorkspace documents={documents} />
            <Footer />
        </div>
    );
}
