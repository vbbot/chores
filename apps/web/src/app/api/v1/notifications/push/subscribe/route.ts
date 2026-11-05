import { createHash } from 'node:crypto';

import {
  addDeviceToken,
  ApiError,
  pushSubscriptionSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user } = await requireUserHousehold(request);
    const data = await parseBody(request, pushSubscriptionSchema);

    const token = data.token ?? data.endpoint;
    if (!token) throw new ApiError('A push token is required', 400);

    const deviceId = createHash('sha256').update(token).digest('hex').slice(0, 32);
    await addDeviceToken(user.id, deviceId, {
      token,
      platform: data.platform,
      ...(data.endpoint ? { endpoint: data.endpoint } : {}),
    });
    return Response.json({ message: 'Push notifications subscribed' });
  });
}
