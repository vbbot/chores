import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_CLEANUP === 'false') return;

  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    join(homedir(), '.config', 'firebase-admin.json');
  const defaultPath = join(homedir(), '.config', 'firebase-admin.json');

  let account: { project_id?: string };
  let path = configuredPath;
  try {
    account = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    try {
      path = defaultPath;
      account = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      console.warn(`E2E cleanup skipped: no service account at ${configuredPath}`);
      return;
    }
  }

  const app =
    getApps()[0] ??
    initializeApp({ credential: cert(account as never), projectId: account.project_id });
  const db = getFirestore(app);
  const auth = getAuth(app);

  const users = await auth.listUsers(1000);
  const testUsers = users.users.filter((user) => user.email?.startsWith('e2e-'));
  const householdIds = new Set<string>();
  const icalTokens: string[] = [];

  for (const user of testUsers) {
    const profile = await db.collection('users').doc(user.uid).get();
    const data = profile.data();
    if (data?.household_id) householdIds.add(String(data.household_id));
    if (data?.ical_token) icalTokens.push(String(data.ical_token));
    await db.collection('users').doc(user.uid).delete();
    await auth.deleteUser(user.uid).catch(() => undefined);
  }

  for (const token of icalTokens) {
    await db.collection('icalFeeds').doc(token).delete().catch(() => undefined);
  }

  for (const householdId of Array.from(householdIds)) {
    await db.recursiveDelete(db.collection('households').doc(householdId));
    const inviteCodes = await db
      .collection('inviteCodes')
      .where('household_id', '==', householdId)
      .get();
    await Promise.all(inviteCodes.docs.map((doc) => doc.ref.delete()));
  }

  if (testUsers.length || householdIds.size) {
    console.log(
      `Cleaned ${testUsers.length} E2E users and ${householdIds.size} E2E households`
    );
  }
}
