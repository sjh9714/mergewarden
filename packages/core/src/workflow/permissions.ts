export const KNOWN_WORKFLOW_PERMISSIONS = [
  "actions",
  "checks",
  "contents",
  "deployments",
  "id-token",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "repository-projects",
  "security-events",
  "statuses",
] as const;

export type WorkflowPermissionName = (typeof KNOWN_WORKFLOW_PERMISSIONS)[number];
export type WorkflowPermissionValue = "none" | "read" | "write";
export type NormalizedWorkflowPermissions = Record<WorkflowPermissionName, WorkflowPermissionValue>;

export interface PermissionEscalation {
  permission: WorkflowPermissionName;
  before: WorkflowPermissionValue;
  after: WorkflowPermissionValue;
}

const PERMISSION_RANK: Record<WorkflowPermissionValue, number> = {
  none: 0,
  read: 1,
  write: 2,
};

function emptyPermissions(): NormalizedWorkflowPermissions {
  return Object.fromEntries(
    KNOWN_WORKFLOW_PERMISSIONS.map((permission) => [permission, "none"]),
  ) as NormalizedWorkflowPermissions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePermissionValue(
  permission: WorkflowPermissionName,
  value: unknown,
): WorkflowPermissionValue {
  if (typeof value !== "string") {
    return "none";
  }

  const normalized = value.toLowerCase();

  if (permission === "id-token") {
    return normalized === "write" ? "write" : "none";
  }

  if (normalized === "read" || normalized === "write" || normalized === "none") {
    return normalized;
  }

  return "none";
}

export function normalizeWorkflowPermissions(input: unknown): NormalizedWorkflowPermissions {
  const permissions = emptyPermissions();

  if (typeof input === "string") {
    const normalized = input.toLowerCase();

    if (normalized === "write-all") {
      for (const permission of KNOWN_WORKFLOW_PERMISSIONS) {
        permissions[permission] = "write";
      }
    }

    if (normalized === "read-all") {
      for (const permission of KNOWN_WORKFLOW_PERMISSIONS) {
        permissions[permission] = permission === "id-token" ? "none" : "read";
      }
    }

    return permissions;
  }

  if (!isRecord(input)) {
    return permissions;
  }

  for (const permission of KNOWN_WORKFLOW_PERMISSIONS) {
    permissions[permission] = normalizePermissionValue(permission, input[permission]);
  }

  return permissions;
}

export function comparePermissionRank(
  left: WorkflowPermissionValue,
  right: WorkflowPermissionValue,
): number {
  return PERMISSION_RANK[left] - PERMISSION_RANK[right];
}

export function findPermissionEscalations(
  before: NormalizedWorkflowPermissions,
  after: NormalizedWorkflowPermissions,
): PermissionEscalation[] {
  return KNOWN_WORKFLOW_PERMISSIONS.flatMap((permission) => {
    if (comparePermissionRank(after[permission], before[permission]) <= 0) {
      return [];
    }

    return [
      {
        permission,
        before: before[permission],
        after: after[permission],
      },
    ];
  });
}
