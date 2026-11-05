'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_REMINDER_SETTINGS } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/theme-provider';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiFetch, resolveAbsoluteApiUrl } from '@/lib/api';
import { londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth';
import { getWebPushToken } from '@/lib/firebase';
import { Household, Room, User } from '@/lib/types';

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
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
  const [reminderStatus, setReminderStatus] = React.useState<string | null>(null);
  const [memberError, setMemberError] = React.useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = React.useState<string | null>(null);

  const [digestTime, setDigestTime] = React.useState(
    DEFAULT_REMINDER_SETTINGS.digest_time
  );
  const [binsTime, setBinsTime] = React.useState(
    DEFAULT_REMINDER_SETTINGS.bins_reminder_time
  );
  const [billDays, setBillDays] = React.useState(
    String(DEFAULT_REMINDER_SETTINGS.bill_reminder_days)
  );
  const [billTime, setBillTime] = React.useState(
    DEFAULT_REMINDER_SETTINGS.bill_reminder_time
  );
  const [calendarMinutes, setCalendarMinutes] = React.useState(
    String(DEFAULT_REMINDER_SETTINGS.calendar_reminder_minutes)
  );
  const [quietEnabled, setQuietEnabled] = React.useState(false);
  const [quietStart, setQuietStart] = React.useState('22:00');
  const [quietEnd, setQuietEnd] = React.useState('07:00');

  const [userDigestEnabled, setUserDigestEnabled] = React.useState(true);
  const [userDigestTime, setUserDigestTime] = React.useState('');
  const [userChoresEnabled, setUserChoresEnabled] = React.useState(true);
  const [userBinsEnabled, setUserBinsEnabled] = React.useState(true);
  const [userBinsTime, setUserBinsTime] = React.useState('');
  const [userBillsEnabled, setUserBillsEnabled] = React.useState(true);
  const [userBillDays, setUserBillDays] = React.useState('');
  const [userBillTime, setUserBillTime] = React.useState('');
  const [userCalendarEnabled, setUserCalendarEnabled] = React.useState(true);
  const [userCalendarMinutes, setUserCalendarMinutes] = React.useState('');
  const [userQuietEnabled, setUserQuietEnabled] = React.useState(true);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  React.useEffect(() => {
    const settings = household?.reminder_settings ?? DEFAULT_REMINDER_SETTINGS;
    setDigestTime(settings.digest_time);
    setBinsTime(settings.bins_reminder_time);
    setBillDays(String(settings.bill_reminder_days));
    setBillTime(settings.bill_reminder_time);
    setCalendarMinutes(String(settings.calendar_reminder_minutes));
    setQuietEnabled(Boolean(settings.quiet_hours));
    if (settings.quiet_hours) {
      setQuietStart(settings.quiet_hours.start);
      setQuietEnd(settings.quiet_hours.end);
    }
  }, [household]);

  React.useEffect(() => {
    const prefs = user?.notification_prefs ?? {};
    setUserDigestEnabled(prefs.digest?.enabled !== false);
    setUserDigestTime(prefs.digest?.time ?? '');
    setUserChoresEnabled(prefs.chores?.enabled !== false);
    setUserBinsEnabled(prefs.bins?.enabled !== false);
    setUserBinsTime(prefs.bins?.time ?? '');
    setUserBillsEnabled(prefs.bills?.enabled !== false);
    setUserBillDays(
      prefs.bills?.days_before === null || prefs.bills?.days_before === undefined
        ? ''
        : String(prefs.bills.days_before)
    );
    setUserBillTime(prefs.bills?.time ?? '');
    setUserCalendarEnabled(prefs.calendar?.enabled !== false);
    setUserCalendarMinutes(
      prefs.calendar?.minutes_before === null ||
        prefs.calendar?.minutes_before === undefined
        ? ''
        : String(prefs.calendar.minutes_before)
    );
    setUserQuietEnabled(prefs.quiet_hours?.enabled !== false);
  }, [user]);

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

  const saveReminderSettings = async () => {
    setReminderStatus(null);
    if (!digestTime || !binsTime || !billTime || !calendarMinutes) {
      setReminderStatus('Fill in all household reminder times.');
      return;
    }
    try {
      await apiFetch('/api/v1/households', {
        method: 'PUT',
        body: JSON.stringify({
          reminder_settings: {
            digest_time: digestTime,
            bins_reminder_time: binsTime,
            bill_reminder_days: Number(billDays),
            bill_reminder_time: billTime,
            calendar_reminder_minutes: Number(calendarMinutes),
            quiet_hours: quietEnabled
              ? { start: quietStart, end: quietEnd }
              : null,
          },
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
      setReminderStatus('Household reminder defaults saved.');
    } catch (err) {
      setReminderStatus(
        err instanceof Error ? err.message : 'Could not save reminder settings.'
      );
    }
  };

  const saveNotificationPrefs = async () => {
    setReminderStatus(null);
    try {
      await apiFetch('/api/v1/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          notification_prefs: {
            digest: {
              enabled: userDigestEnabled,
              time: userDigestTime || null,
            },
            chores: { enabled: userChoresEnabled },
            bins: { enabled: userBinsEnabled, time: userBinsTime || null },
            bills: {
              enabled: userBillsEnabled,
              days_before: userBillDays === '' ? null : Number(userBillDays),
              time: userBillTime || null,
            },
            calendar: {
              enabled: userCalendarEnabled,
              minutes_before:
                userCalendarMinutes === ''
                  ? null
                  : Number(userCalendarMinutes),
            },
            quiet_hours: { enabled: userQuietEnabled },
          },
        }),
      });
      await refreshUser();
      setReminderStatus('Your reminder preferences saved.');
    } catch (err) {
      setReminderStatus(
        err instanceof Error ? err.message : 'Could not save reminder preferences.'
      );
    }
  };

  const rotateInvite = async () => {
    if (!window.confirm('Generate a new invite code? The old code will stop working.')) {
      return;
    }
    setInviteStatus(null);
    try {
      await apiFetch('/api/v1/households/invite/rotate', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
      setInviteStatus('New invite code generated.');
    } catch (err) {
      setInviteStatus(
        err instanceof Error ? err.message : 'Could not generate a new code.'
      );
    }
  };

  const removeMember = async (member: User, self: boolean) => {
    const message = self
      ? 'Leave this household? Your pending chores will become unassigned.'
      : `Remove ${member.name} from this household? Their pending chores will become unassigned.`;
    if (!window.confirm(message)) return;
    setMemberError(null);
    try {
      await apiFetch(`/api/v1/households/members/${member.id}`, {
        method: 'DELETE',
      });
      if (self) {
        await logout();
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members }),
        queryClient.invalidateQueries({ queryKey: queryKeys.household }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chores.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.progress }),
      ]);
    } catch (err) {
      setMemberError(
        err instanceof Error ? err.message : 'Could not update household membership.'
      );
    }
  };

  const exportData = async () => {
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/v1/households/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chores-export-${londonDateString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setReminderStatus(
        err instanceof Error ? err.message : 'Could not export household data.'
      );
    }
  };

  const sendTestNotification = async () => {
    setPushStatus(null);
    try {
      await apiFetch('/api/v1/notifications/test', { method: 'POST' });
      setPushStatus('Test notification sent. Check this device.');
    } catch (err) {
      setPushStatus(
        err instanceof Error ? err.message : 'Could not send a test notification.'
      );
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
          {inviteStatus && (
            <p className="text-xs text-secondary">{inviteStatus}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {user?.role === 'admin' && (
              <Button onClick={rotateInvite} variant="secondary" className="text-xs px-3 py-1">
                Generate new invite code
              </Button>
            )}
            <Button onClick={exportData} variant="secondary" className="text-xs px-3 py-1">
              Export household data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminder Defaults */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Household reminders</CardTitle>
          <p className="text-xs text-secondary">
            Defaults for everyone. Each person can override the timing in their own settings.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="digest_time" className="block text-sm font-medium mb-1">
                Daily brief time
              </label>
              <Input
                id="digest_time"
                type="time"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bins_time" className="block text-sm font-medium mb-1">
                Bin reminder time
              </label>
              <Input
                id="bins_time"
                type="time"
                value={binsTime}
                onChange={(e) => setBinsTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bill_days" className="block text-sm font-medium mb-1">
                Bill lead days
              </label>
              <Input
                id="bill_days"
                type="number"
                min="0"
                max="60"
                value={billDays}
                onChange={(e) => setBillDays(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bill_time" className="block text-sm font-medium mb-1">
                Bill reminder time
              </label>
              <Input
                id="bill_time"
                type="time"
                value={billTime}
                onChange={(e) => setBillTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="calendar_minutes" className="block text-sm font-medium mb-1">
                Calendar lead minutes
              </label>
              <Input
                id="calendar_minutes"
                type="number"
                min="0"
                value={calendarMinutes}
                onChange={(e) => setCalendarMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="quiet_enabled"
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="quiet_enabled" className="text-sm font-medium">
                Quiet hours
              </label>
            </div>
            {quietEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="quiet_start" className="block text-sm font-medium mb-1">
                    From
                  </label>
                  <Input
                    id="quiet_start"
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="quiet_end" className="block text-sm font-medium mb-1">
                    To
                  </label>
                  <Input
                    id="quiet_end"
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {reminderStatus && (
            <p className="text-xs text-secondary">{reminderStatus}</p>
          )}
          <Button onClick={saveReminderSettings} variant="secondary">
            Save household reminders
          </Button>
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
              <div
                key={m.id}
                className="flex flex-wrap justify-between items-center gap-2 text-sm p-2 border border-border rounded-card"
              >
                <div>
                  <span className="font-semibold block">
                    {m.name}
                    {m.id === user?.id ? ' (you)' : ''}
                  </span>
                  <span className="text-xs text-secondary">{m.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs border border-border px-2 py-0.5 rounded-card capitalize">
                    {m.role}
                  </span>
                  {m.id === user?.id ? (
                    <button
                      onClick={() => removeMember(m, true)}
                      className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                    >
                      Leave
                    </button>
                  ) : user?.role === 'admin' ? (
                    <button
                      onClick={() => removeMember(m, false)}
                      className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {memberError && (
            <p role="alert" className="text-xs text-destructive mt-2">
              {memberError}
            </p>
          )}
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

      {/* Personal Reminder Preferences */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Your reminders</CardTitle>
          <p className="text-xs text-secondary">
            Leave a time blank to use the household default.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {[
              {
                key: 'digest',
                label: 'Daily brief',
                enabled: userDigestEnabled,
                setEnabled: setUserDigestEnabled,
              },
              {
                key: 'chores',
                label: 'Chore reminders',
                enabled: userChoresEnabled,
                setEnabled: setUserChoresEnabled,
              },
              {
                key: 'bins',
                label: 'Bin reminders',
                enabled: userBinsEnabled,
                setEnabled: setUserBinsEnabled,
              },
              {
                key: 'bills',
                label: 'Bill reminders',
                enabled: userBillsEnabled,
                setEnabled: setUserBillsEnabled,
              },
              {
                key: 'calendar',
                label: 'Calendar reminders',
                enabled: userCalendarEnabled,
                setEnabled: setUserCalendarEnabled,
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <input
                  id={`pref_${item.key}`}
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => item.setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor={`pref_${item.key}`} className="text-sm font-medium">
                  {item.label}
                </label>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="user_digest_time" className="block text-sm font-medium mb-1">
                Daily brief time
              </label>
              <Input
                id="user_digest_time"
                type="time"
                value={userDigestTime}
                onChange={(e) => setUserDigestTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="user_bins_time" className="block text-sm font-medium mb-1">
                Bin reminder time
              </label>
              <Input
                id="user_bins_time"
                type="time"
                value={userBinsTime}
                onChange={(e) => setUserBinsTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="user_bill_days" className="block text-sm font-medium mb-1">
                Bill lead days
              </label>
              <Input
                id="user_bill_days"
                type="number"
                min="0"
                max="60"
                value={userBillDays}
                onChange={(e) => setUserBillDays(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="user_bill_time" className="block text-sm font-medium mb-1">
                Bill reminder time
              </label>
              <Input
                id="user_bill_time"
                type="time"
                value={userBillTime}
                onChange={(e) => setUserBillTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="user_calendar_minutes" className="block text-sm font-medium mb-1">
                Calendar lead minutes
              </label>
              <Input
                id="user_calendar_minutes"
                type="number"
                min="0"
                value={userCalendarMinutes}
                onChange={(e) => setUserCalendarMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="user_quiet"
              type="checkbox"
              checked={userQuietEnabled}
              onChange={(e) => setUserQuietEnabled(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="user_quiet" className="text-sm font-medium">
              Respect quiet hours
            </label>
          </div>

          <Button onClick={saveNotificationPrefs} variant="secondary">
            Save my reminders
          </Button>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="border-x-0 border-b-0 border-t border-border rounded-none bg-transparent p-0 pt-5">
        <CardHeader>
          <CardTitle className="text-base">Device notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-secondary">
            Enable browser notifications for reminders on this device.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={subscribePush} variant="secondary">
              Enable notifications on this device
            </Button>
            <Button onClick={sendTestNotification} variant="secondary">
              Send test notification
            </Button>
          </div>
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
