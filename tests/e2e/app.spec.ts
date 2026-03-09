import { expect, test, type Page } from '@playwright/test';

const E2E_SESSION_COOKIE = {
    name: 'refinr_session',
    value: 'e2e-test-session',
    url: 'http://127.0.0.1:3000',
};
const E2E_AUTH_STORAGE_KEY = 'refinr-e2e-authenticated';

function buildMockRefineStream(options?: {
    chunkText?: string;
    editedText?: string;
    changeSummary?: string[];
}): string {
    const editedText = options?.editedText ?? 'This rewrite sounds more natural and easier to read.';
    const chunkText = options?.chunkText ?? `${editedText} `;
    const changeSummary = options?.changeSummary ?? ['Improved sentence flow', 'Reduced stiffness'];

    return [
        'event: chunk',
        `data: ${JSON.stringify({ text: chunkText })}`,
        '',
        'event: complete',
        `data: ${JSON.stringify({ edited_text: editedText, change_summary: changeSummary })}`,
        '',
        '',
    ].join('\n');
}

async function dismissEthicsModal(page: Page) {
    const dialog = page.getByRole('dialog', { name: /ethics/i });

    if (await dialog.isVisible().catch(() => false)) {
        await dialog.getByRole('button').first().click();
        await expect(dialog).toBeHidden();
    }
}

async function refineFromPrimaryEditor(page: Page, input: string) {
    await page.getByRole('textbox').first().fill(input);
    const refineButton = page.locator('#humanize-btn:visible').first();
    await expect(refineButton).toBeEnabled();
    await refineButton.click();
}

async function enableAuthenticatedE2EUser(page: Page) {
    await page.context().addCookies([E2E_SESSION_COOKIE]);
    await page.addInitScript(storageKey => {
        window.localStorage.setItem(storageKey, 'true');
    }, E2E_AUTH_STORAGE_KEY);
}

