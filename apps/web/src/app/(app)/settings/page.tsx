'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/theme-provider';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiFetch, resolveAbsoluteApiUrl } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth';
import { getWebPushToken } from '@/lib/firebase';
import { Household, Room, User } from '@/lib/types';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const queryClient = useQueryClient();
  const { data: householdData, error: householdError } = useApiQuery<Household>(
    queryKeys.household,
    '/api/v1/households'
  );
  const { data: memberData, error: membersError } = useApiQuery<User[]>(
    queryKeys.members,
    '/api/v1/households/members'
  );
  const household = householdData ?? null;
  const members = memberData ?? [];
  const loadError = householdError ?? membersError;
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const [copiedFeed, setCopiedFeed] = React.useState<string | null>(null);
  const [pushStatus, setPushStatus] = React.useState<string | null>(null);
  const [roomDialogOpen, setRoomDialogOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);
  const [roomName, setRoomName] = React.useState('');
  const [roomError, setRoomError] = React.useState<string | null>(null);
  const [roomSubmitting, setRoomSubmitting] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const rooms = household?.rooms ?? [];

  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomName('');
    setRoomError(null);
    setRoomDialogOpen(true);
  };

  const openEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setRoomError(null);
    setRoomDialogOpen(true);
  };

  const saveRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomName.trim()) {
      setRoomError('Give the room a name.');
      return;
    }

    setRoomSubmitting(true);
    setRoomError(null);
    try {
      if (editingRoom) {
        await apiFetch(`/api/v1/households/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: roomName.trim() }),
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.household });
      } else {
        await apiFetch('/api/v1/households/rooms', {
          method: 'POST',
          body: JSON.stringify({ name: roomName.trim(), room_type: 'other' }),
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.household });
      }
      setRoomDialogOpen(false);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Could not save this room.');
    } finally {
      setRoomSubmitting(false);
    }
  };

  const deleteRoom = async (room: Room) => {
    if (!window.confirm(`Delete the room "${room.name}"? Chores in it stay, without a room.`)) {
      return;
    }
    setRoomError(null);
    try {
      await apiFetch(`/api/v1/households/rooms/${room.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Could not delete this room.');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeed(label);
      setTimeout(() => setCopiedFeed(null), 2000);
    } catch {
      setCopyError('Could not copy to the clipboard. Select the URL and copy it manually.');
    }
  };

  const subscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      setPushStatus('Push notifications are not supported on this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('Notification permission was not granted.');
        return;
      }

      const token = await getWebPushToken();
      if (!token) {
        setPushStatus('Push notifications are not supported on this browser.');
        return;
      }

      await apiFetch('/api/v1/notifications/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ token, platform: 'web' }),
      });
      setPushStatus('Subscribed to notifications on this device.');
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : 'Could not subscribe');
    }
  };

  const feedToken = user?.ical_token;
  const choresIcalUrl = feedToken
    ? resolveAbsoluteApiUrl(`/api/ical/feed/${feedToken}/chores.ics`, origin)
    : '';
  const binsIcalUrl = feedToken
    ? resolveAbsoluteApiUrl(`/api/ical/feed/${feedToken}/bins.ics`, origin)
    : '';
  const billsIcalUrl = feedToken
    ? resolveAbsoluteApiUrl(`/api/ical/feed/${feedToken}/bills.ics`, origin)
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Household settings</h1>
        <p className="text-sm text-secondary">
          Manage rooms, calendar feeds, notifications, and household members.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {loadError instanceof Error ? loadError.message : 'Failed to load household settings'}
        </div>
      )}

      {/* Household & Invite */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Household</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-secondary">Name:</span>
            <span className="font-semibold">{household?.name || 'Loading...'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-secondary">Property type:</span>
            <span className="font-semibold capitalize">{household?.house_type || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center text-sm border-t border-border pt-2">
            <span className="text-secondary">Invite code:</span>
            <span className="font-bold tracking-wider">{household?.invite_code}</span>
          </div>
        </CardContent>
      </Card>

      {/* Rooms */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">Rooms ({rooms.length})</CardTitle>
            <Button onClick={openAddRoom} variant="secondary" className="text-xs px-3 py-1">
              Add room
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {roomError && !roomDialogOpen && (
            <div
              role="alert"
              className="mb-3 p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {roomError}
            </div>
          )}
          {rooms.length === 0 ? (
            <p className="text-sm text-secondary">
              No rooms yet. Add rooms so chores can be grouped by area.
            </p>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex justify-between items-center text-sm p-2 border border-border rounded-card"
                >
                  <span className="font-medium">{room.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEditRoom(room)}
                      className="text-xs underline text-secondary hover:text-foreground"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => deleteRoom(room)}
                      className="text-xs text-secondary hover:text-destructive"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2" role="group" aria-label="Theme">
            {(['auto', 'light', 'dark'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`flex-1 min-h-[44px] border rounded-card text-sm font-semibold capitalize ${
                  mode === value
                    ? 'border-accent text-accent bg-surface'
                    : 'border-border text-foreground hover:bg-surface'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="text-xs text-secondary mt-2">
            Auto follows your device theme.
          </p>
        </CardContent>
      </Card>

      {/* Household Members */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex justify-between items-center text-sm p-2 border border-border rounded-card">
                <div>
                  <span className="font-semibold block">{m.name}</span>
                  <span className="text-xs text-secondary">{m.email}</span>
                </div>
                <span className="text-xs border border-border px-2 py-0.5 rounded-card capitalize">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Feeds (iCal) */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Calendar feeds (iCal)</CardTitle>
          <p className="text-xs text-secondary">
            Subscribe from Google Calendar, Apple Calendar, or Outlook using these feed URLs.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {copyError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {copyError}
            </div>
          )}
          <div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-medium">Chores feed</span>
              <button
                onClick={() => copyToClipboard(choresIcalUrl, 'chores')}
                disabled={!choresIcalUrl}
                className="text-xs underline text-secondary hover:text-foreground"
              >
                {copiedFeed === 'chores' ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            <div className="p-2 border border-border rounded-card bg-surface text-xs break-all select-all">
              {choresIcalUrl || 'Feed unavailable. Sign in again.'}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-medium">Bins feed</span>
              <button
                onClick={() => copyToClipboard(binsIcalUrl, 'bins')}
                disabled={!binsIcalUrl}
                className="text-xs underline text-secondary hover:text-foreground"
              >
                {copiedFeed === 'bins' ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            <div className="p-2 border border-border rounded-card bg-surface text-xs break-all select-all">
              {binsIcalUrl || 'Feed unavailable. Sign in again.'}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="font-medium">Bills feed</span>
              <button
                onClick={() => copyToClipboard(billsIcalUrl, 'bills')}
                disabled={!billsIcalUrl}
                className="text-xs underline text-secondary hover:text-foreground"
              >
                {copiedFeed === 'bills' ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            <div className="p-2 border border-border rounded-card bg-surface text-xs break-all select-all">
              {billsIcalUrl || 'Feed unavailable. Sign in again.'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Device notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-secondary">
            Enable browser notifications for evening bin reminders on this device.
          </p>
          <Button onClick={subscribePush} variant="secondary">
            Enable notifications on this device
          </Button>
          {pushStatus && (
            <p className="text-xs text-secondary mt-1">{pushStatus}</p>
          )}
        </CardContent>
      </Card>

      {/* Account Logout */}
      <div className="pt-2">
        <Button onClick={logout} variant="secondary" className="w-full text-destructive border-destructive">
          Sign out of Chores
        </Button>
      </div>

      <Dialog
        open={roomDialogOpen}
        onClose={() => setRoomDialogOpen(false)}
        title={editingRoom ? 'Rename room' : 'Add room'}
      >
        <form onSubmit={saveRoom} className="space-y-4">
          {roomError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {roomError}
            </div>
          )}
          <div>
            <label htmlFor="room_name" className="block text-sm font-medium mb-1">
              Room name
            </label>
            <Input
              id="room_name"
              required
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="e.g. Spare bedroom"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRoomDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={roomSubmitting}>
              {roomSubmitting ? 'Saving...' : editingRoom ? 'Save room' : 'Add room'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
