import { redirect } from "next/navigation";

// Trang gốc: điều hướng vào dashboard (middleware lo phần đăng nhập).
export default function Home() {
  redirect("/dashboard");
}
