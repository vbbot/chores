import type { RecipeNutrition } from '@chores/domain';

import { parseIngredientLine } from './parse';

interface Food {
  name: string;
  gramsPerUnit?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number;
  salt: number;
}

/** Per 100g values for common UK ingredients. */
const COMMON_FOODS: Food[] = [
  { name: 'chicken breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0, sugar: 0, salt: 0.2 },
  { name: 'chicken thigh', calories: 209, protein: 26, carbs: 0, fat: 10.9, fibre: 0, sugar: 0, salt: 0.2 },
  { name: 'beef mince', calories: 250, protein: 26, carbs: 0, fat: 15, fibre: 0, sugar: 0, salt: 0.2 },
  { name: 'pork', calories: 242, protein: 27, carbs: 0, fat: 14, fibre: 0, sugar: 0, salt: 0.2 },
  { name: 'salmon', calories: 208, protein: 20, carbs: 0, fat: 13, fibre: 0, sugar: 0, salt: 0.2 },
  { name: 'egg', gramsPerUnit: 50, calories: 155, protein: 13, carbs: 1.1, fat: 11, fibre: 0, sugar: 1.1, salt: 0.3 },
  { name: 'rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fibre: 0.4, sugar: 0.1, salt: 0 },
  { name: 'pasta', calories: 131, protein: 5, carbs: 25, fat: 1.1, fibre: 1.8, sugar: 0.6, salt: 0 },
  { name: 'potato', gramsPerUnit: 170, calories: 77, protein: 2, carbs: 17, fat: 0.1, fibre: 2.2, sugar: 0.8, salt: 0 },
  { name: 'onion', gramsPerUnit: 150, calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fibre: 1.7, sugar: 4.2, salt: 0 },
  { name: 'garlic', gramsPerUnit: 3, calories: 149, protein: 6.4, carbs: 33, fat: 0.5, fibre: 2.1, sugar: 1, salt: 0 },
  { name: 'tomato', gramsPerUnit: 120, calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fibre: 1.2, sugar: 2.6, salt: 0 },
  { name: 'carrot', gramsPerUnit: 80, calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fibre: 2.8, sugar: 4.7, salt: 0.1 },
  { name: 'milk', calories: 42, protein: 3.4, carbs: 5, fat: 1, fibre: 0, sugar: 5, salt: 0.1 },
  { name: 'butter', calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fibre: 0, sugar: 0.1, salt: 0.6 },
  { name: 'cheese', calories: 402, protein: 25, carbs: 1.3, fat: 33, fibre: 0, sugar: 0.5, salt: 1.8 },
  { name: 'bread', gramsPerUnit: 35, calories: 265, protein: 9, carbs: 49, fat: 3.2, fibre: 2.7, sugar: 5, salt: 1.2 },
  { name: 'flour', calories: 364, protein: 10, carbs: 76, fat: 1, fibre: 2.7, sugar: 0.3, salt: 0 },
  { name: 'sugar', calories: 400, protein: 0, carbs: 100, fat: 0, fibre: 0, sugar: 100, salt: 0 },
  { name: 'olive oil', calories: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, sugar: 0, salt: 0 },
  { name: 'vegetable oil', calories: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, sugar: 0, salt: 0 },
  { name: 'lentil', calories: 116, protein: 9, carbs: 20, fat: 0.4, fibre: 7.9, sugar: 1.8, salt: 0 },
  { name: 'chickpea', calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fibre: 7.6, sugar: 4.8, salt: 0.2 },
  { name: 'spinach', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fibre: 2.2, sugar: 0.4, salt: 0.2 },
  { name: 'broccoli', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fibre: 2.6, sugar: 1.7, salt: 0.1 },
  { name: 'banana', gramsPerUnit: 120, calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fibre: 2.6, sugar: 12, salt: 0 },
  { name: 'apple', gramsPerUnit: 180, calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fibre: 2.4, sugar: 10, salt: 0 },
  { name: 'yoghurt', calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fibre: 0, sugar: 3.6, salt: 0.1 },
];

const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  litre: 1000,
  litres: 1000,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  pound: 453.6,
  pounds: 453.6,
};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findFood(name: string): Food | null {
  const value = normalise(name);
  return (
    COMMON_FOODS.filter((food) => value.includes(food.name) || food.name.includes(value))
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
}

function gramsFor(
  food: Food,
  quantity: number | null,
  unit: string | null
): number | null {
  const amount = quantity ?? 1;
  if (unit) {
    const grams = UNIT_GRAMS[normalise(unit)];
    if (grams) return amount * grams;
  }
  if (food.gramsPerUnit) return amount * food.gramsPerUnit;
  return null;
}

export function estimateNutrition(
  rawIngredients: string[],
  servings: number
): RecipeNutrition {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    sugar: 0,
    salt: 0,
  };
  let matched = 0;

  for (const raw of rawIngredients) {
    const parsed = parseIngredientLine(raw);
    const food = findFood(parsed.name);
    if (!food) continue;
    const grams = gramsFor(food, parsed.quantity, parsed.unit);
    if (!grams) continue;
    const factor = grams / 100;
    totals.calories += food.calories * factor;
    totals.protein += food.protein * factor;
    totals.carbs += food.carbs * factor;
    totals.fat += food.fat * factor;
    totals.fibre += food.fibre * factor;
    totals.sugar += food.sugar * factor;
    totals.salt += food.salt * factor;
    matched += 1;
  }

  const total = rawIngredients.length;
  const confidence =
    total === 0 || matched === 0
      ? 'unavailable'
      : matched / total >= 0.8
        ? 'matched'
        : 'partial';

  const round = (value: number) => Math.round(value * 10) / 10;
  const divisor = Math.max(1, servings);

  return {
    calories: matched > 0 ? Math.round(totals.calories / divisor) : null,
    protein_g: matched > 0 ? round(totals.protein / divisor) : null,
    carbs_g: matched > 0 ? round(totals.carbs / divisor) : null,
    fat_g: matched > 0 ? round(totals.fat / divisor) : null,
    fibre_g: matched > 0 ? round(totals.fibre / divisor) : null,
    sugar_g: matched > 0 ? round(totals.sugar / divisor) : null,
    salt_g: matched > 0 ? round(totals.salt / divisor) : null,
    source: matched > 0 ? 'Common ingredient table' : null,
    confidence,
    matched_ingredients: matched,
    total_ingredients: total,
  };
}
