"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Nút tải file export theo URL (Content-Disposition: attachment). */
export function ExportLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const a = document.createElement("a");
        a.href = href;
        a.click();
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
