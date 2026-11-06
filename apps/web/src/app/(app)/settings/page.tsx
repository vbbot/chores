'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_REMINDER_SETTINGS } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
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

const settingsSections = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'household', label: 'Household' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'members', label: 'Members' },
  { id: 'calendar-feeds', label: 'Calendar feeds' },
  { id: 'devices', label: 'Devices' },
  { id: 'account', label: 'Account' },
] as const;

const textActionClass =
  'inline-flex min-h-[44px] items-center px-2 text-sm text-secondary underline-offset-4 transition-colors hover:underline disabled:pointer-events-none disabled:opacity-50';

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SettingsSection({
  id,
  title,
  description,
  action,
  open,
  onToggle,
  children,
}: SettingsSectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-32 pt-6 ${
        id === 'appearance' ? '' : 'border-t border-border'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls={`${id}-content`}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
              className="md:hidden inline-flex min-h-[44px] items-center px-2 text-xs text-secondary hover:text-foreground"
            >
              {open ? 'Hide' : 'Show'}
            </button>
          </div>
          {description && (
            <p className="mt-1 text-sm text-secondary">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div id={`${id}-content`} className={open ? 'mt-4' : 'mt-4 hidden md:block'}>
        {children}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const confirm = useConfirm();
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
  const [exportStatus, setExportStatus] = React.useState<string | null>(null);

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

  const householdTouched = React.useRef(false);
  const userTouched = React.useRef(false);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  React.useEffect(() => {
    if (householdTouched.current) return;
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
    if (userTouched.current) return;
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
    if (!(await confirm(`Delete the room "${room.name}"? Chores in it stay, without a room.`))) {
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
      setCopyError('Could not copy to the clipboard. Select the text and copy it manually.');
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

  const saveReminders = async () => {
    setReminderStatus(null);
    const isAdmin = user?.role === 'admin';

    if (
      isAdmin &&
      (!digestTime || !binsTime || !billTime || !calendarMinutes)
    ) {
      setReminderStatus('Fill in all household reminder times.');
      return;
    }

    try {
      if (isAdmin) {
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
      }

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

      householdTouched.current = false;
      userTouched.current = false;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.household }),
        refreshUser(),
      ]);
      setReminderStatus(
        isAdmin ? 'Reminders saved.' : 'Your reminders saved.'
      );
    } catch (err) {
      setReminderStatus(
        err instanceof Error ? err.message : 'Could not save reminders.'
      );
    }
  };

  const rotateInvite = async () => {
    if (!(await confirm('Generate a new invite code? The old code will stop working.'))) {
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
    if (!(await confirm(message))) return;
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
    setExportStatus(null);
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/v1/households/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chores-export-${londonDateString()}.json`;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 0);
      setExportStatus('Household data exported.');
    } catch (err) {
      setExportStatus(
        err instanceof Error ? err.message : 'Could not export household data.'
      );
    }
  };

  const sendTestNotification = async () => {
    setPushStatus(null);
    try {
      const result = await apiFetch<{ sent: number }>('/api/v1/notifications/test', {
        method: 'POST',
      });
      setPushStatus(
        result.sent > 0
          ? 'Test notification sent. Check this device.'
          : 'No device registered yet. Enable notifications on this device first.'
      );
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

  const calendarFeeds = [
    { key: 'chores', label: 'Chores feed', url: choresIcalUrl },
    { key: 'bins', label: 'Bins feed', url: binsIcalUrl },
    { key: 'bills', label: 'Bills feed', url: billsIcalUrl },
  ];

  const reminderTypes = [
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
  ];

  const isAdmin = user?.role === 'admin';
  const [activeSection, setActiveSection] = React.useState<string>(
    settingsSections[0].id
  );
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        settingsSections.map((section) => [section.id, true])
      ) as Record<string, boolean>
  );
  const tabNavRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({});

  const toggleSection = (id: string) => {
    setOpenSections((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const jumpToSection = (id: string) => {
    setOpenSections((previous) => ({ ...previous, [id]: true }));
    setActiveSection(id);
    window.setTimeout(() => {
      const target = document.getElementById(id);
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      target?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      window.history.replaceState(null, '', `#${id}`);
    }, 0);
  };

  React.useEffect(() => {
    const updateActive = () => {
      let current: string = settingsSections[0].id;
      settingsSections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= 132) {
          current = section.id;
        }
      });
      setActiveSection((previous) => (previous === current ? previous : current));
    };

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    return () => window.removeEventListener('scroll', updateActive);
  }, []);

  React.useEffect(() => {
    const nav = tabNavRef.current;
    const tab = tabRefs.current[activeSection];
    if (!nav || !tab) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const target =
      nav.scrollLeft +
      (tabRect.left - navRect.left) -
      (nav.clientWidth - tab.clientWidth) / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [activeSection]);

  React.useEffect(() => {
    const hash = window.location.hash.slice(1);
    window.setTimeout(() => {
      if (hash && settingsSections.some((section) => section.id === hash)) {
        setOpenSections((previous) => ({ ...previous, [hash]: true }));
        setActiveSection(hash);
        document.getElementById(hash)?.scrollIntoView({ block: 'start' });
        return;
      }
      window.scrollTo(0, 0);
    }, 0);
  }, []);

  return (
    <div className="space-y-8">
      <div className="max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight">Household settings</h1>
        <p className="text-sm text-secondary">
          Set appearance, reminders, rooms, members, calendar feeds, and devices.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="p-3 text-sm rounded-card border border-destructive text-destructive"
        >
          {loadError instanceof Error ? loadError.message : 'Failed to load household settings'}
        </div>
      )}

      {copyError && (
        <div
          role="alert"
          className="p-3 text-sm rounded-card border border-destructive text-destructive"
        >
          {copyError}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {copiedFeed
          ? `${copiedFeed === 'invite' ? 'Invite code' : 'Feed URL'} copied.`
          : ''}
      </p>

      <nav
        aria-label="Settings sections"
        className="sticky top-[60px] z-30 -mx-4 bg-background md:-mx-6"
      >
        <div
          ref={tabNavRef}
          className="flex gap-1 overflow-x-auto px-4 md:px-6"
        >
          {settingsSections.map((section) => {
            const active = activeSection === section.id;
            return (
              <a
                key={section.id}
                ref={(element) => {
                  tabRefs.current[section.id] = element;
                }}
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  jumpToSection(section.id);
                }}
                aria-current={active ? 'location' : undefined}
                className={`inline-flex min-h-[52px] items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors ${
                  active
                    ? 'border-accent text-foreground font-semibold'
                    : 'border-transparent text-secondary hover:text-foreground'
                }`}
              >
                {section.label}
              </a>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 space-y-8">
          <SettingsSection
            id="appearance"
            open={openSections.appearance}
            onToggle={() => toggleSection('appearance')}
            title="Appearance"
            description="Auto follows your device theme."
          >
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
          </SettingsSection>

          <SettingsSection
            id="household"
            title="Household"
            open={openSections.household}
            onToggle={() => toggleSection('household')}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-secondary">Name</span>
                <span className="font-semibold text-right">
                  {household?.name || 'Loading...'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-secondary">Property type</span>
                <span className="font-semibold capitalize text-right">
                  {household?.house_type || 'Not set'}
                </span>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                <div className="min-w-0">
                  <p className="text-sm text-secondary">Invite code</p>
                  <p className="mt-0.5 font-semibold tracking-wider break-all">
                    {household?.invite_code || 'Loading...'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(household?.invite_code ?? '', 'invite')}
                  disabled={!household?.invite_code}
                  aria-label="Copy invite code"
                  className={`${textActionClass} hover:text-foreground`}
                >
                  {copiedFeed === 'invite' ? 'Copied' : 'Copy code'}
                </button>
              </div>

              {inviteStatus && (
                <p role="status" aria-live="polite" className="text-sm text-secondary">
                  {inviteStatus}
                </p>
              )}
              {exportStatus && (
                <p role="status" aria-live="polite" className="text-sm text-secondary">
                  {exportStatus}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {isAdmin && (
                  <Button onClick={rotateInvite} variant="secondary">
                    Generate new invite code
                  </Button>
                )}
                <Button onClick={exportData} variant="secondary">
                  Export household data
                </Button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="reminders"
            open={openSections.reminders}
            onToggle={() => toggleSection('reminders')}
            title="Reminders"
            description="Household defaults apply to everyone. Leave an override blank to use the default."
          >
            {!isAdmin && (
              <p className="mb-3 text-sm text-secondary">
                Only an admin can change household defaults.
              </p>
            )}

            <div className="hidden gap-6 pb-2 text-xs font-semibold text-secondary md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <span>Setting</span>
              <span>Household default</span>
              <span>Your override</span>
            </div>

            <div>
              <div className="grid gap-3 border-t border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
                <p className="text-sm font-medium">Daily brief</p>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Household default
                  </span>
                  {isAdmin ? (
                    <Input
                      id="digest_time"
                      type="time"
                      value={digestTime}
                      aria-label="Household daily brief time"
                      onChange={(event) => {
                        householdTouched.current = true;
                        setDigestTime(event.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-sm">{digestTime}</span>
                  )}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Your override
                  </span>
                  <Input
                    id="user_digest_time"
                    type="time"
                    value={userDigestTime}
                    aria-label="Your daily brief time override"
                    onChange={(event) => {
                      userTouched.current = true;
                      setUserDigestTime(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 border-t border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
                <p className="text-sm font-medium">Bin reminder</p>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Household default
                  </span>
                  {isAdmin ? (
                    <Input
                      id="bins_time"
                      type="time"
                      value={binsTime}
                      aria-label="Household bin reminder time"
                      onChange={(event) => {
                        householdTouched.current = true;
                        setBinsTime(event.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-sm">{binsTime}</span>
                  )}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Your override
                  </span>
                  <Input
                    id="user_bins_time"
                    type="time"
                    value={userBinsTime}
                    aria-label="Your bin reminder time override"
                    onChange={(event) => {
                      userTouched.current = true;
                      setUserBinsTime(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 border-t border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
                <p className="text-sm font-medium">Bill lead days</p>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Household default
                  </span>
                  {isAdmin ? (
                    <Input
                      id="bill_days"
                      type="number"
                      min="0"
                      max="60"
                      value={billDays}
                      aria-label="Household bill lead days"
                      onChange={(event) => {
                        householdTouched.current = true;
                        setBillDays(event.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-sm">{billDays}</span>
                  )}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Your override
                  </span>
                  <Input
                    id="user_bill_days"
                    type="number"
                    min="0"
                    max="60"
                    value={userBillDays}
                    aria-label="Your bill lead days override"
                    onChange={(event) => {
                      userTouched.current = true;
                      setUserBillDays(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 border-t border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
                <p className="text-sm font-medium">Bill reminder time</p>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Household default
                  </span>
                  {isAdmin ? (
                    <Input
                      id="bill_time"
                      type="time"
                      value={billTime}
                      aria-label="Household bill reminder time"
                      onChange={(event) => {
                        householdTouched.current = true;
                        setBillTime(event.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-sm">{billTime}</span>
                  )}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Your override
                  </span>
                  <Input
                    id="user_bill_time"
                    type="time"
                    value={userBillTime}
                    aria-label="Your bill reminder time override"
                    onChange={(event) => {
                      userTouched.current = true;
                      setUserBillTime(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 border-t border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
                <p className="text-sm font-medium">Calendar lead minutes</p>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Household default
                  </span>
                  {isAdmin ? (
                    <Input
                      id="calendar_minutes"
                      type="number"
                      min="0"
                      value={calendarMinutes}
                      aria-label="Household calendar lead minutes"
                      onChange={(event) => {
                        householdTouched.current = true;
                        setCalendarMinutes(event.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-sm">{calendarMinutes}</span>
                  )}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Your override
                  </span>
                  <Input
                    id="user_calendar_minutes"
                    type="number"
                    min="0"
                    value={userCalendarMinutes}
                    aria-label="Your calendar lead minutes override"
                    onChange={(event) => {
                      userTouched.current = true;
                      setUserCalendarMinutes(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 border-t border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
                <p className="text-sm font-medium">Quiet hours</p>
                <div className="grid gap-2">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Household default
                  </span>
                  {isAdmin ? (
                    <>
                      <label
                        htmlFor="quiet_enabled"
                        className="flex min-h-[44px] items-center gap-2 text-sm font-medium"
                      >
                        <input
                          id="quiet_enabled"
                          type="checkbox"
                          checked={quietEnabled}
                          onChange={(event) => {
                            householdTouched.current = true;
                            setQuietEnabled(event.target.checked);
                          }}
                          className="w-4 h-4 rounded"
                        />
                        Quiet hours
                      </label>
                      {quietEnabled && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="quiet_start"
                            type="time"
                            value={quietStart}
                            aria-label="Household quiet hours start"
                            onChange={(event) => {
                              householdTouched.current = true;
                              setQuietStart(event.target.value);
                            }}
                          />
                          <Input
                            id="quiet_end"
                            type="time"
                            value={quietEnd}
                            aria-label="Household quiet hours end"
                            onChange={(event) => {
                              householdTouched.current = true;
                              setQuietEnd(event.target.value);
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm">
                      {quietEnabled ? `${quietStart} to ${quietEnd}` : 'Off'}
                    </span>
                  )}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold text-secondary md:sr-only">
                    Your override
                  </span>
                  <label
                    htmlFor="user_quiet"
                    className="flex min-h-[44px] items-center gap-2 text-sm font-medium"
                  >
                    <input
                      id="user_quiet"
                      type="checkbox"
                      checked={userQuietEnabled}
                      onChange={(event) => {
                        userTouched.current = true;
                        setUserQuietEnabled(event.target.checked);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    Respect quiet hours
                  </label>
                </div>
              </div>
            </div>

            <fieldset className="mt-2">
              <legend className="text-sm font-medium">Reminder types</legend>
              <div className="mt-1 flex flex-wrap gap-x-4">
                {reminderTypes.map((item) => (
                  <label
                    key={item.key}
                    htmlFor={`pref_${item.key}`}
                    className="flex min-h-[44px] items-center gap-2 text-sm"
                  >
                    <input
                      id={`pref_${item.key}`}
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => {
                        userTouched.current = true;
                        item.setEnabled(event.target.checked);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={saveReminders} variant="secondary">
                Save reminders
              </Button>
              <p
                role="status"
                aria-live="polite"
                className="min-h-[1.25rem] text-sm text-secondary"
              >
                {reminderStatus}
              </p>
            </div>
          </SettingsSection>

          <SettingsSection
            id="rooms"
            open={openSections.rooms}
            onToggle={() => toggleSection('rooms')}
            title={`Rooms (${rooms.length})`}
            action={
              <Button onClick={openAddRoom} variant="secondary">
                Add room
              </Button>
            }
          >
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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3 text-sm"
                  >
                    <span className="min-w-0 font-medium">{room.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditRoom(room)}
                        className={`${textActionClass} hover:text-foreground`}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRoom(room)}
                        className={`${textActionClass} hover:text-destructive`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            id="members"
            title={`Members (${members.length})`}
            open={openSections.members}
            onToggle={() => toggleSection('members')}
          >
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="block font-semibold">
                      {member.name}
                      {member.id === user?.id ? ' (you)' : ''}
                    </span>
                    <span className="block text-xs text-secondary break-all">
                      {member.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary capitalize">
                      {member.role}
                    </span>
                    {member.id === user?.id ? (
                      <button
                        type="button"
                        onClick={() => removeMember(member, true)}
                        className={`${textActionClass} hover:text-destructive`}
                      >
                        Leave
                      </button>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        onClick={() => removeMember(member, false)}
                        className={`${textActionClass} hover:text-destructive`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {memberError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {memberError}
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            id="calendar-feeds"
            open={openSections['calendar-feeds']}
            onToggle={() => toggleSection('calendar-feeds')}
            title="Calendar feeds (iCal)"
            description="Subscribe from Google Calendar, Apple Calendar, or Outlook using these feed URLs."
          >
            <div className="space-y-4">
              {calendarFeeds.map((feed) => (
                <div key={feed.key}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{feed.label}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(feed.url, feed.key)}
                      disabled={!feed.url}
                      className={`${textActionClass} hover:text-foreground`}
                    >
                      {copiedFeed === feed.key ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                  <div className="rounded-card border border-border bg-surface p-2 text-xs break-all select-all">
                    {feed.url || 'Feed unavailable. Sign in again.'}
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            id="devices"
            open={openSections.devices}
            onToggle={() => toggleSection('devices')}
            title="Device notifications"
            description="Enable browser notifications for reminders on this device."
          >
            <div className="flex flex-wrap gap-2">
              <Button onClick={subscribePush} variant="secondary">
                Enable notifications on this device
              </Button>
              <Button onClick={sendTestNotification} variant="secondary">
                Send test notification
              </Button>
            </div>
            {pushStatus && (
              <p
                role="status"
                aria-live="polite"
                className="mt-3 text-sm text-secondary"
              >
                {pushStatus}
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            id="account"
            open={openSections.account}
            onToggle={() => toggleSection('account')}
            title="Account"
            description="Your sign-in details for this household."
          >
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-secondary">Signed in as</span>{' '}
                <span className="font-semibold">{user?.email}</span>
              </p>
              <p>
                <span className="text-secondary">Role</span>{' '}
                <span className="font-semibold capitalize">{user?.role}</span>
              </p>
            </div>
            <Button
              onClick={logout}
              variant="secondary"
              className="mt-4 w-full text-destructive border-destructive"
            >
              Sign out of Chores
            </Button>
          </SettingsSection>
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
