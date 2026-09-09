const base =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

let cachedDevToken: string | null = null;

export async function getDevToken(): Promise<string> {
  if (cachedDevToken) {
    return cachedDevToken;
  }
  try {
    const res = await fetch(`${base}/dev/auth/token`);
    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        cachedDevToken = data.token;
        return data.token;
      }
    }
  } catch (err) {
    // Ignore fetch failure
  }
  return "";
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public readonly code?: string,
    public readonly patientSafeMessage?: { hi?: string; en?: string },
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  let authToken = token;
  if (!authToken) {
    authToken = await getDevToken();
  }
  const headers = new Headers(init.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  headers.set("X-Correlation-Id", generateUUID());
  if (!(init.body instanceof FormData) && init.body)
    headers.set("Content-Type", "application/json");
  const r = await fetch(base + path, { ...init, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const problem =
      data?.error && typeof data.error === "object" ? data.error : data;
    throw new ApiError(
      r.status,
      problem?.message || `Request failed (${r.status})`,
      problem?.code,
      problem?.patient_safe_message,
    );
  }
  return data as T;
}

export { base };
