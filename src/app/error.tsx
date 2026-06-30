"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div>
        <h1 className="text-2xl font-semibold">Đã xảy ra lỗi</h1>
        <p className="text-muted-foreground">
          Có lỗi không mong muốn xảy ra. Vui lòng thử lại.
        </p>
      </div>
      <Button onClick={reset}>Thử lại</Button>
    </main>
  );
}
