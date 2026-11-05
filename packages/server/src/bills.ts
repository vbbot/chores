import { randomUUID } from 'node:crypto';

import type { Bill } from '@chores/domain';
import { advanceDueDate, londonToday } from '@chores/domain';

import { householdCollection } from './households';
import { ApiError } from './http';

export type BillInput = {
  name: string;
  provider?: string | null;
  amount_pence?: number | null;
  frequency?: string;
  due_day?: number | null;
  payment_method?: string | null;
  account_reference?: string | null;
  notes?: string | null;
  next_due_date?: string | null;
  is_active?: boolean;
};

function billFromDoc(id: string, data: Record<string, unknown>): Bill {
  return { id, ...(data as unknown as Omit<Bill, 'id'>) };
}

export async function listBills(householdId: string): Promise<Bill[]> {
  const result = await householdCollection(householdId, 'bills').get();
  return result.docs
    .map((doc) => billFromDoc(doc.id, doc.data()))
    .filter((bill) => bill.is_active)
    .sort((a, b) => {
      if (!a.next_due_date) return 1;
      if (!b.next_due_date) return -1;
      return a.next_due_date.localeCompare(b.next_due_date);
    });
}

export async function createBill(householdId: string, input: BillInput): Promise<Bill> {
  const id = randomUUID();
  const bill = {
    household_id: householdId,
    name: input.name.trim(),
    provider: input.provider ?? null,
    amount_pence: input.amount_pence ?? null,
    frequency: input.frequency ?? 'monthly',
    due_day: input.due_day ?? null,
    payment_method: input.payment_method ?? null,
    account_reference: input.account_reference ?? null,
    notes: input.notes ?? null,
    next_due_date: input.next_due_date ?? null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await householdCollection(householdId, 'bills').doc(id).set(bill);
  return { id, ...bill };
}

export async function updateBill(
  householdId: string,
  billId: string,
  input: Partial<BillInput>
): Promise<Bill> {
  const ref = householdCollection(householdId, 'bills').doc(billId);
  if (!(await ref.get()).exists) throw new ApiError('Bill not found', 404);
  const patch: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) patch[key] = key === 'name' ? String(value).trim() : value;
  });
  await ref.update(patch);
  return billFromDoc(billId, (await ref.get()).data() as Record<string, unknown>);
}

export async function payBill(householdId: string, billId: string): Promise<Bill> {
  const ref = householdCollection(householdId, 'bills').doc(billId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Bill not found', 404);

  const bill = billFromDoc(doc.id, doc.data() as Record<string, unknown>);
  const today = londonToday();
  const base = bill.next_due_date && bill.next_due_date > today ? bill.next_due_date : today;
  const next = advanceDueDate(base, bill.frequency);
  await ref.update({
    next_due_date: next,
    is_active: next !== null,
  });
  return { ...bill, next_due_date: next, is_active: next !== null };
}

export async function deleteBill(householdId: string, billId: string): Promise<void> {
  const ref = householdCollection(householdId, 'bills').doc(billId);
  if (!(await ref.get()).exists) throw new ApiError('Bill not found', 404);
  await ref.delete();
}
