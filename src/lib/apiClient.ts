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

export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/auth/session-expired";
      return { data: null, error: { message: "Session expired" }, status: 401 };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        data: null,
        error: { message: body.error ?? "Request failed" },
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
    if (res.status === 401) {
      window.location.href = "/auth/session-expired";
      return { data: null, error: { message: "Session expired" }, status: 401 };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: data.error ?? "Request failed",
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
    if (res.status === 401) {
      window.location.href = "/auth/session-expired";
      return { data: null, error: { message: "Session expired" }, status: 401 };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: data.error ?? "Request failed" }, status: res.status };
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
    if (res.status === 401) {
      window.location.href = "/auth/session-expired";
      return { data: null, error: { message: "Session expired" }, status: 401 };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: data.error ?? "Request failed" }, status: res.status };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}

export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/auth/session-expired";
      return { data: null, error: { message: "Session expired" }, status: 401 };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: data.error ?? "Request failed" }, status: res.status };
    }
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: { message: "Network error" }, status: 0 };
  }
}
