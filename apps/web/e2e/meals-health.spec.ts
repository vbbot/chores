import { expect, emailFor, goTo, shot, test } from './fixtures';

interface RecipeResponse {
  id: string;
  title: string;
}

test('meals and private health: ideas, plan, shopping, recipe detail, diary', async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const email = emailFor(project);

  await page.goto('/login');
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await page.fill('#name', 'Meal Tester');
  await page.fill('#email', email);
  await page.fill('#password', 'TestPassword123');
  await page.fill('#hh_name', `Meal Home ${project}`);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/setup');
  await page.getByRole('button', { name: 'Next: Bin collection' }).click();
  await page.getByRole('button', { name: 'Next: Partner invite' }).click();
  await page.getByRole('button', { name: 'Complete setup' }).click();
  await page.waitForURL('**/dashboard');

  const recipeResponse = await page.request.post('/api/v1/recipes', {
    data: {
      title: 'Mushroom risotto',
      servings: 2,
      prep_minutes: 10,
      cook_minutes: 20,
      ingredients: ['200 g rice', '100 g mushrooms', '1 onion'],
      steps: ['Cook the rice.', 'Fry the mushrooms and onion.'],
      tags: ['Vegetarian'],
    },
  });
  expect(recipeResponse.ok()).toBeTruthy();
  const recipe = (await recipeResponse.json()) as RecipeResponse;

  await goTo(page, 'Meals');
  await expect(page.getByRole('heading', { name: 'Meals', level: 1 })).toBeVisible();

  // Ideas board.
  await expect(page.getByText('No meal ideas yet')).toBeVisible();
  await page.getByRole('button', { name: 'Suggest a meal' }).first().click();
  const ideaDialog = page.getByRole('dialog', { name: 'Suggest a meal' });
  await ideaDialog.getByLabel('Meal name').fill('Mushroom risotto');
  await ideaDialog.getByLabel('Note (optional)').fill('Use the arborio rice');
  await ideaDialog.getByRole('button', { name: 'Add idea' }).click();
  await expect(page.getByRole('heading', { name: 'Mushroom risotto' })).toBeVisible();
  await page.getByRole('button', { name: 'Vote for Mushroom risotto' }).click();
  await expect(page.getByRole('button', { name: 'Vote for Mushroom risotto' })).toContainText(
    '(1)'
  );
  await shot(page, project, '30-meal-ideas');

  // Plan a meal and send its ingredients to shopping.
  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(page.getByRole('heading', { name: 'Week plan' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add meal' }).first().click();
  const planDialog = page.getByRole('dialog', { name: 'Add planned meal' });
  await planDialog.getByLabel('Find a recipe (optional)').fill('risotto');
  await planDialog.getByRole('button', { name: 'Search', exact: true }).click();
  await planDialog.getByRole('button', { name: /Mushroom risotto/ }).click();
  await planDialog.getByRole('button', { name: 'Save meal' }).click();
  const shoppingButton = page
    .getByRole('button', { name: 'Add Mushroom risotto to shopping' })
    .filter({ visible: true })
    .first();
  await expect(shoppingButton).toBeVisible();
  await shoppingButton.click();
  const shoppingDialog = page.getByRole('dialog', { name: 'Add ingredients to shopping' });
  await shoppingDialog.getByRole('button', { name: 'Add ingredients' }).click();
  await expect(shoppingDialog.getByText(/added/)).toBeVisible();
  await shoppingDialog.getByRole('button', { name: 'Done' }).click();
  await shot(page, project, '31-meal-plan');

  await goTo(page, 'Shopping');
  await expect(page.getByText('rice', { exact: false }).first()).toBeVisible();

  // Put a meal on today's plan for the dashboard card.
  const today = new Date().toISOString().slice(0, 10);
  const planResponse = await page.request.put('/api/v1/meals/plan', {
    data: {
      date: today,
      slot: 'dinner',
      recipe_source: 'household',
      recipe_id: recipe.id,
      recipe_title: recipe.title,
      servings: 2,
      status: 'planned',
    },
  });
  expect(planResponse.ok()).toBeTruthy();

  await goTo(page, 'Dashboard');
  await expect(page.getByRole('heading', { name: "Tonight's meal" })).toBeVisible();
  await expect(page.getByText('Mushroom risotto').filter({ visible: true }).first()).toBeVisible();

  // Recipe search and detail.
  await goTo(page, 'Meals');
  await page.getByRole('tab', { name: 'Recipes' }).click();
  await page.getByLabel('Search recipes').fill('risotto');
  await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('link', { name: /Mushroom risotto/ }).click();
  await expect(page.getByRole('heading', { name: 'Mushroom risotto' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();
  await shot(page, project, '32-recipe-detail');

  // Private health diary.
  await goTo(page, 'Health');
  await expect(page.getByRole('heading', { name: 'Health diary', exact: true })).toBeVisible();
  await expect(page.getByText('Your private health diary')).toBeVisible();
  await page.getByRole('button', { name: 'Start my diary' }).click();
  const healthDialog = page.getByRole('dialog', { name: 'Add health entry' });
  await healthDialog.getByRole('button', { name: 'Headache' }).click();
  await healthDialog.getByRole('button', { name: '4', exact: true }).first().click();
  await healthDialog.getByLabel(/I understand that this diary is private/).check();
  await healthDialog.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('Headache')).toBeVisible();
  await expect(page.getByText(/Severity 4/)).toBeVisible();
  await shot(page, project, '33-health-diary');

  await page.reload();
  await expect(page.getByText('Headache')).toBeVisible();
});
