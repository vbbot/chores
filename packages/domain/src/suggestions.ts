import { daysBetween } from './dates';

export interface ChoreSuggestion {
  id: string;
  name: string;
  room_id: string | null;
  room_name: string | null;
  frequency: string;
  estimated_minutes: number;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

interface CatalogItem {
  id: string;
  name: string;
  room: string | null;
  frequency: string;
  minutes: number;
  priority: 'low' | 'medium' | 'high';
  months?: number[];
}

const CATALOG: CatalogItem[] = [
  {
    id: 'bathroom-grout',
    name: 'Clean bathroom tiles and grout',
    room: 'Bathroom',
    frequency: 'monthly',
    minutes: 25,
    priority: 'medium',
  },
  {
    id: 'bathroom-extractor',
    name: 'Clean the extractor fan',
    room: 'Bathroom',
    frequency: 'quarterly',
    minutes: 15,
    priority: 'low',
  },
  {
    id: 'kitchen-oven',
    name: 'Deep clean the oven',
    room: 'Kitchen',
    frequency: 'quarterly',
    minutes: 40,
    priority: 'medium',
  },
  {
    id: 'kitchen-fridge',
    name: 'Clean out the fridge',
    room: 'Kitchen',
    frequency: 'monthly',
    minutes: 20,
    priority: 'medium',
  },
  {
    id: 'bedroom-linen',
    name: 'Wash bed linen',
    room: 'Bedroom',
    frequency: 'weekly',
    minutes: 10,
    priority: 'medium',
  },
  {
    id: 'living-under-furniture',
    name: 'Vacuum under the furniture',
    room: 'Living Room',
    frequency: 'monthly',
    minutes: 20,
    priority: 'low',
  },
  {
    id: 'hallway-skirting',
    name: 'Wipe skirting boards',
    room: 'Hallway',
    frequency: 'monthly',
    minutes: 15,
    priority: 'low',
  },
  {
    id: 'garden-lawn',
    name: 'Mow the lawn',
    room: 'Garden',
    frequency: 'weekly',
    minutes: 30,
    priority: 'medium',
    months: [3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'garden-gutters',
    name: 'Clear the gutters',
    room: 'Garden',
    frequency: 'yearly',
    minutes: 45,
    priority: 'high',
    months: [9, 10, 11],
  },
  {
    id: 'radiators',
    name: 'Bleed the radiators',
    room: null,
    frequency: 'yearly',
    minutes: 20,
    priority: 'medium',
    months: [9, 10, 11],
  },
  {
    id: 'smoke-alarms',
    name: 'Test the smoke alarms',
    room: null,
    frequency: 'monthly',
    minutes: 5,
    priority: 'high',
  },
  {
    id: 'boiler-service',
    name: 'Book the annual boiler service',
    room: null,
    frequency: 'yearly',
    minutes: 10,
    priority: 'high',
    months: [8, 9, 10],
  },
];

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatches(existing: string, candidate: string): boolean {
  const a = normalise(existing);
  const b = normalise(candidate);
  if (a === b) return true;
  const words = b.split(' ').filter((word) => word.length > 3);
  return words.length > 0 && words.every((word) => a.includes(word));
}

export function suggestChores(input: {
  month: number;
  today: string;
  rooms: { id: string; name: string }[];
  templates: { id: string; name: string; room_id: string | null }[];
  instances: { template_id: string; due_date: string; status: string }[];
  dismissedIds: string[];
  pendingCount: number;
}): ChoreSuggestion[] {
  if (input.pendingCount >= 12) return [];

  const dismissed = new Set(input.dismissedIds);
  const findRoom = (name: string) => {
    const wanted = normalise(name);
    return input.rooms.find((room) => {
      const actual = normalise(room.name);
      return actual === wanted || actual.includes(wanted) || wanted.includes(actual);
    });
  };
  const existingNames = input.templates.map((template) => template.name);

  const roomCoverage = new Set(
    input.templates.map((template) => template.room_id).filter(Boolean)
  );
  const lastCompletedByTemplate = new Map<string, string>();
  input.instances
    .filter((instance) => instance.status === 'completed')
    .forEach((instance) => {
      const previous = lastCompletedByTemplate.get(instance.template_id);
      if (!previous || instance.due_date > previous) {
        lastCompletedByTemplate.set(instance.template_id, instance.due_date);
      }
    });

  const scored: { suggestion: ChoreSuggestion; score: number }[] = [];

  for (const item of CATALOG) {
    if (existingNames.some((name) => nameMatches(name, item.name))) continue;
    if (item.months && !item.months.includes(input.month)) continue;

    let roomId: string | null = null;
    let roomName: string | null = null;
    let reason = '';
    let score = 0;

    if (item.room) {
      const room = findRoom(item.room);
      if (!room) continue;
      roomId = room.id;
      roomName = room.name;

      if (!roomCoverage.has(room.id)) {
        reason = `No ${room.name.toLowerCase()} chore exists yet.`;
        score += 60;
      } else {
        const roomTemplates = input.templates.filter(
          (template) => template.room_id === room.id
        );
        const lastDates = roomTemplates
          .map((template) => lastCompletedByTemplate.get(template.id))
          .filter(Boolean) as string[];
        const lastDate = lastDates.sort().at(-1);
        if (!lastDate) {
          reason = `No ${room.name.toLowerCase()} chore has been completed yet.`;
          score += 45;
        } else if (daysBetween(lastDate, input.today) >= 21) {
          reason = `${room.name} has not been cleaned for ${daysBetween(lastDate, input.today)} days.`;
          score += 35;
        }
      }
    } else {
      reason = 'A regular UK home safety task.';
      score += 20;
    }

    if (item.months) {
      reason = `Seasonal task for this time of year. ${reason}`.trim();
      score += 30;
    }

    if (score === 0) continue;

    const id = `${item.id}:${roomId ?? 'home'}`;
    if (dismissed.has(id)) continue;

    scored.push({
      score,
      suggestion: {
        id,
        name: item.name,
        room_id: roomId,
        room_name: roomName,
        frequency: item.frequency,
        estimated_minutes: item.minutes,
        priority: item.priority,
        reason,
      },
    });
  }

  const sorted = scored.sort(
    (a, b) => b.score - a.score || a.suggestion.name.localeCompare(b.suggestion.name)
  );
  const chosen: typeof sorted = [];
  const usedRooms = new Set<string>();

  for (const entry of sorted) {
    const roomKey = entry.suggestion.room_id ?? 'home';
    if (usedRooms.has(roomKey)) continue;
    chosen.push(entry);
    usedRooms.add(roomKey);
    if (chosen.length === 3) break;
  }

  if (chosen.length < 3) {
    for (const entry of sorted) {
      if (chosen.includes(entry)) continue;
      chosen.push(entry);
      if (chosen.length === 3) break;
    }
  }

  return chosen.map((entry) => entry.suggestion);
}
