export const allRoles = [
  'ops',
  'legal',
  'front',
  'comp',
] as const;

export type Role = typeof allRoles[number];         // for native and web

/*
// returns valid roles based on platform
export function getValidRoles(): Role[] {
  return Platform.OS === 'web'
    ? allRoles.filter((r) => r !== 'worker' && r !== 'staff')
    : [...allRoles];
}

// returns blocked roles based on platform
export function getBlockedRoles(): Role[] {
  return Platform.OS === 'web'
    ? ['worker', 'staff']
    : [];
}
*/

// processes raw role string to Role type, ignores null which will be handled by if in app.web.tsx
export function normalizeRole(rawRole?: string): Role | null {
  const normalized = rawRole?.trim().toLowerCase();
  return allRoles.includes(normalized as Role) ? (normalized as Role) : null;
}