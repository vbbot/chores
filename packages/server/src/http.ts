export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ detail: message }, { status });
}

export async function route(
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    console.error('Unhandled API error', error);
    return jsonError('Something went wrong. Please try again.', 500);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('Invalid JSON body', 400);
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return;

  try {
    if (new URL(origin).hostname !== host.split(':')[0]) {
      throw new ApiError('Cross-origin request rejected', 403);
    }
  } catch {
    throw new ApiError('Invalid origin', 403);
  }
}
