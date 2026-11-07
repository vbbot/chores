import { parseIngredient } from 'parse-ingredient';

import type { RecipeIngredient } from '@chores/domain';

export function parseIngredientLine(raw: string): RecipeIngredient {
  const [parsed] = parseIngredient(raw, { includeMeta: false });
  if (!parsed) {
    return { raw, name: raw.trim(), quantity: null, unit: null };
  }
  return {
    raw,
    name: parsed.description.trim(),
    quantity: parsed.quantity,
    unit: parsed.unitOfMeasure,
  };
}

export function parseIngredients(raw: string[]): RecipeIngredient[] {
  return raw.map(parseIngredientLine).filter((item) => item.name.length > 0);
}
