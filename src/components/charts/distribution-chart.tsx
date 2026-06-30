"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CLASSIFICATION_LABEL } from "@/lib/classification";
import { CLASS_ORDER } from "@/lib/stats";
import type { Classification } from "@/lib/enums";
import { CLASS_COLORS } from "@/components/charts/palette";

/** Biểu đồ phân bố xếp loại (cột hoặc tròn) — dùng ở dashboard. */
export function DistributionChart({
  counts,
  variant = "bar",
  height = 280,
}: {
  counts: Record<Classification, number>;
  variant?: "bar" | "pie";
  height?: number;
}) {
  const data = CLASS_ORDER.map((c) => ({
    key: c,
    name: CLASSIFICATION_LABEL[c],
    value: counts[c],
  })).filter((d) => variant === "bar" || d.value > 0);

  if (data.every((d) => d.value === 0)) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu điểm.
      </p>
    );
  }

  if (variant === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
            {data.map((d) => (
              <Cell key={d.key} fill={CLASS_COLORS[d.key]} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={56} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Bar dataKey="value" name="Số lượng">
          {data.map((d) => (
            <Cell key={d.key} fill={CLASS_COLORS[d.key]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
