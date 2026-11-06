import { householdCollection } from './households';
import { listBills } from './bills';
import { listCalendarEvents } from './calendar';
import { listChoreTemplates } from './chores';
import { listNotes } from './notes';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface SearchResults {
  chores: SearchHit[];
  notes: SearchHit[];
  bills: SearchHit[];
  events: SearchHit[];
  shopping: SearchHit[];
}

function matches(value: string | null | undefined, query: string): boolean {
  return String(value ?? '').toLowerCase().includes(query);
}

function limit(hits: SearchHit[]): SearchHit[] {
  return hits.slice(0, 10);
}

export async function searchHousehold(
  householdId: string,
  rawQuery: string
): Promise<SearchResults> {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) {
    return { chores: [], notes: [], bills: [], events: [], shopping: [] };
  }

  const [templates, notes, bills, events, shoppingResult] = await Promise.all([
    listChoreTemplates(householdId),
    listNotes(householdId),
    listBills(householdId),
    listCalendarEvents(householdId),
    householdCollection(householdId, 'shoppingLists').get(),
  ]);

  const chores = limit(
    templates
      .filter((template) => matches(template.name, query) || matches(template.description, query))
      .map((template) => ({
        id: template.id,
        title: template.name,
        subtitle:
          template.task_type === 'one_off' ? 'One-off task' : 'Recurring chore',
        url: `/chores#template-${template.id}`,
      }))
  );

  const noteHits = limit(
    notes
      .filter((note) => matches(note.title, query) || matches(note.content, query))
      .map((note) => ({
        id: note.id,
        title: note.title,
        subtitle: note.content.slice(0, 120),
        url: `/notes#note-${note.id}`,
      }))
  );

  const billHits = limit(
    bills
      .filter(
        (bill) =>
          matches(bill.name, query) ||
          matches(bill.provider, query) ||
          matches(bill.notes, query)
      )
      .map((bill) => ({
        id: bill.id,
        title: bill.name,
        subtitle: bill.provider ?? 'Household bill',
        url: `/bills#bill-${bill.id}`,
      }))
  );

  const eventHits = limit(
    events
      .filter(
        (event) => matches(event.title, query) || matches(event.description, query)
      )
      .map((event) => ({
        id: event.id,
        title: event.title,
        subtitle: event.description ?? 'Calendar event',
        url: `/calendar#event-${event.id}`,
      }))
  );

  const shopping: SearchHit[] = [];
  for (const list of shoppingResult.docs) {
    if (!list.data().is_active) continue;
    const items = await list.ref.collection('items').get();
    for (const item of items.docs) {
      const name = String(item.data().name ?? '');
      if (matches(name, query)) {
        shopping.push({
          id: item.id,
          title: name,
          subtitle: 'Shopping item',
          url: `/shopping#item-${item.id}`,
        });
      }
    }
  }

  return {
    chores,
    notes: noteHits,
    bills: billHits,
    events: eventHits,
    shopping: limit(shopping),
  };
}
