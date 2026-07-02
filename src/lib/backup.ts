import fs from "node:fs/promises";
import path from "node:path";

// Sao lưu file chỉ chạy được khi có filesystem ghi được (local/VPS). Trên môi
// trường serverless (Vercel) filesystem chỉ đọc + tạm thời nên tính năng này TẮT.
const SERVERLESS = !!process.env.VERCEL;
const SERVERLESS_MSG =
  "Sao lưu file không khả dụng khi chạy trên đám mây (Vercel). Dùng công cụ sao lưu của nhà cung cấp DB (Supabase).";

// File SQLite nằm ở prisma/dev.db (DATABASE_URL="file:./dev.db" tương đối với prisma/).
const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const BACKUP_DIR = path.join(
  process.cwd(),
  (process.env.BACKUP_DIR ?? "./backups").replace(/^\.\//, "")
);

// Chỉ chấp nhận tên file backup đúng định dạng (tránh path traversal).
const BACKUP_RE = /^backup-\d{8}-\d{4}\.db$/;

async function ensureDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Tạo file backup từ DB hiện tại → backups/backup-YYYYMMDD-HHmm.db */
export async function createBackup(): Promise<string> {
  if (SERVERLESS) throw new Error(SERVERLESS_MSG);
  await ensureDir();
  const filename = `backup-${timestamp()}.db`;
  await fs.copyFile(DB_PATH, path.join(BACKUP_DIR, filename));
  return filename;
}

export type BackupInfo = { filename: string; size: number; createdAt: string };

/** Liệt kê các file backup (mới nhất trước). */
export async function listBackups(): Promise<BackupInfo[]> {
  if (SERVERLESS) return [];
  await ensureDir();
  const files = await fs.readdir(BACKUP_DIR);
  const infos: BackupInfo[] = [];
  for (const f of files) {
    if (!BACKUP_RE.test(f)) continue;
    const stat = await fs.stat(path.join(BACKUP_DIR, f));
    infos.push({ filename: f, size: stat.size, createdAt: stat.mtime.toISOString() });
  }
  return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Khôi phục DB từ 1 file backup (ghi đè dev.db). Cần restart server sau khi gọi. */
export async function restoreBackup(filename: string): Promise<void> {
  if (SERVERLESS) throw new Error(SERVERLESS_MSG);
  if (!BACKUP_RE.test(filename)) {
    throw new Error("Tên file backup không hợp lệ.");
  }
  const src = path.join(BACKUP_DIR, filename);
  await fs.access(src); // ném lỗi nếu không tồn tại
  // Sao lưu an toàn DB hiện tại trước khi ghi đè.
  await createBackup();
  await fs.copyFile(src, DB_PATH);
}
