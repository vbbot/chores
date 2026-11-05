const BASE_URL = process.env.BASE_URL || 'http://localhost';
const ALTCHA_URL = process.env.ALTCHA_URL || `${BASE_URL}/api/altcha/challenge`;
const TIMEOUT_MS = 120_000;

async function waitFor(url: string, label: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = 'no response';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `${label} did not become ready at ${url} within ${TIMEOUT_MS / 1000}s (${lastError}). ` +
      'Start the stack first: docker compose up -d --build'
  );
}

export default async function globalSetup(): Promise<void> {
  await Promise.all([
    waitFor(BASE_URL, 'Frontend'),
    waitFor(ALTCHA_URL, 'ALTCHA challenge'),
  ]);
}
