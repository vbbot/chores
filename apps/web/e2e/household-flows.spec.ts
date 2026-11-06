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
  await expect(
    page.getByRole('heading', { name: 'Chores', exact: true, level: 1 })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested for your home' })).toBeVisible();
  await shot(page, project, '07-chores-empty');
  const suggestionSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Suggested for your home' }) });
  const firstSuggestion = suggestionSection.locator('div.rounded-card.border').first();
  const firstSuggestionName = (
    await firstSuggestion.getByRole('heading').textContent()
  )?.trim();
  expect(firstSuggestionName).toBeTruthy();
  await firstSuggestion.getByRole('button', { name: 'Not now' }).click();
  await expect(
    page.getByRole('heading', { name: firstSuggestionName! })
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Add chore' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add recurring chore' })).toBeVisible();
  await expect(page.locator('#chore_name')).toBeFocused();
  await page.fill('#chore_name', 'Mop kitchen floor');
  await page.selectOption('#chore_freq', 'weekly');
  await shot(page, project, '08-chores-dialog');
  await page.getByRole('button', { name: 'Save chore' }).click();

  const dueSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Due now' }) });
  const choreInstance = dueSection
    .locator('div.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'Mop kitchen floor', exact: true }) })
    .first();
  await expect(choreInstance).toBeVisible();
  await expect(choreInstance.getByText('Assigned to you')).toBeVisible();

  await choreInstance.getByRole('button', { name: 'Assign' }).click();
  const assignDialog = page.getByRole('dialog', { name: 'Assign this chore' });
  await expect(assignDialog).toBeVisible();
  await assignDialog.getByRole('button', { name: 'Anyone' }).click();
  await expect(choreInstance.getByText('Assigned to Anyone')).toBeVisible();

  await choreInstance.getByRole('button', { name: 'Assign' }).click();
  await page
    .getByRole('dialog', { name: 'Assign this chore' })
    .getByRole('button', { name: 'E2E Housemate' })
    .click();
  await expect(choreInstance.getByText('Assigned to you')).toBeVisible();
  await expect(choreInstance.getByRole('button', { name: 'Mark done' })).toBeEnabled();
  await shot(page, project, '09-chores-populated');
  await choreInstance.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('status')).toContainText('XP');

  const historySection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Recent history' }) });
  const mopHistory = historySection
    .locator('div.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'Mop kitchen floor', exact: true }) })
    .first();
  await mopHistory.getByRole('button', { name: 'Undo' }).click();
  await expect(choreInstance).toBeVisible();
  await choreInstance.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('status')).toContainText('XP');

  // One-off task.
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('heading', { name: 'Add one-off task' })).toBeVisible();
  await page.fill('#chore_name', 'Call the plumber');
  await page.getByRole('button', { name: 'Save task' }).click();
  const oneOff = dueSection
    .locator('div.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'Call the plumber', exact: true }) })
    .first();
  await expect(oneOff).toBeVisible();
  await expect(oneOff.getByText(/One-off/)).toBeVisible();
  await oneOff.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit one-off task' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await oneOff.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('status')).toContainText('XP');

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

  const mopSchedule = page
    .locator('div.border.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'Mop kitchen floor', exact: true }) });
  await mopSchedule.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit recurring chore' })).toBeVisible();
  await page.selectOption('#chore_freq', 'monthly');
  await page.getByRole('button', { name: 'Save chore' }).click();
  await expect(mopSchedule.getByText('Monthly')).toBeVisible();

  // 10. Bins.
  await goTo(page, 'Bins');
  await expect(page.getByRole('heading', { name: 'Bin collections' })).toBeVisible();
  await expect(page.getByText('General Waste')).toBeVisible();
  await expect(page.getByText('Recycling')).toBeVisible();
  await shot(page, project, '10-bins');

  await page.getByRole('button', { name: 'Change next collection' }).first().click();
  const exceptionDialog = page.getByRole('dialog');
  await expect(exceptionDialog).toBeVisible();
  await shot(page, project, '10-bins-dialog');
  await exceptionDialog.getByRole('button', { name: 'Save change' }).click();
  await expect(page.getByText(/skipped/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Scheduled changes')).toHaveCount(0);

  page.once('dialog', (dialog) => dialog.accept());
  const generalWaste = page
    .locator('div.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'General Waste', exact: true }) });
  await generalWaste
    .getByRole('button', { name: 'Delete General Waste collection' })
    .click();
  await expect(page.getByRole('heading', { name: 'General Waste', exact: true })).toHaveCount(
    0
  );
  await expect(page.getByRole('heading', { name: 'Recycling', exact: true })).toBeVisible();

  // 11-12. Shopping list.
  await goTo(page, 'Shopping');
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeVisible();
  await shot(page, project, '11-shopping-empty');
  await page.fill('input[placeholder*="Add item"]', 'Fairtrade coffee');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Fairtrade coffee')).toBeVisible();
  await page.getByRole('checkbox').click();
  await expect(page.getByText('Fairtrade coffee')).toHaveClass(/line-through/);
  await page.fill('input[placeholder*="Add item"]', 'Oat milk');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Oat milk')).toBeVisible();
  const oatRow = page
    .locator('div.rounded-card')
    .filter({ has: page.getByText('Oat milk', { exact: true }) });
  await oatRow.getByRole('button', { name: 'Edit' }).click();
  await page.fill('#edit_item_quantity', '2');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('2x Oat milk')).toBeVisible();
  await shot(page, project, '12-shopping-populated');

  // 13-15. Bills.
  await goTo(page, 'Bills');
  await expect(page.getByRole('heading', { name: 'Household bills' })).toBeVisible();
  await expect(page.getByText('Loading household bills...')).toHaveCount(0);
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
  await page.getByRole('button', { name: /^Mark .* as paid$/ }).click();
  await expect(page.getByText('15 Feb 2030')).toBeVisible();
  await page.getByRole('button', { name: /^Edit / }).first().click();
  await page.fill('#bill_amount', '90.00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('£90.00')).toBeVisible();
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
  await page.getByRole('button', { name: /^Edit / }).first().click();
  await page.fill('#ev_title', 'Boiler service and flush');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Boiler service and flush' })
  ).toBeVisible();
  await shot(page, project, '18-calendar-populated');

  // 19. Notes.
  await goTo(page, 'Notes');
  await expect(page.getByRole('heading', { name: 'Household notes' })).toBeVisible();
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.fill('#note_title', 'Wi-Fi password');
  await page.fill('#note_content', 'On the router');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('heading', { name: 'Wi-Fi password' })).toBeVisible();
  await expect(page.getByText(/Added by You on/)).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.fill('#note_content', 'On the router, second shelf');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText(/Updated/)).toBeVisible();
  await shot(page, project, '19-notes');

  await page.getByRole('button', { name: 'Search' }).click();
  const searchDialog = page.getByRole('dialog', { name: 'Search household' });
  await expect(searchDialog).toBeVisible();
  await searchDialog.getByLabel('Search household').fill('Wi-Fi');
  await searchDialog.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(searchDialog.getByText('Wi-Fi password')).toBeVisible();
  await searchDialog.getByRole('button', { name: /Wi-Fi password/ }).click();
  await page.waitForURL(/\/notes#note-/);
  await expect(page.locator('[id^="note-"]').first()).toBeVisible();

  // 20-21. Settings via the header cog.
  if (project === 'mobile') {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'More sections' })).toBeVisible();
    await shot(page, project, '20-more-sheet');
    await page.keyboard.press('Escape');
  }

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.waitForLoadState('networkidle');

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
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

  const addRoomButton = page.getByRole('button', { name: 'Add room' }).first();
  await addRoomButton.click();
  const roomDialog = page.getByRole('dialog', { name: 'Add room' });
  await roomDialog.getByLabel('Room name').fill('Utility room');
  await roomDialog.getByRole('button', { name: 'Add room' }).click();
  await expect(page.getByText('Utility room')).toBeVisible();

  await page.fill('#digest_time', '08:15');
  await page.fill('#bins_time', '20:00');
  await page.fill('#user_digest_time', '08:30');
  await page.getByRole('button', { name: 'Save reminders' }).click();
  await expect(page.getByText('Reminders saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Send test notification' }).click();
  await expect(
    page.getByText(/Test notification sent|No device registered/)
  ).toBeVisible();
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

