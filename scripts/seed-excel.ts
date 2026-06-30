/**
 * CLI seed dữ liệu cũ từ file Excel của trường vào hệ thống (mục 5.6 PRD).
 *
 *   npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls
 *
 * Hành vi:
 * - Đọc sheet KHÓA HỌC (chứa đủ điểm 8 học kỳ I–VIII của mỗi SV).
 * - Tạo/cập nhật Khoa, Khóa học, Lớp, Năm học, Học kỳ, Sinh viên, Điểm.
 * - Idempotent: chạy lại không tạo trùng (upsert theo khóa unique).
 * - In log số bản ghi created / updated / skipped.
 * - Ghi 1 audit log SEED_EXCEL (user hệ thống "system_seed").
 *
 * Lưu ý: xếp loại LUÔN tính lại server-side bằng classifyScore (không tin cột
 * "Xếp loại" trong file Excel).
 */
import path from "node:path";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { classifyScore } from "../src/lib/classification";
import type { StudentStatus } from "../src/lib/enums";

const prisma = new PrismaClient();

// ───────────────────────── Tham số dòng lệnh ─────────────────────────
function getFileArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--file="));
  const file = arg ? arg.slice("--file=".length) : "./sample/DC22CTT01-II-25-26.xls";
  return path.resolve(process.cwd(), file);
}

type Row = string[];
function sheetRows(ws: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: false, defval: "" });
}

function cleanCell(v: unknown): string {
  return String(v ?? "").trim();
}

