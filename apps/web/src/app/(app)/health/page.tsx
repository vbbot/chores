'use client';

import * as React from 'react';
import { HealthDiaryView } from '@/components/health/health-diary';

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Health diary</h1>
        <p className="text-sm text-secondary">
          Entries are private to the signed-in user. They are never shown to the household or to
          admins.
        </p>
      </div>
      <HealthDiaryView />
    </div>
  );
}
