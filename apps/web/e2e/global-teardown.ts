function emulatorUrl(host: string): string {
  return host.startsWith('http') ? host : `http://${host}`;
}

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_CLEANUP === 'false') return;

  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const project = process.env.E2E_FIREBASE_PROJECT_ID;

  if (
    process.env.E2E_EMULATOR !== 'true' ||
    !firestoreHost ||
    !authHost ||
    !project
  ) {
    console.warn('E2E cleanup skipped: emulator environment is not configured.');
    return;
  }

  const firestoreClear = `${emulatorUrl(firestoreHost)}/emulator/v1/projects/${project}/databases/(default)/documents`;
  const authClear = `${emulatorUrl(authHost)}/emulator/v1/projects/${project}/accounts`;

  const [firestoreResponse, authResponse] = await Promise.all([
    fetch(firestoreClear, { method: 'DELETE' }),
    fetch(authClear, { method: 'DELETE' }),
  ]);

  if (!firestoreResponse.ok) {
    console.warn(`Firestore emulator cleanup returned ${firestoreResponse.status}.`);
  }
  if (!authResponse.ok) {
    console.warn(`Auth emulator cleanup returned ${authResponse.status}.`);
  }

  console.log('Cleared E2E emulator data');
}
