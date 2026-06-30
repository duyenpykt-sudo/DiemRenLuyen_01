import { redirect } from "next/navigation";

// /admin → mặc định mở trang Khoa.
export default function AdminIndexPage() {
  redirect("/admin/faculties");
}
