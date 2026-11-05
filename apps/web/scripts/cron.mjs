import cron from 'node-cron';

const baseUrl = process.env.INTERNAL_APP_URL || 'http://frontend:3000';
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error('CRON_SECRET is required');
  process.exit(1);
}

async function trigger(path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await response.text();
    console.log(`${new Date().toISOString()} ${path} ${response.status} ${body}`);
  } catch (error) {
    console.error(`${new Date().toISOString()} ${path} failed`, error);
  }
}

cron.schedule('5 0 * * *', () => trigger('/api/cron/chores'), {
  timezone: 'Europe/London',
});
cron.schedule('0 19 * * *', () => trigger('/api/cron/bin-reminders'), {
  timezone: 'Europe/London',
});

console.log('Chores cron scheduler started (Europe/London)');
