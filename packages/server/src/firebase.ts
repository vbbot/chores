import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let cachedApp: App | null = null;

function serviceAccountPath(): string {
  return (
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    join(homedir(), '.config', 'firebase-admin.json')
  );
}

export function firebaseApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const usingEmulator =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;

  if (usingEmulator) {
    cachedApp = initializeApp({ projectId: projectId || 'chores-test' });
    return cachedApp;
  }

  const account = JSON.parse(readFileSync(serviceAccountPath(), 'utf8')) as {
    project_id?: string;
  };
  cachedApp = initializeApp({
    credential: cert(account as Parameters<typeof cert>[0]),
    projectId: projectId || account.project_id,
  });
  return cachedApp;
}

export function authAdmin() {
  return getAuth(firebaseApp());
}

export function dbAdmin() {
  return getFirestore(firebaseApp());
}

export function messagingAdmin() {
  return getMessaging(firebaseApp());
}
