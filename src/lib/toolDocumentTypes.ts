/** Client-safe document type constants (no Node fs/path). */

export const TOOL_DOC_TYPES = [
  "CALIB_CERTIFICATE",
  "CALIB_REPORT",
  "TOOL_MANUAL",
  "DRAWING",
  "DC_ATTACHMENT",
  "OTHER",
] as const;

export type ToolDocType = (typeof TOOL_DOC_TYPES)[number];

export function isToolDocType(v: string): v is ToolDocType {
  return (TOOL_DOC_TYPES as readonly string[]).includes(v);
}