test('two-member distribution: fixed, balanced, and rotation', async ({
  page,
  browser,
}, testInfo) => {
  const project = testInfo.project.name;
  const emailA = emailFor(`${project}-owner`);
  const emailB = emailFor(`${project}-partner`);

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.fill('#name', 'E2E Owner');
  await page.fill('#email', emailA);
  await page.fill('#password', 'TestPassword123');
  await page.fill('#hh_name', `E2E Shared Home ${project}`);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/setup');
  await page.getByRole('button', { name: 'Next: Bin collection' }).click();
  await page.selectOption('#bin_day', '0');
  await page.getByRole('button', { name: 'Next: Partner invite' }).click();
  await page.getByRole('button', { name: 'Complete setup' }).click();
  await page.waitForURL('**/dashboard');

  const household = (await (
    await page.request.get('/api/v1/households')
  ).json()) as { invite_code: string };

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto('/register');
  await pageB.getByRole('button', { name: 'Join existing' }).click();
  await pageB.fill('#name', 'E2E Partner');
  await pageB.fill('#email', emailB);
  await pageB.fill('#password', 'TestPassword123');
  await pageB.fill('#inv_code', household.invite_code);
  await expect(pageB.getByRole('button', { name: 'Create account' })).toBeEnabled({
    timeout: 30_000,
  });
  await pageB.getByRole('button', { name: 'Create account' }).click();
  await pageB.waitForURL('**/dashboard');

  const meA = (await (await page.request.get('/api/v1/auth/me')).json()) as {
    id: string;
  };
  const meB = (await (await pageB.request.get('/api/v1/auth/me')).json()) as {
    id: string;
  };

  // Fixed one-off task assigned to the partner.
  // Reload so the owner's cached member list includes the new partner.
  await page.goto('/chores');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.fill('#chore_name', 'Return parcel');
  await page.selectOption('#assignment_mode', 'fixed');
  await page.selectOption('#fixed_assignee', { label: 'E2E Partner' });
  await page.getByRole('button', { name: 'Save task' }).click();
  const ownerDue = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Due now' }) });
  const fixedTask = ownerDue
    .locator('div.rounded-card')
    .filter({ has: page.getByRole('heading', { name: 'Return parcel', exact: true }) })
    .first();
  await expect(fixedTask.getByText('Assigned to E2E Partner')).toBeVisible();

  // Full load so the partner's cached chore list reflects the new task.
  await pageB.goto('/chores');
  const partnerDue = pageB
    .locator('section')
    .filter({ has: pageB.getByRole('heading', { name: 'Due now' }) });
  const partnerTask = partnerDue
    .locator('div.rounded-card')
    .filter({ has: pageB.getByRole('heading', { name: 'Return parcel', exact: true }) })
    .first();
  await expect(partnerTask.getByText('Assigned to you')).toBeVisible();
  await partnerTask.getByRole('button', { name: 'Mark done' }).click();
  await expect(pageB.getByRole('status')).toContainText('XP');

  // Auto-balance sends the next reusable chore to the lighter member.
  await goTo(page, 'Chores');
  await page.getByRole('button', { name: 'Add chore' }).first().click();
  await page.fill('#chore_name', 'Water plants');
  await expect(page.locator('#assignment_mode')).toHaveValue('balanced');
  await page.getByRole('button', { name: 'Save chore' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Add recurring chore' })
  ).toBeHidden({ timeout: 20_000 });

  const pendingAfterBalance = (await (
    await page.request.get('/api/v1/chores/instances?status=pending')
  ).json()) as { id: string; template_name?: string; assigned_to: string | null }[];
  const water = pendingAfterBalance.find(
    (instance) => instance.template_name === 'Water plants'
  );
  expect(water?.assigned_to).toBe(meB.id);

  // Rotation moves the next occurrence to the other member.
  await page.getByRole('button', { name: 'Add chore' }).first().click();
  await page.fill('#chore_name', 'Clean bathroom');
  await page.selectOption('#assignment_mode', 'rotate');
  await page.getByRole('button', { name: 'Save chore' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Add recurring chore' })
  ).toBeHidden({ timeout: 20_000 });

  const pendingAfterRotate = (await (
    await page.request.get('/api/v1/chores/instances?status=pending')
  ).json()) as { id: string; template_name?: string; assigned_to: string | null }[];
  const bathroom = pendingAfterRotate.find(
    (instance) => instance.template_name === 'Clean bathroom'
  );
  expect(bathroom?.assigned_to).toBe(meA.id);

  await page.request.post(`/api/v1/chores/instances/${bathroom!.id}/complete`, {
    data: {},
  });

  const pendingAfterCompletion = (await (
    await page.request.get('/api/v1/chores/instances?status=pending')
  ).json()) as { template_name?: string; assigned_to: string | null }[];
  const nextBathroom = pendingAfterCompletion.find(
    (instance) => instance.template_name === 'Clean bathroom'
  );
  expect(nextBathroom?.assigned_to).toBe(meB.id);

  // Scheduling rules save start date, weekday, due time, and reminder settings.
  const monday = new Date();
  monday.setUTCDate(monday.getUTCDate() + 1);
  while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() + 1);
  const mondayDate = monday.toISOString().slice(0, 10);
  const scheduledResponse = await page.request.post('/api/v1/chores/templates', {
    data: {
      name: 'Scheduled test chore',
      task_type: 'recurring',
      start_date: mondayDate,
      frequency: 'weekly',
      weekdays: [0],
      due_time: '18:00',
      reminder_mode: 'before_due',
      reminder_offset_minutes: 30,
      assignment_mode: 'anyone',
    },
  });
  expect(scheduledResponse.status()).toBe(200);
  const scheduled = (await scheduledResponse.json()) as {
    next_due_date: string;
    weekdays: number[];
    due_time: string;
    reminder_mode: string;
    reminder_offset_minutes: number;
  };
  expect(scheduled.next_due_date).toBe(mondayDate);
  expect(scheduled.weekdays).toEqual([0]);
  expect(scheduled.due_time).toBe('18:00');
  expect(scheduled.reminder_mode).toBe('before_due');
  expect(scheduled.reminder_offset_minutes).toBe(30);

  // Calendar events notify the other household member.
  const eventResponse = await page.request.post('/api/v1/calendar/events', {
    data: {
      title: 'Boiler service',
      start_time: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
  expect(eventResponse.status()).toBe(200);

  const notifications = (await (
    await pageB.request.get('/api/v1/notifications')
  ).json()) as { type: string; body: string }[];
  expect(
    notifications.some(
      (notification) =>
        notification.type === 'calendar_event' &&
        notification.body.includes('Boiler service')
    )
  ).toBe(true);

  await pageB.getByRole('button', { name: 'Notifications' }).click();
  const notificationDialog = pageB.getByRole('dialog', { name: 'Notifications' });
  await expect(notificationDialog).toBeVisible();
  await expect(notificationDialog.getByText('Boiler service')).toBeVisible();

  await contextB.close();
});
