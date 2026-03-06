import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, buildUserPrompt, HumanizeSettings } from '@/lib/prompt';
import { sanitizeInput, validateInput } from '@/lib/sanitize';

// Simple in-memory rate limiter for MVP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for') || 'anonymous';
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        // Parse body
        const body = await request.json();
        const { text, settings } = body as { text: string; settings: HumanizeSettings };

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required.' },
                { status: 400 }
            );
        }

        // Sanitize and validate
        const cleanText = sanitizeInput(text);
        const validation = validateInput(cleanText);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Check API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return NextResponse.json(
                { error: 'Gemini API key is not configured. Please add your GEMINI_API_KEY to .env.local' },
                { status: 500 }
            );
        }

        // Build prompt
        const systemPrompt = buildSystemPrompt(settings);
        const userPrompt = buildUserPrompt(cleanText);

        // Call Gemini API
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: systemPrompt,
        });

        const result = await model.generateContent(userPrompt);
        const response = result.response;
        const responseText = response.text();

        // Parse the JSON response from Gemini
        let parsed: { edited_text: string; change_summary: string[] };

        try {
            // Try to extract JSON from the response (Gemini sometimes wraps in markdown)
            let jsonStr = responseText;

            // Remove markdown code fences if present
            const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }

            parsed = JSON.parse(jsonStr.trim());

            if (!parsed.edited_text) {
                throw new Error('Missing edited_text in response');
            }
            if (!Array.isArray(parsed.change_summary)) {
                parsed.change_summary = [parsed.change_summary || 'Text was edited for improved readability'];
            }
        } catch {
            // If JSON parsing fails, use the raw response as the edited text
            parsed = {
                edited_text: responseText,
                change_summary: ['Text was edited for improved readability and natural flow'],
            };
        }

        return NextResponse.json({
            edited_text: parsed.edited_text,
            change_summary: parsed.change_summary,
        });
    } catch (error) {
        console.error('Refinr API error:', error);

        const message = error instanceof Error ? error.message : 'An unexpected error occurred';

        // Check for common Gemini API errors
        if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
            return NextResponse.json(
                { error: 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local' },
                { status: 401 }
            );
        }

        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
            return NextResponse.json(
                { error: 'API quota exceeded. Please try again later or check your Gemini API quota.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process your text. Please try again.' },
            { status: 500 }
        );
    }
}
