import { expect, emailFor, goTo, shot, test } from './fixtures';

test('household journey: signup, setup, chores, bins, shopping, bills, calendar, notes, settings', async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const email = emailFor(project);

  // 01. Sign in screen.
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to Chores' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled({ timeout: 30_000 });
  await shot(page, project, '01-login');

  // 02. Registration.
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.fill('#name', 'E2E Housemate');
  await page.fill('#email', email);
  await page.fill('#password', 'TestPassword123');
  await page.fill('#hh_name', `E2E Home ${project}`);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled({
    timeout: 30_000,
  });
  await shot(page, project, '02-register');
  await page.getByRole('button', { name: 'Create account' }).click();

  // 03-05. Setup wizard. Bin day is tomorrow so the dashboard widget is testable.
  await page.waitForURL('**/setup');
  await expect(page.getByRole('heading', { name: 'Configure your home layout' })).toBeVisible();
  await shot(page, project, '03-setup-rooms');
  await page.getByRole('button', { name: 'Next: Bin collection' }).click();

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).getUTCDay();
  const binDay = (tomorrow + 6) % 7; // select uses 0 = Monday
  await page.selectOption('#bin_day', String(binDay));
  await expect(page.getByRole('heading', { name: 'Set up bin collections' })).toBeVisible();
  await shot(page, project, '04-setup-bins');
  await page.getByRole('button', { name: 'Next: Partner invite' }).click();

  await expect(
    page.getByRole('heading', { name: 'Invite your household partner' })
  ).toBeVisible();
  await shot(page, project, '05-setup-invite');
  await page.getByRole('button', { name: 'Complete setup' }).click();

  // 06. Dashboard with tonight's bins widget.
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Today at home' })).toBeVisible();
  await expect(page.getByText('Put the bins out tonight')).toBeVisible();
  await shot(page, project, '06-dashboard');

  await page.getByRole('button', { name: 'Mark bins out' }).click();
  await expect(page.getByRole('status')).toContainText('Bins out');

  // 07-09. Chores: empty state, create dialog, populated list.
  await goTo(page, 'Chores');
  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested for your home' })).toBeVisible();
  await shot(page, project, '07-chores-empty');
  await page.getByRole('button', { name: 'Not now' }).first().click();
  await expect(page.getByRole('button', { name: 'Not now' })).toHaveCount(2);

  await page.getByRole('button', { name: 'Add chore' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add chore template' })).toBeVisible();
  await expect(page.locator('#chore_name')).toBeFocused();
  await page.fill('#chore_name', 'Mop kitchen floor');
  await page.selectOption('#chore_freq', 'weekly');
  await shot(page, project, '08-chores-dialog');
  await page.getByRole('button', { name: 'Save chore' }).click();
  const choreInstance = page
    .locator('div.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'Mop kitchen floor', exact: true }) })
    .filter({ has: page.getByLabel('Assigned to') })
    .first();
  await expect(choreInstance).toBeVisible();
  await choreInstance.getByLabel('Assigned to').selectOption({ label: 'E2E Housemate' });
  await expect(choreInstance.getByLabel('Assigned to')).not.toHaveValue('');
  await expect(choreInstance.getByRole('button', { name: 'Mark done' })).toBeEnabled();
  await shot(page, project, '09-chores-populated');
  await choreInstance.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('status')).toContainText('XP');
  await expect(page.getByLabel('Assigned to')).toHaveCount(2);

  const todayLondon = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const templatesResponse = await page.request.get('/api/v1/chores/templates');
  expect(templatesResponse.status()).toBe(200);
  const templates = (await templatesResponse.json()) as { name: string; next_due_date?: string }[];
  const mop = templates.find((template) => template.name === 'Mop kitchen floor');
  expect(mop?.next_due_date && mop.next_due_date > todayLondon).toBeTruthy();

  // 10. Bins.
  await goTo(page, 'Bins');
  await expect(page.getByRole('heading', { name: 'Bin collections' })).toBeVisible();
  await expect(page.getByText('General Waste')).toBeVisible();
  await expect(page.getByText('Recycling')).toBeVisible();
  await shot(page, project, '10-bins');

  await page.getByRole('button', { name: 'Change next collection' }).first().click();
  const exceptionDialog = page.getByRole('dialog');
  await expect(exceptionDialog).toBeVisible();
  await exceptionDialog.getByRole('button', { name: 'Save change' }).click();
  await expect(page.getByText(/skipped/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Scheduled changes')).toHaveCount(0);

  // 11-12. Shopping list.
  await goTo(page, 'Shopping');
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeVisible();
  await shot(page, project, '11-shopping-empty');
  await page.fill('input[placeholder*="Add item"]', 'Fairtrade coffee');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Fairtrade coffee')).toBeVisible();
  await page.getByRole('checkbox').click();
  await expect(page.getByText('Fairtrade coffee')).toHaveClass(/line-through/);
  await shot(page, project, '12-shopping-populated');

  // 13-15. Bills.
  await goTo(page, 'Bills');
  await expect(page.getByRole('heading', { name: 'Household bills' })).toBeVisible();
  await shot(page, project, '13-bills-empty');
  await page.getByRole('button', { name: 'Add bill' }).click();
  await expect(page.getByRole('heading', { name: 'Add household bill' })).toBeVisible();
  await page.fill('#bill_name', 'Council Tax');
  await page.fill('#bill_provider', 'Example Council');
  await page.fill('#bill_amount', '85.50');
  await page.fill('#bill_due', '2030-01-15');
  await shot(page, project, '14-bills-dialog');
  await page.getByRole('button', { name: 'Save bill' }).click();
  await expect(page.getByRole('heading', { name: 'Council Tax' })).toBeVisible();
  await shot(page, project, '15-bills-populated');
  await page.getByRole('button', { name: 'Mark paid' }).click();
  await expect(page.getByText('15 Feb 2030')).toBeVisible();
  await shot(page, project, '16-bills-paid');

  // 17-18. Calendar.
  await goTo(page, 'Calendar');
  await expect(page.getByRole('heading', { name: 'Shared calendar' })).toBeVisible();
  await shot(page, project, '17-calendar-empty');
  await page.getByRole('button', { name: 'Add event' }).click();
  await page.fill('#ev_title', 'Boiler service');
  await page.fill('#ev_start', '2030-02-20T10:00');
  await page.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByRole('heading', { name: 'Boiler service' })).toBeVisible();
  await shot(page, project, '18-calendar-populated');

  // 19. Notes.
  await goTo(page, 'Notes');
  await expect(page.getByRole('heading', { name: 'Household notes' })).toBeVisible();
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.fill('#note_title', 'Wi-Fi password');
  await page.fill('#note_content', 'On the router');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('heading', { name: 'Wi-Fi password' })).toBeVisible();
  await shot(page, project, '19-notes');

  // 20-21. Settings via More sheet on mobile.
  if (project === 'mobile') {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'More sections' })).toBeVisible();
    await shot(page, project, '20-more-sheet');
    await page
      .getByRole('dialog', { name: 'More sections' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await page.waitForLoadState('networkidle');
  } else {
    await goTo(page, 'Settings');
  }

  await expect(page.getByRole('heading', { name: 'Household settings' })).toBeVisible();
  await expect(page.getByText('Calendar feeds (iCal)')).toBeVisible();
  const choresFeed = page.getByText(/\/api\/ical\/feed\/.+\/chores\.ics/);
  await expect(choresFeed).toBeVisible();
  const feedUrl = (await choresFeed.textContent())?.trim();
  expect(feedUrl).toBeTruthy();
  const feedResponse = await page.request.get(feedUrl!);
  expect(feedResponse.status()).toBe(200);
  expect(await feedResponse.text()).toContain('BEGIN:VCALENDAR');

  const binsFeed = page.getByText(/\/api\/ical\/feed\/.+\/bins\.ics/);
  const binsFeedUrl = (await binsFeed.textContent())?.trim();
  expect(binsFeedUrl).toBeTruthy();
  const binsFeedResponse = await page.request.get(binsFeedUrl!);
  expect(binsFeedResponse.status()).toBe(200);
  expect(await binsFeedResponse.text()).toContain('Put out bins');
  await expect(page.getByText('Members (1)')).toBeVisible();
  await expect(page.getByText('Appearance')).toBeVisible();

  const addRoomButton = page.getByRole('button', { name: 'Add room' }).first();
  await addRoomButton.click();
  const roomDialog = page.getByRole('dialog', { name: 'Add room' });
  await roomDialog.getByLabel('Room name').fill('Utility room');
  await roomDialog.getByRole('button', { name: 'Add room' }).click();
  await expect(page.getByText('Utility room')).toBeVisible();
  await shot(page, project, '21-settings');

  // 22. Sign out and sign back in with ALTCHA.
  await page.getByRole('button', { name: 'Sign out of Chores' }).click();
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Sign in to Chores' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.fill('#email', email);
  await page.fill('#password', 'TestPassword123');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Today at home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View progress' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await shot(page, project, '22-dashboard-dark');

  await page.getByRole('link', { name: 'View progress' }).click();
  await page.waitForURL('**/progress');
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText(/Your level/)).toBeVisible();
  await shot(page, project, '23-progress');

  // 24. Bearer-token auth for future native clients.
  const rejectedLogin = await page.request.post('/api/v1/auth/login', {
    data: { email, password: 'TestPassword123' },
  });
  expect(rejectedLogin.status()).toBe(400);

  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (apiKey) {
    const signIn = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'TestPassword123',
          returnSecureToken: true,
        }),
      }
    );
    expect(signIn.status).toBe(200);
    const { idToken } = (await signIn.json()) as { idToken: string };
    const bearer = await page.request.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(bearer.status()).toBe(200);
    expect((await bearer.json()).email).toBe(email);
  }
});
