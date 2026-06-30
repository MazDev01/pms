import type { UserRole } from "./mock";

export type Permission =
  | "leads:create" | "leads:read" | "leads:update" | "leads:delete"
  | "customers:create" | "customers:read" | "customers:update" | "customers:delete"
  | "quotations:create" | "quotations:read" | "quotations:update" | "quotations:delete"
  | "tasks:manage"
  | "catalog:edit"
  | "dealers:manage"
  | "reports:view"
  | "analytics:view"
  | "hq:all_data";

const DEALER_BASE: Permission[] = [
  "leads:create", "leads:read", "leads:update", "leads:delete",
  "customers:create", "customers:read", "customers:update", "customers:delete",
  "quotations:create", "quotations:read", "quotations:update", "quotations:delete",
  "tasks:manage", "reports:view",
];

const HQ_ONLY: Permission[] = ["catalog:edit", "dealers:manage", "hq:all_data", "analytics:view"];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN:    [...DEALER_BASE, ...HQ_ONLY],
  HQ_MANAGEMENT: [...DEALER_BASE, ...HQ_ONLY],
  HQ_STAFF:      [...DEALER_BASE, "analytics:view"],
  DEALER_ADMIN:  [...DEALER_BASE, "analytics:view"],
  DEALER_SALES:  DEALER_BASE,
  DEALER_SITE:   ["leads:read", "customers:read"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
