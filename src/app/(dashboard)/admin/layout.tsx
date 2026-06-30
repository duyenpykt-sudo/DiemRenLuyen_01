import { AdminNav } from "@/components/admin/admin-nav";

// Layout khu vực quản lý danh mục (Admin). Middleware đã chặn role khác ADMIN.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Quản lý danh mục
        </h1>
        <p className="text-muted-foreground">
          Khoa, Khóa học, Năm học, Lớp, Sinh viên và Người dùng.
        </p>
      </div>
      <AdminNav />
      <div className="pt-2">{children}</div>
    </div>
  );
}
