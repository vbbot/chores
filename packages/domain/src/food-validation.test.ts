import { describe, expect, it } from 'vitest';

import {
  healthEntryUpdateSchema,
  householdRecipeUpdateSchema,
  recipeImportSchema,
} from './validation';

describe('food validation', () => {
  it('rejects non-http recipe links', () => {
    expect(recipeImportSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
    expect(recipeImportSchema.safeParse({ url: 'data:text/html,hi' }).success).toBe(false);
    expect(recipeImportSchema.safeParse({ url: 'https://example.com/recipe' }).success).toBe(true);
  });

  it('does not inject create defaults into a recipe update', () => {
    const parsed = householdRecipeUpdateSchema.parse({ title: 'New title' });
    expect(parsed).toEqual({ title: 'New title' });
  });

  it('does not inject create defaults into a health update', () => {
    const parsed = healthEntryUpdateSchema.parse({ severity: 4 });
    expect(parsed).toEqual({ severity: 4 });
  });
});
