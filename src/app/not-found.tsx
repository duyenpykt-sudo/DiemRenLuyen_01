import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <div>
        <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
        <p className="text-muted-foreground">
          Trang bạn truy cập không tồn tại hoặc đã bị di chuyển.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Về trang chủ</Link>
      </Button>
    </main>
  );
}
