export const queryKeys = {
  household: ['household'] as const,
  members: ['members'] as const,
  progress: ['progress'] as const,
  suggestions: ['suggestions'] as const,
  chores: {
    all: ['chores'] as const,
    templates: ['chores', 'templates'] as const,
    due: (today: string) => ['chores', 'instances', today] as const,
  },
  bins: {
    all: ['bins'] as const,
    schedules: ['bins', 'schedules'] as const,
    exceptions: ['bins', 'exceptions'] as const,
    tonight: ['bins', 'tonight'] as const,
  },
  bills: ['bills'] as const,
  shopping: ['shopping'] as const,
  calendar: ['calendar'] as const,
  notes: ['notes'] as const,
};
