import { MergeWardenConfigSchema, type MergeWardenConfig } from "./schema.js";

export const DEFAULT_CONFIG: MergeWardenConfig = MergeWardenConfigSchema.parse({ version: 1 });
