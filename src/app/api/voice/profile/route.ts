import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUserFromCookies } from '@/lib/firebase-admin';
import { loadVoiceProfile, deleteVoiceProfile } from '@/lib/voice-store';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const user = await getSessionUserFromCookies(cookieStore);

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        const profile = await loadVoiceProfile(user.uid);

        return NextResponse.json({ profile: profile ?? null });
    } catch {
        return NextResponse.json({ profile: null });
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const user = await getSessionUserFromCookies(cookieStore);

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        await deleteVoiceProfile(user.uid);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete profile.' }, { status: 500 });
    }
}
