// Copy các tài sản tĩnh vào bản build standalone.
// Next.js với output:"standalone" KHÔNG tự copy `public/` và `.next/static`,
// nên cần bước này để `node .next/standalone/server.js` phục vụ đầy đủ CSS/JS/ảnh.
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standaloneDir = resolve(root, ".next/standalone");

if (!existsSync(standaloneDir)) {
  console.error(
    "✗ Không tìm thấy .next/standalone. Hãy chạy `next build` trước (output phải là 'standalone')."
  );
  process.exit(1);
}

// .next/static → .next/standalone/.next/static
const staticSrc = resolve(root, ".next/static");
if (existsSync(staticSrc)) {
  cpSync(staticSrc, resolve(standaloneDir, ".next/static"), { recursive: true });
  console.log("✓ Đã copy .next/static");
}

// public → .next/standalone/public
const publicSrc = resolve(root, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, resolve(standaloneDir, "public"), { recursive: true });
  console.log("✓ Đã copy public/");
}

console.log("✓ Bản standalone đã sẵn sàng: node .next/standalone/server.js");
