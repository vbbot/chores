import {
  billsIcal,
  binsIcal,
  choresIcal,
  icalFeed,
  route,
} from '@chores/server';
import { ApiError } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { token: string; feed: string } }
) {
  return route(async () => {
    const feed = await icalFeed(params.token);
    if (!feed) throw new ApiError('Invalid calendar feed token', 404);

    let content: string;
    if (params.feed === 'chores.ics') {
      content = await choresIcal(feed.household_id);
    } else if (params.feed === 'bins.ics') {
      content = await binsIcal(feed.household_id);
    } else if (params.feed === 'bills.ics') {
      content = await billsIcal(feed.household_id);
    } else {
      throw new ApiError('Calendar feed not found', 404);
    }

    return new Response(content, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  });
}
