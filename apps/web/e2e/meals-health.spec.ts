import { expect, emailFor, goTo, shot, test } from './fixtures';

interface RecipeResponse {
  id: string;
  title: string;
}

test('meals and private health: week board, ideas, shopping, recipe detail, diary', async ({
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

  // Idea lifecycle: auto-vote, plan, remove, and return to the idea list.
  const future = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const ideaResponse = await page.request.post('/api/v1/meals/ideas', {
    data: {
      title: 'Lifecycle soup',
      recipe_source: 'free_text',
      suggested_for_date: future,
      suggested_for_slot: 'snack',
    },
  });
  expect(ideaResponse.ok()).toBeTruthy();
  const lifecycleIdea = (await ideaResponse.json()) as {
    id: string;
    votes: number;
    voted_by_me: boolean;
  };
  expect(lifecycleIdea.votes).toBe(1);
  expect(lifecycleIdea.voted_by_me).toBe(true);
  const lifecyclePlanResponse = await page.request.put('/api/v1/meals/plan', {
    data: {
      date: future,
      slot: 'snack',
      recipe_source: 'free_text',
      recipe_id: null,
      recipe_title: 'Lifecycle soup',
      servings: 2,
      idea_id: lifecycleIdea.id,
      status: 'planned',
    },
  });
  expect(lifecyclePlanResponse.ok()).toBeTruthy();
  const lifecyclePlan = (await lifecyclePlanResponse.json()) as { id: string };
  const afterPlan = await page.request.get('/api/v1/meals/ideas');
  const plannedIdea = ((await afterPlan.json()) as { id: string; status: string }[]).find(
    (idea) => idea.id === lifecycleIdea.id
  );
  expect(plannedIdea?.status).toBe('planned');
  const removePlan = await page.request.delete(`/api/v1/meals/plan/${lifecyclePlan.id}`);
  expect(removePlan.ok()).toBeTruthy();
  const afterRemove = await page.request.get('/api/v1/meals/ideas');
  const restoredIdea = ((await afterRemove.json()) as { id: string; status: string }[]).find(
    (idea) => idea.id === lifecycleIdea.id
  );
  expect(restoredIdea?.status).toBe('idea');

  await goTo(page, 'Meals');
  await expect(page.getByRole('heading', { name: 'Meals', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'This week' })).toHaveAttribute(
    'aria-selected',
    'true'
  );

  // Empty slot labels state the meal and day.
  const addBreakfast = page
    .getByRole('button', { name: /^Add breakfast for / })
    .filter({ visible: true })
    .first();
  await expect(addBreakfast).toBeVisible();
  await addBreakfast.click();

  const slotDialog = page.getByRole('dialog', { name: /Breakfast/ });
  await expect(slotDialog).toBeVisible();
  await slotDialog.getByLabel('Search recipes').fill('risotto');
  await slotDialog.getByRole('button', { name: 'Search', exact: true }).click();
  await slotDialog.getByRole('button', { name: /Mushroom risotto/ }).click();
  await slotDialog.getByRole('button', { name: 'Plan this meal' }).click();

  const planDialog = page.getByRole('dialog', { name: 'Plan this meal' });
  await expect(planDialog).toBeVisible();
  await planDialog.getByRole('button', { name: 'Plan meal' }).click();

  await expect(
    page.getByText('Mushroom risotto').filter({ visible: true }).first()
  ).toBeVisible();
  await shot(page, project, '30-meal-week');

  // Planned meals can send ingredients to shopping.
  const shoppingButton = page
    .getByRole('button', { name: 'Add Mushroom risotto to shopping' })
    .filter({ visible: true })
    .first();
  await shoppingButton.click();
  const shoppingDialog = page.getByRole('dialog', { name: 'Add ingredients to shopping' });
  await shoppingDialog.getByRole('button', { name: 'Add ingredients' }).click();
  await expect(shoppingDialog.getByText(/added/)).toBeVisible();
  await shoppingDialog.getByRole('button', { name: 'Done' }).click();

  await goTo(page, 'Shopping');
  await expect(page.getByText('rice', { exact: false }).first()).toBeVisible();

  // Suggest for a specific slot; the suggester is auto-voted.
  await goTo(page, 'Meals');
  const addLunch = page
    .getByRole('button', { name: /^Add lunch for / })
    .filter({ visible: true })
    .first();
  await addLunch.click();
  const lunchDialog = page.getByRole('dialog', { name: /Lunch/ });
  await lunchDialog.getByLabel('Meal name').fill('Pasta bake');
  await lunchDialog
    .getByRole('button', { name: /^Suggest for this lunch$/ })
    .click();
  const ideaRow = lunchDialog.locator('li').filter({ hasText: 'Pasta bake' });
  await expect(ideaRow).toBeVisible();
  await expect(ideaRow.getByRole('button', { name: 'Vote for Pasta bake' })).toContainText(
    'Voted (1)'
  );
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 idea').filter({ visible: true }).first()).toBeVisible();

  // Recipe search now has Plan, Suggest, and Ingredients actions.
  await page.getByRole('tab', { name: 'Recipes' }).click();
  await page.getByLabel('Search recipes').fill('risotto');
  await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();
  const recipeCard = page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: 'Mushroom risotto' }) })
    .first();
  await expect(recipeCard.getByRole('button', { name: 'Suggest Mushroom risotto' })).toBeVisible();
  await expect(
    recipeCard.getByRole('button', { name: 'Add ingredients for Mushroom risotto to shopping' })
  ).toBeVisible();

  // Direct recipe shopping works without planning first.
  await recipeCard
    .getByRole('button', { name: 'Add ingredients for Mushroom risotto to shopping' })
    .click();
  const directShopping = page.getByRole('dialog', { name: 'Add ingredients to shopping' });
  await directShopping.getByRole('button', { name: 'Add ingredients' }).click();
  await expect(directShopping.getByText(/added|merged/)).toBeVisible();
  await directShopping.getByRole('button', { name: 'Done' }).click();

  // Recipe detail is no longer a dead end.
  await page.getByRole('link', { name: 'Mushroom risotto' }).click();
  await expect(page.getByRole('button', { name: 'Plan Mushroom risotto' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suggest Mushroom risotto' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add ingredients for Mushroom risotto to shopping' })
  ).toBeVisible();
  await shot(page, project, '31-recipe-actions');

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
      serve_time: '19:00',
      status: 'planned',
    },
  });
  expect(planResponse.ok()).toBeTruthy();

  await goTo(page, 'Dashboard');
  await expect(page.getByRole('heading', { name: "Tonight's meal" })).toBeVisible();
  await expect(page.getByText('Mushroom risotto').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/Served at 19:00/).filter({ visible: true }).first()).toBeVisible();

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
  await shot(page, project, '32-health-diary');

  await page.reload();
  await expect(page.getByText('Headache')).toBeVisible();
});
