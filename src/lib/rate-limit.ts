/**
 * Shared in-memory rate limiter for API routes.
 *
 * Creates a per-route rate limit map. Expired entries are lazily
 * purged every CLEANUP_INTERVAL_MS to prevent unbounded map growth.
 */

import { RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS } from './config.ts';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function createRateLimiter() {
    const map = new Map<string, RateLimitEntry>();
    let lastCleanup = Date.now();

    function purgeExpired() {
        const now = Date.now();

        if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
            return;
        }

        for (const [key, entry] of map) {
            if (now > entry.resetAt) {
                map.delete(key);
            }
        }

        lastCleanup = now;
    }

    return function checkRateLimit(ip: string): boolean {
        purgeExpired();

        const now = Date.now();
        const entry = map.get(ip);

        if (!entry || now > entry.resetAt) {
            map.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
            return true;
        }

        if (entry.count >= RATE_LIMIT_REQUESTS) {
            return false;
        }

        entry.count += 1;
        return true;
    };
}
