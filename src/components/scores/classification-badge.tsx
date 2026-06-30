import { cn } from "@/lib/utils";
import { CLASSIFICATION_LABEL } from "@/lib/classification";
import type { Classification } from "@/lib/enums";

// Màu cho từng mức xếp loại.
const STYLE: Record<Classification, string> = {
  XUAT_SAC: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  TOT: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  KHA: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  TRUNG_BINH: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  YEU: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  KEM: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  KHONG_XEP_LOAI: "bg-muted text-muted-foreground",
};

export function ClassificationBadge({
  classification,
  className,
}: {
  classification: Classification;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLE[classification],
        className
      )}
    >
      {CLASSIFICATION_LABEL[classification]}
    </span>
  );
}
