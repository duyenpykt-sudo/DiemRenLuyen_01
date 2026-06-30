"use client";

import { useRef } from "react";
import { ImageDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Khung biểu đồ kèm nút "Tải PNG" (html2canvas chụp vùng biểu đồ). */
export function ChartCard({
  title,
  filename = "bieu-do",
  children,
}: {
  title: string;
  filename?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  async function downloadPng() {
    if (!ref.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${filename}.png`;
      a.click();
    } catch {
      toast.error("Không tạo được ảnh PNG.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={downloadPng}>
          <ImageDown className="mr-2 h-4 w-4" />
          Tải PNG
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="bg-background p-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
