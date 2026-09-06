import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("users");

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toEnglishDigits(value: string): string {
  return value
    .split("")
    .map((ch) => {
      const p = PERSIAN_DIGITS.indexOf(ch);
      if (p > -1) return String(p);
      const a = ARABIC_DIGITS.indexOf(ch);
      if (a > -1) return String(a);
      return ch;
    })
    .join("");
}

const router = Router();

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { roles: { include: { role: true } }, actions: { include: { action: true } }, party: true },
    orderBy: { code: "asc" },
  });
  res.json(users.map((u: any) => { const { passwordHash, ...rest } = u; return rest; }));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  // eslint-disable-next-line prefer-const
  let { code, mobile, firstName, lastName, isActive, password, roleIds, actionIds, partyId } = req.body as {
    code?: number;
    mobile: string;
    firstName: string;
    lastName: string;
    isActive?: boolean;
    password: string;
    roleIds?: number[];
    actionIds?: number[];
    partyId?: number | null;
  };

  mobile = toEnglishDigits(mobile || "");

  if (!mobile || !/^\d{11}$/.test(mobile)) {
    return res.status(400).json({ error: "شماره همراه باید ۱۱ رقم باشد" });
  }
  if (!firstName) return res.status(400).json({ error: "نام الزامی است" });
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" });
  }

  const dupMobile = await prisma.user.findUnique({ where: { mobile } });
  if (dupMobile) return res.status(400).json({ error: "شماره همراه تکراری است" });

  const finalCode = code ?? (await nextSerialNumber(prisma.user, "code"));
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      code: finalCode,
      mobile,
      firstName,
      lastName: lastName ?? "",
      isActive: isActive ?? true,
      passwordHash,
      partyId: partyId || null,
      roles: roleIds ? { create: roleIds.map((roleId) => ({ roleId })) } : undefined,
      actions: actionIds ? { create: actionIds.map((actionId) => ({ actionId })) } : undefined,
    },
    include: { roles: { include: { role: true } }, actions: { include: { action: true } }, party: true },
  });

  const { passwordHash: _, ...safe } = user;
  res.status(201).json(safe);
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { firstName, lastName, isActive, password, roleIds, actionIds, partyId } = req.body as {
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    partyId?: number | null;
    password?: string;
    roleIds?: number[];
    actionIds?: number[];
  };

  const data: any = { firstName, lastName, isActive, partyId: partyId === undefined ? undefined : partyId || null };
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" });
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data }),
    prisma.userRole.deleteMany({ where: { userId: id } }),
    ...(roleIds && roleIds.length
      ? [prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) })]
      : []),
    prisma.userAction.deleteMany({ where: { userId: id } }),
    ...(actionIds && actionIds.length
      ? [prisma.userAction.createMany({ data: actionIds.map((actionId) => ({ userId: id, actionId })) })]
      : []),
  ]);

  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } }, actions: { include: { action: true } }, party: true },
  });
  if (!user) return res.status(404).json({ error: "کاربر یافت نشد" });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "کاربر یافت نشد" });
  if (user.hasTransactions) {
    return res.status(400).json({ error: "این کاربر گردش دارد و قابل حذف نیست" });
  }
  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این کاربر در اسناد سیستم استفاده شده (مثلاً بررسی‌کننده یا تاییدکننده) و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف کاربر" });
  }
});

export default router;
