import { z } from "zod";

export const AgentContractSchema = z
  .object({
    version: z.literal(1),
    agent: z.string().optional(),
    task: z.string().optional(),
    issue: z.union([z.number().int(), z.string()]).optional(),
    allowed_paths: z.array(z.string()).min(1),
    blocked_paths: z.array(z.string()).optional(),
    required_evidence: z.array(z.string()).optional(),
    risk_budget: z
      .object({
        max_files_changed: z.number().int().positive().optional(),
        max_lines_changed: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type AgentContract = z.infer<typeof AgentContractSchema>;

export type ParseContractResult =
  | { kind: "missing" }
  | { kind: "valid"; contract: AgentContract }
  | { kind: "invalid"; message: string; issues?: unknown };
