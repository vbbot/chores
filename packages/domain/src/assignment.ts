import type { AssignmentMode } from './types';

export interface AssignmentMember {
  id: string;
  name: string;
}

export interface MemberLoad {
  /** Minutes of open work plus work completed in the fairness window. */
  minutes: number;
  open_chores: number;
  last_assigned_at: string | null;
}

export function emptyMemberLoad(): MemberLoad {
  return { minutes: 0, open_chores: 0, last_assigned_at: null };
}

export function defaultAssignmentMode(memberCount: number): AssignmentMode {
  return memberCount > 0 ? 'balanced' : 'anyone';
}

/**
 * Returns the next member in the rotation.
 * A null rotation list means every household member takes part.
 */
export function nextRotationAssignee(
  memberIds: string[],
  rotationIds: string[] | null,
  lastAssigneeId: string | null
): string | null {
  const allowed = rotationIds && rotationIds.length > 0
    ? rotationIds.filter((id) => memberIds.includes(id))
    : memberIds;
  if (allowed.length === 0) return null;
  if (allowed.length === 1) return allowed[0];

  const lastIndex = lastAssigneeId ? allowed.indexOf(lastAssigneeId) : -1;
  return allowed[(lastIndex + 1) % allowed.length];
}

/**
 * Picks the member with the lightest rolling load.
 * Ties go to fewer open chores, then the longest time since assignment.
 */
export function pickBalancedAssignee(
  members: AssignmentMember[],
  loads: Record<string, MemberLoad>
): string | null {
  if (members.length === 0) return null;

  return [...members].sort((a, b) => {
    const loadA = loads[a.id] ?? emptyMemberLoad();
    const loadB = loads[b.id] ?? emptyMemberLoad();

    if (loadA.minutes !== loadB.minutes) return loadA.minutes - loadB.minutes;
    if (loadA.open_chores !== loadB.open_chores) {
      return loadA.open_chores - loadB.open_chores;
    }

    if (loadA.last_assigned_at !== loadB.last_assigned_at) {
      if (!loadA.last_assigned_at) return -1;
      if (!loadB.last_assigned_at) return 1;
      return loadA.last_assigned_at.localeCompare(loadB.last_assigned_at);
    }

    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  })[0].id;
}

export function assignmentModeLabel(mode: AssignmentMode | undefined): string {
  switch (mode) {
    case 'anyone':
      return 'Anyone';
    case 'fixed':
      return 'One person';
    case 'rotate':
      return 'Takes turns';
    case 'balanced':
    default:
      return 'Auto-balanced';
  }
}
