/**
 * Shared Gemini API error message helper.
 *
 * Maps raw SDK / HTTP error messages to user-friendly descriptions
 * without leaking internal details.
 */

export function getPublicErrorMessage(error: unknown, fallback = 'Failed to process your text. Please try again.'): string {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
        return 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local';
    }

    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
        return 'All model quotas exhausted. Please wait a few minutes and try again.';
    }

    if (message.includes('503') || message.includes('high demand') || message.includes('Service Unavailable')) {
        return 'All models are currently experiencing high demand. Please try again in a moment.';
    }

    return fallback;
}
