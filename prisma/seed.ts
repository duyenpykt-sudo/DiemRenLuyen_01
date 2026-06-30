/**
 * Seed dữ liệu khởi tạo cho hệ thống Quản lý Điểm Rèn luyện.
 *
 * Chạy: npm run db:seed  (hoặc tự động sau `prisma migrate reset`)
 *
 * Idempotent: dùng upsert theo khóa unique nên chạy lại nhiều lần không tạo trùng.
 * Tài khoản mặc định (mục "Tài khoản & dữ liệu seed" trong CLAUDE.md):
 *   - admin / Admin@123        (ADMIN)
 *   - hothiduyen / Cvht@123    (CVHT)
 *   - truongkhoa / Tk@123      (TRUONG_KHOA)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Băm mật khẩu bằng bcrypt 10 rounds (quy tắc bảo mật trong CLAUDE.md).
function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu...");

  // ───────────────────────── 1. Khoa ─────────────────────────
  const faculty = await prisma.faculty.upsert({
    where: { code: "KHTN_CNTT" },
    update: { name: "KHOA KHTN và CNTT" },
    create: { code: "KHTN_CNTT", name: "KHOA KHTN và CNTT" },
  });
  console.log(`  ✔ Khoa: ${faculty.name}`);

  // ───────────────────────── 2. Khóa học (Cohort) ─────────────────────────
  const cohort = await prisma.cohort.upsert({
    where: { name: "K22" },
    update: { startYear: 2022, endYear: 2026 },
    create: { name: "K22", startYear: 2022, endYear: 2026 },
  });
  console.log(`  ✔ Khóa: ${cohort.name} (${cohort.startYear}-${cohort.endYear})`);

  // ───────────────────────── 3. Năm học + Học kỳ ─────────────────────────
  // 4 năm học, mỗi năm 2 học kỳ (number 1 và 2).
  const academicYears = [
    { name: "2022-2023", startYear: 2022, endYear: 2023 },
    { name: "2023-2024", startYear: 2023, endYear: 2024 },
    { name: "2024-2025", startYear: 2024, endYear: 2025 },
    { name: "2025-2026", startYear: 2025, endYear: 2026 },
  ];

  for (const ay of academicYears) {
    const year = await prisma.academicYear.upsert({
      where: { name: ay.name },
      update: { startYear: ay.startYear, endYear: ay.endYear },
      create: ay,
    });

    for (const number of [1, 2]) {
      await prisma.semester.upsert({
        where: {
          academicYearId_number: { academicYearId: year.id, number },
        },
        update: { name: `Học kỳ ${number}` },
        create: {
          academicYearId: year.id,
          number,
          name: `Học kỳ ${number}`,
        },
      });
    }
    console.log(`  ✔ Năm học: ${year.name} (HK1, HK2)`);
  }

  // ───────────────────────── 4. Người dùng ─────────────────────────
  // 4.1. Admin
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: hashPassword("Admin@123"),
      fullName: "Quản trị viên",
      role: "ADMIN",
    },
  });
  console.log("  ✔ User: admin (ADMIN)");

  // 4.2. CVHT — Hồ Thị Duyên (thuộc khoa KHTN_CNTT)
  const cvht = await prisma.user.upsert({
    where: { username: "hothiduyen" },
    update: { fullName: "Hồ Thị Duyên", facultyId: faculty.id },
    create: {
      username: "hothiduyen",
      passwordHash: hashPassword("Cvht@123"),
      fullName: "Hồ Thị Duyên",
      role: "CVHT",
      facultyId: faculty.id,
    },
  });
  console.log("  ✔ User: hothiduyen (CVHT)");

  // 4.3. Trưởng khoa (thuộc khoa KHTN_CNTT để có quyền đọc trong khoa)
  await prisma.user.upsert({
    where: { username: "truongkhoa" },
    update: { facultyId: faculty.id },
    create: {
      username: "truongkhoa",
      passwordHash: hashPassword("Tk@123"),
      fullName: "Trưởng khoa KHTN và CNTT",
      role: "TRUONG_KHOA",
      facultyId: faculty.id,
    },
  });
  console.log("  ✔ User: truongkhoa (TRUONG_KHOA)");

  // ───────────────────────── 5. Lớp ─────────────────────────
  // Lớp DC22CTT01, khoa KHTN_CNTT, khóa K22, CVHT = Hồ Thị Duyên.
  const klass = await prisma.class.upsert({
    where: { code: "DC22CTT01" },
    update: {
      name: "DC22CTT01",
      facultyId: faculty.id,
      cohortId: cohort.id,
      advisorId: cvht.id,
    },
    create: {
      code: "DC22CTT01",
      name: "DC22CTT01",
      facultyId: faculty.id,
      cohortId: cohort.id,
      advisorId: cvht.id,
    },
  });
  console.log(`  ✔ Lớp: ${klass.code} (CVHT: ${cvht.fullName})`);

  console.log("✅ Seed hoàn tất.");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
