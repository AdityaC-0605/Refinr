import { defineConfig, devices } from '@playwright/test';

const port = 3000;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
    use: {
        baseURL: `http://127.0.0.1:${port}`,
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'NEXT_PUBLIC_E2E_TEST_MODE=1 E2E_TEST_MODE=1 npx next dev --hostname 127.0.0.1 --port 3000',
        port,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});