async function main() {
  const filePath = getFileArg();
  console.log(`📖 Đọc file: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  const sheet = wb.Sheets["KHÓA HỌC"];
  if (!sheet) {
    throw new Error('Không tìm thấy sheet "KHÓA HỌC" trong file.');
  }
  const rows = sheetRows(sheet);

  // Header cố định ở dòng 1-based = 7 (index 6); dữ liệu từ index 7.
  const facultyName = cleanCell(rows[0]?.[0]) || "KHOA KHTN và CNTT";
  const classCode = cleanCell(rows[1]?.[0]).replace(/^LỚP\s*/i, "").trim();
  const cohortText = cleanCell(rows[4]?.[3]); // "Khóa học: 2022-2026"
  const cohortMatch = cohortText.match(/(\d{4})\s*-\s*(\d{4})/);
  if (!classCode) throw new Error("Không đọc được mã lớp (dòng 2).");
  if (!cohortMatch) throw new Error("Không đọc được khóa học (dòng 5).");

  const startYear = Number(cohortMatch[1]);
  const endYear = Number(cohortMatch[2]);
  const cohortName = `K${String(startYear).slice(2)}`; // 2022 → K22

  const counts = {
    studentsCreated: 0,
    studentsUpdated: 0,
    scoresCreated: 0,
    scoresUpdated: 0,
    scoresSkipped: 0,
  };

  // ───────── 1. Người dùng hệ thống (để gắn audit log) ─────────
  const systemUser = await prisma.user.upsert({
    where: { username: "system_seed" },
    update: {},
    create: {
      username: "system_seed",
      passwordHash: await bcrypt.hash(`seed-${Date.now()}`, 10),
      fullName: "Hệ thống (seed dữ liệu)",
      role: "ADMIN",
      isActive: false,
    },
  });

  // ───────── 2. Khoa ─────────
  let faculty = await prisma.faculty.findFirst({ where: { name: facultyName } });
  if (!faculty) {
    faculty = await prisma.faculty.create({
      data: { code: "KHTN_CNTT", name: facultyName },
    });
  }

  // ───────── 3. Khóa học ─────────
  const cohort = await prisma.cohort.upsert({
    where: { name: cohortName },
    update: { startYear, endYear },
    create: { name: cohortName, startYear, endYear },
  });

  // ───────── 4. Năm học + Học kỳ (4 năm × 2 HK = 8 học kỳ) ─────────
  // Tên năm học: 2022-2023, 2023-2024, 2024-2025, 2025-2026.
  const semesterIds: string[] = []; // theo thứ tự HK I..VIII
  for (let y = startYear; y < endYear; y++) {
    const yearName = `${y}-${y + 1}`;
    const year = await prisma.academicYear.upsert({
      where: { name: yearName },
      update: {},
      create: { name: yearName, startYear: y, endYear: y + 1 },
    });
    for (const number of [1, 2]) {
      const sem = await prisma.semester.upsert({
        where: {
          academicYearId_number: { academicYearId: year.id, number },
        },
        update: {},
        create: {
          academicYearId: year.id,
          number,
          name: `Học kỳ ${number}`,
        },
      });
      semesterIds.push(sem.id);
    }
  }

  // ───────── 5. Lớp (giữ nguyên CVHT nếu lớp đã tồn tại) ─────────
  let klass = await prisma.class.findUnique({ where: { code: classCode } });
  if (!klass) {
    const advisor =
      (await prisma.user.findFirst({ where: { role: "CVHT" } })) ??
      (await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true } }));
    if (!advisor) {
      throw new Error(
        "Chưa có CVHT/Admin để gán làm cố vấn lớp. Hãy chạy `npm run db:seed` trước."
      );
    }
    klass = await prisma.class.create({
      data: {
        code: classCode,
        name: classCode,
        facultyId: faculty.id,
        cohortId: cohort.id,
        advisorId: advisor.id,
      },
    });
  }

  // ───────── 6. Sinh viên + điểm 8 HK ─────────
  for (let i = 7; i < rows.length; i++) {
    const row = rows[i];
    const studentCode = cleanCell(row[2]);
    const fullName = cleanCell(row[3]);
    // Dừng khi hết dữ liệu hoặc gặp dòng thống kê.
    if (!studentCode || /THỐNG KÊ/i.test(studentCode) || !fullName) break;

    const citizenId = cleanCell(row[1]);

    const existing = await prisma.student.findUnique({
      where: { studentCode },
    });
    const student = await prisma.student.upsert({
      where: { studentCode },
      update: { citizenId, fullName, classId: klass.id },
      create: {
        studentCode,
        citizenId,
        fullName,
        classId: klass.id,
        status: "ACTIVE",
      },
    });
    if (existing) counts.studentsUpdated++;
    else counts.studentsCreated++;

    // 8 cột điểm: index 4..11 → HK I..VIII.
    for (let k = 0; k < 8; k++) {
      const raw = cleanCell(row[4 + k]);
      const score = Number(raw);
      if (raw === "" || Number.isNaN(score)) {
        counts.scoresSkipped++;
        continue;
      }
      const semesterId = semesterIds[k];
      const classification = classifyScore(
        score,
        student.status as StudentStatus
      );

      const existingScore = await prisma.conductScore.findUnique({
        where: {
          studentId_semesterId: { studentId: student.id, semesterId },
        },
      });
      await prisma.conductScore.upsert({
        where: {
          studentId_semesterId: { studentId: student.id, semesterId },
        },
        update: { score, classification, updatedById: "SYSTEM_SEED" },
        create: {
          studentId: student.id,
          semesterId,
          score,
          classification,
          createdById: "SYSTEM_SEED",
          updatedById: "SYSTEM_SEED",
        },
      });
      if (existingScore) counts.scoresUpdated++;
      else counts.scoresCreated++;
    }
  }

  // ───────── 7. Audit log ─────────
  await prisma.auditLog.create({
    data: {
      userId: systemUser.id,
      action: "SEED_EXCEL",
      entityType: "ConductScore",
      newValue: JSON.stringify({
        filename: path.basename(filePath),
        classCode,
        ...counts,
      }),
    },
  });

  console.log("\n✅ Seed Excel hoàn tất:");
  console.log(`   Lớp: ${classCode} | Khoa: ${facultyName} | Khóa: ${cohortName}`);
  console.log(
    `   Sinh viên — tạo: ${counts.studentsCreated}, cập nhật: ${counts.studentsUpdated}`
  );
  console.log(
    `   Điểm — tạo: ${counts.scoresCreated}, cập nhật: ${counts.scoresUpdated}, bỏ qua: ${counts.scoresSkipped}`
  );
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed Excel:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
