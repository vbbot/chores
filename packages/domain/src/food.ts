export type RecipeSource = 'catalogue' | 'household';
export type MealRecipeSource = RecipeSource | 'free_text';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealPlanStatus = 'planned' | 'cooked' | 'skipped';
export type MealIdeaStatus = 'idea' | 'shortlisted' | 'planned' | 'dismissed';
export type NutritionConfidence = 'matched' | 'partial' | 'estimated' | 'unavailable';

export const MEAL_SLOTS: readonly MealSlot[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export interface RecipeIngredient {
  raw: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeNutrition {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g: number | null;
  salt_g: number | null;
  source: string | null;
  confidence: NutritionConfidence;
  matched_ingredients: number;
  total_ingredients: number;
}

export interface Recipe {
  id: string;
  source: RecipeSource;
  title: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  license: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
  nutrition: RecipeNutrition | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface MealIdea {
  id: string;
  household_id: string;
  title: string;
  recipe_source: MealRecipeSource;
  recipe_id: string | null;
  note: string | null;
  suggested_by: string;
  suggested_by_name: string;
  status: MealIdeaStatus;
  votes: number;
  voted_by_me: boolean;
  created_at: string;
}

export interface MealPlanEntry {
  id: string;
  date: string;
  slot: MealSlot;
  recipe_source: MealRecipeSource;
  recipe_id: string | null;
  recipe_title: string;
  servings: number;
  cook_id: string | null;
  cook_name: string | null;
  status: MealPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface MealShoppingResult {
  added: number;
  merged: number;
  skipped: number;
  items: { name: string; quantity: number | null; unit: string | null }[];
}
