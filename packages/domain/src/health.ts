export type HealthSeverity = 1 | 2 | 3 | 4 | 5;

export interface HealthEntry {
  id: string;
  date: string;
  time: string;
  symptoms: string[];
  severity: HealthSeverity;
  duration_minutes: number | null;
  energy: HealthSeverity | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthDiary {
  consent_at: string | null;
  entries: HealthEntry[];
}

export const COMMON_SYMPTOMS: readonly string[] = [
  'Headache',
  'Fatigue',
  'Nausea',
  'Bloating',
  'Cramps',
  'Joint pain',
  'Low mood',
  'Poor sleep',
];
