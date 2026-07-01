import { useQuery } from "@tanstack/react-query";

/**
 * Lấy vai trò người dùng từ session ở phía client.
 *
 * Dùng `signal` của TanStack Query để HUỶ request sạch khi component unmount
 * (React StrictMode ở dev mount 2 lần) — tránh lỗi undici
 * "The socket connection was closed unexpectedly" do fetch bị bỏ dở.
 * Cache 5 phút + không retry để không gọi lại liên tục.
 */
export function useSessionRole(): string | null {
  const { data } = useQuery({
    queryKey: ["session"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/auth/session", { signal });
      if (!res.ok) return null;
      return (await res.json()) as { user?: { role?: string } };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data?.user?.role ?? null;
}
