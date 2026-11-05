import type { z } from 'zod';
import { ApiError, firstZodError, readJson } from '@chores/server';

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new ApiError(firstZodError(parsed.error), 400);
  }
  return parsed.data;
}
