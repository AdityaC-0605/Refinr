/**
 * Input sanitization utilities
 */

export function sanitizeInput(text: string): string {
    // Strip HTML tags
    let clean = text.replace(/<[^>]*>/g, '');

    // Normalize whitespace
    clean = clean.replace(/\r\n/g, '\n');
    clean = clean.replace(/\r/g, '\n');
    clean = clean.replace(/\t/g, '  ');

    // Remove zero-width characters
    clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Trim
    clean = clean.trim();

    return clean;
}

export function countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    return text
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length;
}

export function countCharacters(text: string): number {
    return text.length;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateInput(text: string): ValidationResult {
    const clean = sanitizeInput(text);
    const words = countWords(clean);

    if (words < 10) {
        return {
            valid: false,
            error: `Please enter at least 10 words. Current: ${words} word${words !== 1 ? 's' : ''}.`,
        };
    }

    if (words > 5000) {
        return {
            valid: false,
            error: `Maximum 5,000 words per request. Current: ${words.toLocaleString()} words.`,
        };
    }

    return { valid: true };
}