test.describe('Refinr app', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('refinr-ethics-acknowledged', 'true');
        });
    });

    test('renders the homepage shell', async ({ page }) => {
        await page.goto('/');
        await dismissEthicsModal(page);

        await expect(
            page.getByRole('heading', { name: /turn flat ai copy into/i })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: /draft on the left, refined prose on the right/i })
        ).toBeVisible();
        await expect(page.getByRole('textbox').first()).toBeVisible();
    });

    test('runs a mocked refine flow and shows diff output', async ({ page }) => {
        await page.route('**/api/refine', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream; charset=utf-8',
                body: buildMockRefineStream(),
            });
        });

        await page.goto('/');
        await dismissEthicsModal(page);
        await refineFromPrimaryEditor(page, 'This is stiff AI sounding copy that needs a more natural and readable rewrite.');

        await expect(page.getByText('This rewrite sounds more natural and easier to read.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Diff' })).toBeVisible();

        await page.getByRole('button', { name: 'Diff' }).click();

        await expect(page.getByText('Added')).toBeVisible();
        await expect(page.getByText('Removed')).toBeVisible();
        await expect(page.getByText(/improved sentence flow/i)).toBeVisible();
    });

    test('opens the auth modal when a signed-out user tries to save a result', async ({ page }) => {
        await page.route('**/api/refine', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream; charset=utf-8',
                body: buildMockRefineStream(),
            });
        });

        await page.goto('/');
        await dismissEthicsModal(page);
        await refineFromPrimaryEditor(page, 'This draft should trigger the save flow and open auth for an unauthenticated user.');

        await page.getByRole('button', { name: /save document/i }).click();

        const authDialog = page.getByRole('dialog');
        await expect(authDialog).toBeVisible();
        await expect(page.getByRole('heading', { name: /log in to save your drafts/i })).toBeVisible();
        await expect(page.getByLabel('Email')).toBeVisible();
        await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    });

    test('supports paragraph mode with sequential paragraph output updates', async ({ page }) => {
        await page.route('**/api/refine', async route => {
            const payload = route.request().postDataJSON() as { text?: string };
            const sourceText = payload.text ?? '';

            const editedText = sourceText.includes('First paragraph')
                ? 'First paragraph refined with better rhythm and clarity.'
                : 'Second paragraph refined with a cleaner, calmer finish.';

            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream; charset=utf-8',
                body: buildMockRefineStream({
                    editedText,
                    chunkText: `${editedText} `,
                    changeSummary: ['Refined paragraph flow'],
                }),
            });
        });

        await page.goto('/');
        await dismissEthicsModal(page);
        await page.getByRole('textbox').first().fill(
            'First paragraph is robotic and overexplained.\n\nSecond paragraph is stiff and repetitive.'
        );

        await page.locator('button[aria-pressed]').first().click();

        await expect(page.getByText('Paragraph 1')).toBeVisible();
        await expect(page.getByText('Paragraph 2')).toBeVisible();

        await page.getByRole('button', { name: 'Refine All' }).click();

        await expect(page.getByText('First paragraph refined with better rhythm and clarity.')).toBeVisible();
        await expect(page.getByText('Second paragraph refined with a cleaner, calmer finish.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Diff' })).toBeVisible();
    });

    test('shows saved documents and version history for an authenticated session', async ({ page }) => {
        await enableAuthenticatedE2EUser(page);

        await page.goto('/documents');

        await expect(page.getByRole('heading', { name: /my documents/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /quarterly update draft/i })).toBeVisible();

        await page.getByRole('button', { name: 'History' }).first().click();

        const historyPanel = page.getByLabel(/document version history/i);

        await expect(historyPanel).toBeVisible();
        await expect(historyPanel.getByText(/versions are sorted newest first/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /preview this version/i }).first()).toBeVisible({ timeout: 10000 });
        await expect(historyPanel.getByText(/this quarterly update now reads with a clearer executive tone/i)).toBeVisible();
    });

    test('opens a saved version as read-only preview and allows returning to edit mode', async ({ page }) => {
        await enableAuthenticatedE2EUser(page);

        await page.goto('/documents');
        await page.getByRole('button', { name: 'History' }).first().click();
        await page.getByRole('link', { name: /preview this version/i }).first().click({ timeout: 10000 });

        await expect(page).toHaveURL(/document=e2e-doc-1&version=e2e-ver-2/);
        await expect(page.getByText(/previewing a saved version from/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /edit this version/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /save document/i })).toHaveCount(0);

        await page.getByRole('button', { name: /edit this version/i }).click();

        await expect(page).toHaveURL(/\/\?document=e2e-doc-1$/);
        await expect(page.getByText(/previewing a saved version from/i)).toHaveCount(0);
        await expect(page.getByRole('button', { name: /save document/i })).toBeVisible();
    });

    test('loads explanations for diff changes after refinement completes', async ({ page }) => {
        await page.route('**/api/refine', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream; charset=utf-8',
                body: buildMockRefineStream({
                    editedText: 'This sentence reads more naturally and avoids repetition.',
                    chunkText: 'This sentence reads more naturally and avoids repetition. ',
                    changeSummary: ['Improved readability'],
                }),
            });
        });

        await page.route('**/api/refine/explanations', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    explanations: [
                        {
                            original: 'This sentence is robotic and repetitive.',
                            revised: 'This sentence reads more naturally and avoids repetition.',
                            reason: 'Rephrased the sentence to improve readability and remove repetition.',
                        },
                    ],
                }),
            });
        });

        await page.goto('/');
        await dismissEthicsModal(page);
        await refineFromPrimaryEditor(page, 'This sentence is robotic and repetitive, and it makes the whole paragraph feel mechanical and flat.');

        await page.getByRole('button', { name: 'Diff' }).click();
        await page.getByRole('button', { name: /show explanations/i }).click();

        const explanationButton = page.getByRole('button', { name: /show explanation/i }).first();
        await expect(explanationButton).toBeVisible();
        await explanationButton.hover();

        await expect(page.getByRole('tooltip')).toContainText(
            'Rephrased the sentence to improve readability and remove repetition.'
        );
    });

    test('shows grammar issues and applies a suggested fix', async ({ page }) => {
        await page.route('**/api/refine', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream; charset=utf-8',
                body: buildMockRefineStream({
                    editedText: 'Ths sentence is polished but still has a typo.',
                    chunkText: 'Ths sentence is polished but still has a typo. ',
                    changeSummary: ['Improved readability'],
                }),
            });
        });

        await page.route('**/api/grammar', async route => {
            const payload = route.request().postDataJSON() as { text?: string };
            const currentText = payload.text ?? '';

            if (currentText.includes('Ths sentence')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({
                        matches: [
                            {
                                id: '0:3:Possible spelling mistake found.',
                                message: 'Possible spelling mistake found.',
                                shortDescription: 'Spelling',
                                offset: 0,
                                length: 3,
                                replacements: ['This'],
                                issueType: 'spelling',
                            },
                        ],
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({ matches: [] }),
            });
        });

        await page.route('**/api/tone-check', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({ inconsistencies: [], unavailable: false }),
            });
        });

        await page.goto('/');
        await dismissEthicsModal(page);
        await refineFromPrimaryEditor(page, 'This is stiff copy that should surface the grammar panel after refinement completes.');

        await expect(page.getByRole('button', { name: /grammar check/i })).toBeVisible();
        await expect(page.getByText(/1 issue found/i)).toBeVisible();
        await page.getByRole('button', { name: 'Apply Fix' }).click();

        await expect(page.getByText('This sentence is polished but still has a typo.')).toBeVisible();
        await expect(page.getByText(/no issues/i)).toBeVisible();
    });

    test('flags tone inconsistencies and re-refines a flagged sentence', async ({ page }) => {
        await page.route('**/api/refine', async route => {
            const payload = route.request().postDataJSON() as { text?: string };
            const sourceText = payload.text ?? '';

            const editedText = sourceText === 'Hey there! This launch is totally awesome.'
                ? 'This launch is exceptionally strong.'
                : 'The product update is ready. Hey there! This launch is totally awesome.';

            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream; charset=utf-8',
                body: buildMockRefineStream({
                    editedText,
                    chunkText: `${editedText} `,
                    changeSummary: ['Adjusted tone'],
                }),
            });
        });

        await page.route('**/api/grammar', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({ matches: [] }),
            });
        });

        await page.route('**/api/tone-check', async route => {
            const payload = route.request().postDataJSON() as { text?: string };
            const currentText = payload.text ?? '';

            if (currentText.includes('Hey there! This launch is totally awesome.')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({
                        inconsistencies: [
                            {
                                sentence: 'Hey there! This launch is totally awesome.',
                                reason: 'The sentence is too casual for the selected professional tone.',
                                severity: 'strong',
                            },
                        ],
                        unavailable: false,
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({ inconsistencies: [], unavailable: false }),
            });
        });

        await page.goto('/');
        await dismissEthicsModal(page);
        await refineFromPrimaryEditor(page, 'This stiff draft should show the tone consistency checker after refinement.');

        await expect(page.getByRole('button', { name: /tone consistency/i })).toBeVisible();
        await expect(page.getByText(/1 inconsistency/i)).toBeVisible();
        await page.getByRole('button', { name: /re-refine this sentence/i }).click();

        await expect(page.getByText('This launch is exceptionally strong.')).toBeVisible();
        await expect(page.getByText(/tone looks consistent/i)).toBeVisible();
    });

    test('navigates to the about page', async ({ page }) => {
        await page.goto('/');
        await dismissEthicsModal(page);
        await page.getByRole('link', { name: /why it stays ethical/i }).click();

        await expect(page).toHaveURL(/\/about$/);
        await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('protects the documents route for signed-out users', async ({ page }) => {
        await page.goto('/documents');

        await expect(page).toHaveURL(/\/$/);
        await expect(
            page.getByRole('heading', { name: /turn flat ai copy into/i })
        ).toBeVisible();
    });
});
