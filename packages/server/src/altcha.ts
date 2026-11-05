import { CappedMap, create } from 'altcha-lib/frameworks/nextjs';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

import { ApiError } from './http';

const hmacSecret = process.env.ALTCHA_HMAC_KEY;

if (!hmacSecret) {
  console.warn('ALTCHA_HMAC_KEY is not set. Authentication challenges will fail.');
}

const store = new CappedMap<string, boolean>({ maxSize: 5000 });

export const altcha = create({
  createChallengeParameters: () => ({
    algorithm: 'PBKDF2/SHA-256',
    cost: Number(process.env.ALTCHA_COST || 5000),
    expiresAt: Math.floor(Date.now() / 1000) + 600,
  }),
  deriveKey,
  hmacSignatureSecret: hmacSecret || 'missing-altcha-secret',
  store,
});

export async function assertAltcha(payload: unknown): Promise<void> {
  if (typeof payload !== 'string' || !payload) {
    throw new ApiError('Complete the verification and try again.', 400);
  }

  let result;
  try {
    result = await altcha.verify(payload, deriveKey, hmacSecret || 'missing-altcha-secret', undefined, store);
  } catch {
    throw new ApiError('Verification failed. Please try again.', 400);
  }

  if (result.error || !result.verification?.verified) {
    throw new ApiError('Verification failed. Please try again.', 400);
  }
}
