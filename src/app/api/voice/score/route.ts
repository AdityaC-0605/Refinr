import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUserFromCookies } from '@/lib/firebase-admin';
import { loadVoiceProfile } from '@/lib/voice-store';
import { computeVoiceMatchScore } from '@/lib/voice-scoring';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const user = await getSessionUserFromCookies(cookieStore);

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
        }

        const { text } = (body ?? {}) as { text?: unknown };

        if (typeof text !== 'string' || text.trim().length === 0) {
            return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
        }

        const profile = await loadVoiceProfile(user.uid);

        if (!profile) {
            return NextResponse.json({ error: 'No Voice DNA profile found.' }, { status: 404 });
        }

        const result = computeVoiceMatchScore(text, profile);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Voice scoring error:', error);
        return NextResponse.json({ error: 'Failed to compute voice match score.' }, { status: 500 });
    }
}
