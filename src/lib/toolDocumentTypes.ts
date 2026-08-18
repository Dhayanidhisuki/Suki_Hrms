/** Client-safe document type constants (no Node fs/path). */
export const TOOL_DOC_TYPES = [
  "CALIB_CERTIFICATE",
  "CALIB_REPORT",
  "CALIB_PHOTO",
  "TOOL_PHOTO",
  "DEFECT_PHOTO",
  "TOOL_MANUAL",
  "DRAWING",
  "DC_ATTACHMENT",
  "OTHER",
] as const;

export type ToolDocType = (typeof TOOL_DOC_TYPES)[number];

export function isToolDocType(v: string): v is ToolDocType {
  return (TOOL_DOC_TYPES as readonly string[]).includes(v);
}

export const DOC_TYPE_LABELS: Record<ToolDocType, string> = {
  CALIB_CERTIFICATE: "Calibration Certificate",
  CALIB_REPORT: "Calibration Report",
  CALIB_PHOTO: "Calibration Setup Photo",
  TOOL_PHOTO: "Tool / Instrument Photo",
  DEFECT_PHOTO: "Defect / Damage Photo",
  TOOL_MANUAL: "Tool Manual / SOP",
  DRAWING: "Technical Drawing",
  DC_ATTACHMENT: "DC / Gate Pass",
  OTHER: "Other Document",
};

export const DOC_TYPE_GROUPS = [
  { id: "ALL", label: "All Documents & Photos" },
  { id: "CERTIFICATES", label: "Certificates & Reports", types: ["CALIB_CERTIFICATE", "CALIB_REPORT"] },
  { id: "PHOTOS", label: "Photos & Media", types: ["TOOL_PHOTO", "CALIB_PHOTO", "DEFECT_PHOTO"] },
  { id: "TECHNICAL", label: "Manuals & Drawings", types: ["TOOL_MANUAL", "DRAWING"] },
  { id: "LOGISTICS", label: "DC & Logistics", types: ["DC_ATTACHMENT"] },
  { id: "OTHER", label: "Others", types: ["OTHER"] },
] as const;

export function isPhotoType(docType: string): boolean {
  return (
    docType === "TOOL_PHOTO" ||
    docType === "CALIB_PHOTO" ||
    docType === "DEFECT_PHOTO"
  );
}

export function isImageType(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType && mimeType.startsWith("image/")) return true;
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext)) {
      return true;
    }
  }
  return false;
}

export function isPdfType(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType === "application/pdf") return true;
  if (fileName?.toLowerCase().endsWith(".pdf")) return true;
  return false;
}
