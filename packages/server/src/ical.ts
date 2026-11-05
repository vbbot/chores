import type { Bill, ChoreInstance } from '@chores/domain';
import { addDays } from '@chores/domain';

import { upcomingBinDates } from './bins';
import { listBills } from './bills';
import { listChoreInstances } from './chores';

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function dateValue(value: string): string {
  return value.slice(0, 10).replace(/-/g, '');
}

function wrapCalendar(name: string, events: string[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chores//Household Management//EN',
    `X-WR-CALNAME:${escapeText(name)}`,
    ...events,
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function dateEvent(input: {
  uid: string;
  start: string;
  summary: string;
  description: string;
}): string {
  return [
    'BEGIN:VEVENT',
    `UID:${input.uid}@chores`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${dateValue(input.start)}`,
    `DTEND;VALUE=DATE:${dateValue(addDays(input.start, 1))}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    'END:VEVENT',
  ].join('\r\n');
}

export async function choresIcal(householdId: string): Promise<string> {
  const instances = await listChoreInstances(householdId, {});
  return wrapCalendar(
    'Chores',
    instances.map((instance: ChoreInstance) =>
      dateEvent({
        uid: `chore-${instance.id}`,
        start: instance.due_date,
        summary: `Chore: ${instance.template_name ?? 'Task'}`,
        description: `Status: ${instance.status}`,
      })
    )
  );
}

export async function binsIcal(householdId: string): Promise<string> {
  const schedules = await upcomingBinDates(householdId);
  const events = schedules.flatMap(({ schedule, dates }) =>
    dates.map((date) =>
      dateEvent({
        uid: `bin-${schedule.id}-${date}`,
        start: date,
        summary: `Bin Collection: ${schedule.name} (${schedule.colour})`,
        description: `Put out the ${schedule.colour} bin`,
      })
    )
  );
  return wrapCalendar('Bins', events);
}

export async function billsIcal(householdId: string): Promise<string> {
  const bills = await listBills(householdId);
  const events = bills
    .filter((bill: Bill) => bill.next_due_date)
    .map((bill: Bill) =>
      dateEvent({
        uid: `bill-${bill.id}`,
        start: bill.next_due_date!,
        summary: `Bill Due: ${bill.name} (${bill.amount_pence ? `£${(bill.amount_pence / 100).toFixed(2)}` : 'Amount unstated'})`,
        description: `Provider: ${bill.provider ?? 'N/A'}`,
      })
    );
  return wrapCalendar('Bills', events);
}
