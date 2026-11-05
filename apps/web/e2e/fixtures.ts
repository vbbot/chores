import { test as base, expect, type Page } from '@playwright/test';

const IGNORED_API_ERRORS = ['/api/v1/auth/me'];

type Fixtures = {
  watchErrors: void;
};

function isIgnoredApiResponse(status: number, url: string): boolean {
  if (status < 400) return true;
  if (status === 401 && IGNORED_API_ERRORS.some((path) => url.includes(path))) return true;
  return false;
}

export const test = base.extend<Fixtures>({
  watchErrors: [
    async ({ page }, use) => {
      const problems: string[] = [];

      page.on('console', (message) => {
        // Network status is checked on the response event, where the URL is
        // available. This avoids duplicate messages without losing signal.
        if (message.type() === 'error' && message.text().includes('Failed to load resource')) {
          return;
        }
        if (message.type() === 'error') {
          problems.push(`console error: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => {
        problems.push(`page error: ${error.message}`);
      });
      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/favicon.ico')) return;
        if (!isIgnoredApiResponse(response.status(), url)) {
          problems.push(
            `http ${response.status()}: ${response.request().method()} ${url}`
          );
        }
      });

      await use();

      expect(problems, `Browser reported problems:\n${problems.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export function emailFor(projectName: string): string {
  const stamp = Date.now().toString(36);
  const project = projectName.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `e2e-${stamp}-${project}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

export async function shot(page: Page, projectName: string, name: string): Promise<void> {
  await page.screenshot({
    path: `artifacts/screenshots/${projectName}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

const MOBILE_LABELS: Record<string, string> = {
  Dashboard: 'Home',
  Shopping: 'Shop',
};

/** Navigates with the desktop sidebar, the mobile tab bar, or the More sheet. */
export async function goTo(page: Page, label: string): Promise<void> {
  const desktopLink = page
    .locator('aside')
    .getByRole('link', { name: label, exact: true });

  if (await desktopLink.isVisible().catch(() => false)) {
    await desktopLink.click();
  } else {
    const mobileLabel = MOBILE_LABELS[label] || label;
    const tab = page
      .locator('nav[aria-label="Primary"]')
      .getByRole('link', { name: mobileLabel, exact: true });

    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
    } else {
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'More sections' })
        .getByRole('link', { name: label, exact: true })
        .click();
    }
  }

  await page.waitForLoadState('networkidle');
}
