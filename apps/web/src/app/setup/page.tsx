'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { londonDateString } from '@/lib/dates';
import { BinSchedule, ChoreTemplate, Household } from '@/lib/types';

const COMMON_ROOMS = [
  'Kitchen',
  'Living Room',
  'Bathroom',
  'Master Bedroom',
  'Second Bedroom',
  'Hallway',
  'Garden',
  'Garage',
  'Utility Room',
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [household, setHousehold] = React.useState<Household | null>(null);
  const [houseType, setHouseType] = React.useState('terraced');
  const [selectedRooms, setSelectedRooms] = React.useState<string[]>([
    'Kitchen',
    'Living Room',
    'Bathroom',
    'Master Bedroom',
  ]);
  const [binDay, setBinDay] = React.useState(0);
  const [binFrequency, setBinFrequency] = React.useState('weekly');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<Household>('/api/v1/households')
      .then((data) => {
        if (data.rooms && data.rooms.length > 0) {
          router.replace('/dashboard');
          return;
        }
        setHousehold(data);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    );
  };

  const finishSetup = async () => {
    if (!household) return;
    setLoading(true);
    setError(null);

    try {
      const [existingBins, existingTemplates] = await Promise.all([
        apiFetch<BinSchedule[]>('/api/v1/bins/schedules'),
        apiFetch<ChoreTemplate[]>('/api/v1/chores/templates'),
      ]);

      await apiFetch('/api/v1/households', {
        method: 'PUT',
        body: JSON.stringify({ house_type: houseType }),
      });

      if (household.rooms.length === 0 && selectedRooms.length > 0) {
        await apiFetch('/api/v1/households/rooms/bulk', {
          method: 'POST',
          body: JSON.stringify({
            rooms: selectedRooms.map((name) => ({ name, room_type: 'other' })),
          }),
        });
      }

      if (existingBins.length === 0) {
        const today = londonDateString();
        for (const bin of [
          { bin_type: 'general', name: 'General Waste', colour: 'black' },
          { bin_type: 'recycling', name: 'Recycling', colour: 'blue' },
        ]) {
          await apiFetch('/api/v1/bins/schedules', {
            method: 'POST',
            body: JSON.stringify({
              ...bin,
              collection_day: binDay,
              frequency: binFrequency,
              start_date: today,
            }),
          });
        }
      }

      if (existingTemplates.length === 0) {
        const starterChores = [
          {
            name: 'Clean kitchen worktops and hob',
            frequency: 'daily',
            estimated_minutes: 10,
            priority: 'medium',
          },
          {
            name: 'Vacuum living room and hallway',
            frequency: 'weekly',
            estimated_minutes: 20,
            priority: 'medium',
          },
        ];
        for (const chore of starterChores) {
          await apiFetch('/api/v1/chores/templates', {
            method: 'POST',
            body: JSON.stringify(chore),
          });
        }
      }

      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup');
      setLoading(false);
    }
  };

  if (!household) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-secondary">
        Loading household configuration...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
            Setup Step {step} of 3
          </div>
          <CardTitle className="text-xl">
            {step === 1 && 'Configure your home layout'}
            {step === 2 && 'Set up bin collections'}
            {step === 3 && 'Invite your household partner'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="house_type" className="block text-sm font-medium mb-1">
                  Property type
                </label>
                <select
                  id="house_type"
                  value={houseType}
                  onChange={(e) => setHouseType(e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                >
                  <option value="terraced">Terraced house</option>
                  <option value="semi-detached">Semi-detached house</option>
                  <option value="detached">Detached house</option>
                  <option value="flat">Flat / Apartment</option>
                  <option value="bungalow">Bungalow</option>
                </select>
              </div>

              <div>
                <span className="block text-sm font-medium mb-2">Select rooms and areas</span>
                <div className="grid grid-cols-2 gap-2">
                  {COMMON_ROOMS.map((room) => {
                    const isChecked = selectedRooms.includes(room);
                    return (
                      <button
                        type="button"
                        key={room}
                        onClick={() => toggleRoom(room)}
                        aria-pressed={isChecked}
                        className={`text-left px-3 py-2 text-sm rounded-card border min-h-[44px] ${
                          isChecked
                            ? 'border-foreground bg-foreground text-background font-medium'
                            : 'border-border bg-background text-foreground'
                        }`}
                      >
                        {room}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={() => setStep(2)} className="w-full mt-4">
                Next: Bin collection
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="bin_day" className="block text-sm font-medium mb-1">
                  Collection day
                </label>
                <select
                  id="bin_day"
                  value={binDay}
                  onChange={(e) => setBinDay(Number(e.target.value))}
                  className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                >
                  <option value={0}>Monday</option>
                  <option value={1}>Tuesday</option>
                  <option value={2}>Wednesday</option>
                  <option value={3}>Thursday</option>
                  <option value={4}>Friday</option>
                  <option value={5}>Saturday</option>
                  <option value={6}>Sunday</option>
                </select>
              </div>

              <div>
                <label htmlFor="bin_frequency" className="block text-sm font-medium mb-1">
                  Collection frequency
                </label>
                <select
                  id="bin_frequency"
                  value={binFrequency}
                  onChange={(e) => setBinFrequency(e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Fortnightly (every 2 weeks)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Next: Partner invite
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-secondary">
                Share this invite code with your partner or housemates. They can enter it during
                registration to join your household.
              </p>

              <div className="p-4 border-2 border-foreground rounded-card text-center bg-surface">
                <span className="text-xs uppercase tracking-widest text-secondary block mb-1">
                  Household Invite Code
                </span>
                <span className="text-2xl font-bold tracking-widest">
                  {household.invite_code}
                </span>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button onClick={finishSetup} disabled={loading} className="flex-1">
                  {loading ? 'Finalising...' : 'Complete setup'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
