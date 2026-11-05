import type { ChoreInstance, ChoreSuggestion } from '@chores/domain';
import { londonToday, suggestChores } from '@chores/domain';

import { householdCollection, listRooms } from './households';
import { listChoreTemplates } from './chores';

export async function suggestionsFor(householdId: string): Promise<ChoreSuggestion[]> {
  const [rooms, templates, instancesResult, dismissalsResult] = await Promise.all([
    listRooms(householdId),
    listChoreTemplates(householdId),
    householdCollection(householdId, 'choreInstances').get(),
    householdCollection(householdId, 'suggestionDismissals').get(),
  ]);

  const today = londonToday();
  const month = new Date(`${today}T12:00:00Z`).getUTCMonth() + 1;
  const instances = instancesResult.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ChoreInstance, 'id'>),
  }));

  const dismissedIds = dismissalsResult.docs
    .filter((doc) => {
      const dismissedAt = doc.data().dismissed_at;
      if (!dismissedAt) return false;
      const days = Math.floor(
        (Date.now() - new Date(dismissedAt).getTime()) / 86_400_000
      );
      return days < 30;
    })
    .map((doc) => doc.id);

  return suggestChores({
    month,
    today,
    rooms: rooms.map((room) => ({ id: room.id, name: room.name })),
    templates: templates
      .filter((template) => template.task_type !== 'one_off')
      .map((template) => ({
        id: template.id,
        name: template.name,
        room_id: template.room_id,
      })),
    instances: instances.map((instance) => ({
      template_id: instance.template_id,
      due_date: instance.due_date,
      status: instance.status,
    })),
    dismissedIds,
    pendingCount: instances.filter((instance) => instance.status === 'pending').length,
  });
}

export async function dismissSuggestion(
  householdId: string,
  suggestionId: string
): Promise<void> {
  await householdCollection(householdId, 'suggestionDismissals')
    .doc(suggestionId)
    .set({ dismissed_at: new Date().toISOString() });
}
