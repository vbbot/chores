const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ALTCHA_URL = process.env.ALTCHA_URL || `${BASE_URL}/api/altcha/challenge`;
const TIMEOUT_MS = 120_000;

function emulatorUrl(host: string): string {
  return host.startsWith('http') ? host : `http://${host}`;
}

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
    `${label} did not become ready at ${url} within ${TIMEOUT_MS / 1000}s (${lastError}).`
  );
}

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_EMULATOR !== 'true') {
    throw new Error(
      'Playwright E2E must run through `npm run e2e`. Direct runs against live Firebase are blocked.'
    );
  }

  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const project = process.env.E2E_FIREBASE_PROJECT_ID;

  if (!firestoreHost || !authHost || !project) {
    throw new Error(
      'Firebase emulator environment is missing. Run `npm run e2e` from the repository root.'
    );
  }

  if (project === 'chores-f341d') {
    throw new Error('Refusing to run E2E against the production Firebase project.');
  }

  const base = new URL(BASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(base.hostname)) {
    throw new Error(`Refusing to run E2E against a non-local URL: ${BASE_URL}`);
  }

  await Promise.all([
    waitFor(emulatorUrl(firestoreHost), 'Firestore emulator'),
    waitFor(emulatorUrl(authHost), 'Auth emulator'),
    waitFor(BASE_URL, 'Frontend'),
    waitFor(ALTCHA_URL, 'ALTCHA challenge'),
  ]);
}
