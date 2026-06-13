import { describe, expect, it } from "vitest";

import {
  comparePermissionRank,
  findPermissionEscalations,
  normalizeWorkflowPermissions,
} from "../../src/workflow/permissions.js";

describe("workflow permission normalization", () => {
  it("normalizes read-all with id-token as none", () => {
    const permissions = normalizeWorkflowPermissions("read-all");

    expect(permissions.contents).toBe("read");
    expect(permissions["pull-requests"]).toBe("read");
    expect(permissions["id-token"]).toBe("none");
  });

  it("normalizes write-all as write for known permissions", () => {
    const permissions = normalizeWorkflowPermissions("write-all");

    expect(permissions.contents).toBe("write");
    expect(permissions["pull-requests"]).toBe("write");
    expect(permissions["id-token"]).toBe("write");
    expect(permissions.models).toBe("read");
    expect(permissions["vulnerability-alerts"]).toBe("read");
  });

  it("normalizes empty permission objects as none", () => {
    const permissions = normalizeWorkflowPermissions({});

    expect(permissions.contents).toBe("none");
    expect(permissions["pull-requests"]).toBe("none");
  });

  it("normalizes object permissions and unknown permissions are ignored", () => {
    const permissions = normalizeWorkflowPermissions({
      contents: "read",
      "pull-requests": "write",
      "id-token": "read",
      unknown: "write",
    });

    expect(permissions.contents).toBe("read");
    expect(permissions["pull-requests"]).toBe("write");
    expect(permissions["id-token"]).toBe("none");
    expect(permissions).not.toHaveProperty("unknown");
  });

  it("normalizes newer write-capable permission scopes", () => {
    const permissions = normalizeWorkflowPermissions({
      "artifact-metadata": "write",
      attestations: "write",
      "code-quality": "write",
      discussions: "write",
    });

    expect(permissions["artifact-metadata"]).toBe("write");
    expect(permissions.attestations).toBe("write");
    expect(permissions["code-quality"]).toBe("write");
    expect(permissions.discussions).toBe("write");
  });

  it("normalizes read-only permission scopes", () => {
    const permissions = normalizeWorkflowPermissions({
      models: "read",
      "vulnerability-alerts": "read",
    });

    expect(permissions.models).toBe("read");
    expect(permissions["vulnerability-alerts"]).toBe("read");
  });

  it("does not normalize read-only permission scopes to write", () => {
    const permissions = normalizeWorkflowPermissions({
      models: "write",
      "vulnerability-alerts": "write",
    });

    expect(permissions.models).toBe("none");
    expect(permissions["vulnerability-alerts"]).toBe("none");
  });

  it("compares permission ranks", () => {
    expect(comparePermissionRank("write", "read")).toBeGreaterThan(0);
    expect(comparePermissionRank("read", "none")).toBeGreaterThan(0);
    expect(comparePermissionRank("none", "write")).toBeLessThan(0);
  });

  it("finds permission escalations", () => {
    expect(
      findPermissionEscalations(
        normalizeWorkflowPermissions("read-all"),
        normalizeWorkflowPermissions("write-all"),
      ),
    ).toContainEqual({
      permission: "contents",
      before: "read",
      after: "write",
    });
  });
});
