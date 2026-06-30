/**
 * Helper gọi API phía client. Tự parse { data, error } và throw Error
 * (kèm thông báo tiếng Việt từ server) để TanStack Query bắt được.
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let json: { data: T; error: string | null } | null = null;
  try {
    json = await res.json();
  } catch {
    // Không parse được JSON
  }

  if (!res.ok || !json || json.error) {
    throw new Error(json?.error ?? "Đã có lỗi xảy ra. Vui lòng thử lại.");
  }
  return json.data;
}

export const http = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
