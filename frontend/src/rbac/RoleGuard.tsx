/**
 * RoleGuard Component
 * Conditionally renders children based on user permissions.
 * Use this to wrap any UI element that should only be visible to certain roles.
 */
import type { ReactNode } from "react";
import { usePermissions } from "./usePermissions";
import type { Permission } from "./permissions";
import type { UserRole } from "../types";

interface RoleGuardProps {
  children: ReactNode;
  /** Required permission(s). If multiple, user must have ALL by default. */
  permission?: Permission | Permission[];
  /** If true, user only needs ANY of the given permissions. */
  any?: boolean;
  /** Alternative: guard by role(s) directly. */
  roles?: UserRole[];
  /** Fallback UI when access is denied (defaults to nothing). */
  fallback?: ReactNode;
}

export function RoleGuard({
  children,
  permission,
  any = false,
  roles,
  fallback = null,
}: RoleGuardProps) {
  const { can, canAll, canAny, isAnyRole, role } = usePermissions();

  // Not authenticated
  if (!role) return <>{fallback}</>;

  // Check by roles
  if (roles && !isAnyRole(roles)) return <>{fallback}</>;

  // Check by permission(s)
  if (permission) {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (perms.length === 1) {
      if (!can(perms[0])) return <>{fallback}</>;
    } else if (any) {
      if (!canAny(perms)) return <>{fallback}</>;
    } else {
      if (!canAll(perms)) return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
