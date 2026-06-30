import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { createUserSchema } from "@/lib/validations/catalog";
import { userSelect } from "@/lib/entity-helpers";

// GET /api/users — danh sách người dùng.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const data = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: userSelect,
  });
  return apiOk(data);
}

// POST /api/users — tạo người dùng mới (mật khẩu hash bcrypt 10 rounds).
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const { password, email, phone, facultyId, ...rest } = parsed.data;
  try {
    const created = await prisma.user.create({
      data: {
        ...rest,
        email: email || null,
        phone: phone || null,
        facultyId: facultyId || null,
        passwordHash: await bcrypt.hash(password, 10),
      },
      select: userSelect,
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "User",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "người dùng");
  }
}
