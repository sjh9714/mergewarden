import { z } from "zod";

import { NonEmptyStringSchema } from "../validation/schemas.js";

export const AgentContractSchema = z
  .object({
    version: z.literal(1),
    agent: NonEmptyStringSchema.optional(),
    task: NonEmptyStringSchema.optional(),
    issue: z.union([z.number().int(), z.string()]).optional(),
    allowed_paths: z.array(NonEmptyStringSchema).min(1),
    blocked_paths: z.array(NonEmptyStringSchema).optional(),
    required_evidence: z.array(NonEmptyStringSchema).optional(),
  })
  .strict();

export type AgentContract = z.infer<typeof AgentContractSchema>;

export type ParseContractResult =
  | { kind: "missing" }
  | { kind: "valid"; contract: AgentContract }
  | { kind: "invalid"; message: string; issues?: unknown };
