// Shared fetch wrapper for all frontend API calls

export interface ApiError {
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
}

/** Normalize string | Zod flatten | unknown into a readable banner message. */
function formatApiError(error: unknown, fieldErrors?: Record<string, string[]>): string {
  if (typeof error === "string" && error.trim()) return error;

  if (error && typeof error === "object") {
    const obj = error as {
      message?: unknown;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;

    const fields = fieldErrors ?? obj.fieldErrors;
    const parts: string[] = [];
    if (obj.formErrors?.length) parts.push(...obj.formErrors.filter(Boolean));
    if (fields) {
      for (const [key, msgs] of Object.entries(fields)) {
        if (msgs?.length) parts.push(`${key}: ${msgs.join(", ")}`);
      }
    }
    if (parts.length) return parts.join("; ");
  }
  return "Request failed";
}

export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const rawError = body.error ?? body.message ?? body;
      return {
        data: null,
        error: {
          message: formatApiError(rawError, body.error?.fieldErrors),
          fieldErrors: body.error?.fieldErrors,
        },
        status: res.status,
      };
    }
    const data = await res.json();
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}

export async function apiPost<T>(
  url: string,
  body: unknown
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: formatApiError(data.error, data.error?.fieldErrors),
          fieldErrors: data.error?.fieldErrors,
        },
        status: res.status,
      };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}

export async function apiPut<T>(
  url: string,
  body: unknown
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: formatApiError(data.error, data.error?.fieldErrors),
          fieldErrors: data.error?.fieldErrors,
        },
        status: res.status,
      };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}

export async function apiPatch<T>(
  url: string,
  body: unknown
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: formatApiError(data.error, data.error?.fieldErrors),
          fieldErrors: data.error?.fieldErrors,
        },
        status: res.status,
      };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}

export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: formatApiError(data.error, data.error?.fieldErrors),
          fieldErrors: data.error?.fieldErrors,
        },
        status: res.status,
      };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}
