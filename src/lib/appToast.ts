import { toast } from "sonner";

export { toast };

/** Drop-in for former SuccessOverlay `showSuccess` payloads. */
export function toastSuccess(
  input: string | { title?: string; message: string; detail?: string }
): void {
  if (typeof input === "string") {
    toast.success(input);
    return;
  }
  const description =
    input.detail?.trim() ||
    (input.title && input.title !== "Success" ? input.title : undefined);
  toast.success(input.message, description ? { description } : undefined);
}

export function toastError(message: string): void {
  toast.error(message);
}
