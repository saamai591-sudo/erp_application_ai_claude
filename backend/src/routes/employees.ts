import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { loadCurrentRecords } from "../services/employeeRecordService";

// منابع انسانی › پرسنلی › کارمندان.
// SSOT: کارمند یک «نقش» روی Party است (مثل مشتری/تامین‌کننده)؛ نام، کد ملی، نشانی، تلفن و حساب بانکی همان Party هستند و تفصیلی کارمند
// = Party.detailCode (کد دوم نداریم). تاریخ تولد و جنسیت هم روی Party نوشته می‌شود؛ بقیه‌ی مشخصات شخصی و استخدامی روی Employee.
// وضعیت‌های پایان (خاتمه/بازنشسته/ترک کار) دوره‌ی همکاری و انتصاب فعال را می‌بندند؛ بازگشت به «شاغل» = استخدام مجدد (دوره‌ی تازه).

const FORM = findFormPrefix("employees");
const router = Router();

const ENDED = ["TERMINATED", "RETIRED", "ABANDONED"] as const;
const STATUSES = ["ACTIVE", "UNPAID_LEAVE", "SICK_LEAVE", "TERMINATED", "RETIRED", "SUSPENDED", "ABANDONED"] as const;
type Status = (typeof STATUSES)[number];
const isEnded = (s: string) => (ENDED as readonly string[]).includes(s);

const MARITAL = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"];
const MILITARY = ["NOT_APPLICABLE", "COMPLETED", "EXEMPT", "SUBJECT", "IN_SERVICE"];
const RELATIONS = ["SPOUSE", "CHILD", "FATHER", "MOTHER", "SIBLING", "OTHER"];
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PHOTO_MAX_BYTES = 300 * 1024;

class HrError extends Error {}

function parseDay(v: unknown, label: string, required = true): Date | null {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HrError(`${label} الزامی است`);
    return null;
  }
  const d = new Date(`${String(v)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new HrError(`${label} نامعتبر است`);
  return d;
}
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

function partyDisplayName(p: { firstName: string | null; lastName: string | null; name: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
}

/** کد پرسنلی خودکار: بزرگ‌ترین کد عددی موجود + ۱، با همان طول (۰۰۰۰۵ → ۰۰۰۰۶) */
async function nextPersonnelCode(): Promise<string> {
  const rows = await prisma.employee.findMany({ select: { personnelCode: true } });
  let max = 0;
  let width = 1;
  for (const r of rows) {
    if (!/^\d+$/.test(r.personnelCode)) continue;
    const n = Number(r.personnelCode);
    if (n > max || (n === max && r.personnelCode.length > width)) {
      max = n;
      width = r.personnelCode.length;
    }
  }
  return String(max + 1).padStart(width, "0");
}

function decodePhoto(photo: any): { mimeType: string; data: Buffer } {
  if (!photo || typeof photo.dataBase64 !== "string" || !PHOTO_TYPES.includes(photo.mimeType)) {
    throw new HrError("عکس کارمند باید png، jpeg یا webp باشد");
  }
  const data = Buffer.from(photo.dataBase64, "base64");
  if (data.length === 0) throw new HrError("عکس کارمند خالی است");
  if (data.length > PHOTO_MAX_BYTES) throw new HrError("حجم عکس کارمند بیش از ۳۰۰ کیلوبایت است");
  return { mimeType: photo.mimeType, data };
}

async function checkRefs(b: {
  birthPlaceId?: number | null;
  issuePlaceId?: number | null;
  employmentTypeId?: number | null;
  educationLevelId?: number | null;
  maritalStatus?: string | null;
  militaryStatus?: string | null;
}) {
  if (b.employmentTypeId && !(await prisma.employmentType.findUnique({ where: { id: b.employmentTypeId } }))) {
    throw new HrError("نوع همکاری یافت نشد");
  }
  if (b.educationLevelId && !(await prisma.educationLevel.findUnique({ where: { id: b.educationLevelId } }))) {
    throw new HrError("مدرک تحصیلی یافت نشد");
  }
  for (const [id, label] of [[b.birthPlaceId, "محل تولد"], [b.issuePlaceId, "محل صدور"]] as const) {
    if (!id) continue;
    const g = await prisma.geoRegion.findUnique({ where: { id: Number(id) } });
    if (!g) throw new HrError(`${label} یافت نشد`);
    if (g.level !== "CITY") throw new HrError(`${label} باید یک شهر (آخرین سطح مناطق جغرافیایی) باشد`);
  }
  if (b.maritalStatus && !MARITAL.includes(b.maritalStatus)) throw new HrError("وضعیت تاهل نامعتبر است");
  if (b.militaryStatus && !MILITARY.includes(b.militaryStatus)) throw new HrError("وضعیت نظام وظیفه نامعتبر است");
}

/** واحد سازمانیِ انتصاب = واحد خودِ پست؛ فقط اگر پست واحد نداشت (مثل پست پیش‌فرض) از کاربر گرفته می‌شود. نتیجه را در a.orgUnitId می‌نویسد */
async function checkAssignmentRefs(a: { positionId?: number; orgUnitId?: number; costCenterId?: number | null }) {
  if (!a.positionId) throw new HrError("پست الزامی است");
  const pos = await prisma.position.findUnique({ where: { id: Number(a.positionId) } });
  if (!pos) throw new HrError("پست یافت نشد");
  if (!pos.isActive) throw new HrError("پست انتخاب‌شده غیرفعال است");
  if (pos.orgUnitId) a.orgUnitId = pos.orgUnitId;
  if (!a.orgUnitId) throw new HrError("این پست واحد سازمانی ندارد؛ واحد سازمانی را انتخاب کنید");
  if (!(await prisma.orgUnit.findUnique({ where: { id: Number(a.orgUnitId) } }))) throw new HrError("واحد سازمانی یافت نشد");
  if (a.costCenterId && !(await prisma.costCenter.findUnique({ where: { id: a.costCenterId } }))) {
    throw new HrError("مرکز هزینه یافت نشد");
  }
}

function fail(res: any, e: any, fallback: string) {
  if (e instanceof HrError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "کد پرسنلی تکراری است" });
  return res.status(400).json({ error: e?.message || fallback });
}

const assignmentSelect = {
  id: true,
  positionId: true,
  orgUnitId: true,
  costCenterId: true,
  fromDate: true,
  toDate: true,
  position: { select: { id: true, code: true, title: true } },
  orgUnit: { select: { id: true, code: true, title: true } },
  costCenter: { select: { id: true, detailCode: true, title: true } },
} as const;

function shapeAssignment(a: any) {
  return { ...a, fromDate: day(a.fromDate), toDate: day(a.toDate) };
}

// ── فهرست ──
router.get("/employees", async (_req, res) => {
  const rows = await prisma.employee.findMany({
    include: {
      party: { select: { id: true, detailCode: true, firstName: true, lastName: true, name: true, nationalId: true } },
      employmentType: { select: { id: true, title: true } },
      assignments: { where: { toDate: null }, select: assignmentSelect, take: 1 },
      photo: { select: { employeeId: true } },
    },
    orderBy: { personnelCode: "asc" },
  });
  res.json(
    rows.map((e) => {
      const cur = e.assignments[0];
      return {
        id: e.id,
        personnelCode: e.personnelCode,
        status: e.status,
        partyId: e.partyId,
        detailCode: e.party.detailCode,
        fullName: partyDisplayName(e.party),
        nationalId: e.party.nationalId,
        employmentTypeTitle: e.employmentType?.title ?? null,
        positionTitle: cur?.position.title ?? null,
        orgUnitTitle: cur?.orgUnit.title ?? null,
        costCenterTitle: cur?.costCenter?.title ?? null,
        hasPhoto: !!e.photo,
      };
    })
  );
});

// اشخاص حقیقیِ فعالی که هنوز کارمند نیستند (برای انتخابگر «شخص»)
router.get("/employees/available-parties", async (_req, res) => {
  const parties = await prisma.party.findMany({
    where: { category: "INDIVIDUAL", isActive: true, employee: null },
    select: { id: true, detailCode: true, firstName: true, lastName: true, nationalId: true, birthDate: true, gender: true },
    orderBy: { detailCode: "asc" },
  });
  res.json(
    parties.map((p) => ({
      id: p.id,
      detailCode: p.detailCode,
      fullName: partyDisplayName({ firstName: p.firstName, lastName: p.lastName, name: null }),
      nationalId: p.nationalId,
      birthDate: day(p.birthDate),
      gender: p.gender,
    }))
  );
});

// کد پرسنلی پیشنهادی برای فرم جدید
router.get("/employees/next-code", async (_req, res) => {
  res.json({ code: await nextPersonnelCode() });
});

// ── جزئیات ──
router.get("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const e = await prisma.employee.findUnique({
    where: { id },
    include: {
      party: {
        select: {
          id: true, detailCode: true, firstName: true, lastName: true, name: true, nationalId: true, birthDate: true, gender: true,
          bankAccounts: { select: { id: true, bankPartyId: true, accountNumber: true, iban: true, cardNumber: true } },
        },
      },
      photo: true,
      birthPlace: { select: { id: true, title: true } },
      issuePlace: { select: { id: true, title: true } },
      periods: { orderBy: { startDate: "asc" }, include: { terminationReason: { select: { id: true, title: true } } } },
      assignments: { orderBy: [{ fromDate: "asc" }, { id: "asc" }], select: assignmentSelect },
      dependents: { orderBy: { id: "asc" } },
    },
  });
  if (!e) return res.status(404).json({ error: "کارمند یافت نشد" });
  const { photo, party, periods, assignments, dependents, ...rest } = e;
  res.json({
    ...rest,
    current: await loadCurrentRecords(id),
    party: { ...party, fullName: partyDisplayName(party), birthDate: day(party.birthDate) },
    photo: photo ? `data:${photo.mimeType};base64,${Buffer.from(photo.data).toString("base64")}` : null,
    periods: periods.map((p) => ({ ...p, startDate: day(p.startDate), endDate: day(p.endDate) })),
    assignments: assignments.map(shapeAssignment),
    currentAssignment: assignments.find((a) => !a.toDate) ? shapeAssignment(assignments.find((a) => !a.toDate)) : null,
    dependents: dependents.map((d) => ({ ...d, birthDate: day(d.birthDate) })),
  });
});

// ── ایجاد ──
router.post("/employees", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const partyId = Number(b.partyId);
    const party = partyId ? await prisma.party.findUnique({ where: { id: partyId }, include: { employee: true } }) : null;
    if (!party) throw new HrError("شخص انتخاب‌شده یافت نشد");
    if (party.category !== "INDIVIDUAL") throw new HrError("فقط شخص حقیقی می‌تواند کارمند باشد");
    if (!party.isActive) throw new HrError("شخص انتخاب‌شده غیرفعال است");
    if (party.employee) throw new HrError("این شخص قبلاً به‌عنوان کارمند ثبت شده است");

    const startDate = parseDay(b.startDate, "تاریخ شروع همکاری")!;
    await checkRefs(b);
    await checkAssignmentRefs(b);
    const photo = decodePhoto(b.photo);
    // مقدار اولیه‌ی تحصیلات، تاهل و ایثارگری اجباری است؛ سرور اولین سابقه‌ی هر کدام را با تاریخ شروع همکاری می‌سازد
    if (!b.educationLevelId) throw new HrError("مدرک تحصیلی الزامی است");
    if (!b.maritalStatus) throw new HrError("وضعیت تاهل الزامی است");
    if (typeof b.isVeteran !== "boolean") throw new HrError("وضعیت ایثارگری الزامی است");
    if (b.salaryBankAccountId) {
      const acc = await prisma.partyBankAccount.findUnique({ where: { id: Number(b.salaryBankAccountId) } });
      if (!acc || acc.partyId !== partyId) throw new HrError("حساب دریافت حقوق باید از حساب‌های بانکی همین شخص باشد");
    }

    let personnelCode = str(b.personnelCode);
    if (personnelCode && (await prisma.employee.findUnique({ where: { personnelCode } }))) {
      throw new HrError("کد پرسنلی تکراری است");
    }

    // کد خودکار با رقابت هم‌زمان: تکرار محدود روی تداخل یکتایی
    for (let attempt = 0; ; attempt++) {
      const code = personnelCode ?? (await nextPersonnelCode());
      try {
        const created = await prisma.$transaction(async (tx) => {
          const emp = await tx.employee.create({
            data: {
              personnelCode: code,
              partyId,
              status: "ACTIVE",
              employmentTypeId: b.employmentTypeId || null,
              fatherName: str(b.fatherName),
              birthCertificateNumber: str(b.birthCertificateNumber),
              birthPlaceId: b.birthPlaceId ? Number(b.birthPlaceId) : null,
              issuePlaceId: b.issuePlaceId ? Number(b.issuePlaceId) : null,
              militaryStatus: b.militaryStatus || null,
              insuranceNumber: str(b.insuranceNumber),
              hasDisability: !!b.hasDisability,
              notes: str(b.notes),
              salaryBankAccountId: b.salaryBankAccountId ? Number(b.salaryBankAccountId) : null,
            },
          });
          await tx.employeePhoto.create({ data: { employeeId: emp.id, ...photo } });
          await tx.employmentPeriod.create({ data: { employeeId: emp.id, startDate } });
          await tx.employeeEducationRecord.create({
            data: { employeeId: emp.id, effectiveDate: startDate, educationLevelId: Number(b.educationLevelId), field: str(b.educationField) },
          });
          await tx.employeeMaritalRecord.create({ data: { employeeId: emp.id, effectiveDate: startDate, maritalStatus: b.maritalStatus } });
          await tx.employeeVeteranRecord.create({ data: { employeeId: emp.id, effectiveDate: startDate, isVeteran: b.isVeteran } });
          await tx.employeeAssignment.create({
            data: {
              employeeId: emp.id,
              positionId: Number(b.positionId),
              orgUnitId: Number(b.orgUnitId),
              costCenterId: b.costCenterId || null,
              fromDate: startDate,
            },
          });
          await tx.position.update({ where: { id: Number(b.positionId) }, data: { hasTransactions: true } });
          if (b.employmentTypeId) await tx.employmentType.update({ where: { id: b.employmentTypeId }, data: { hasTransactions: true } });
          await tx.educationLevel.update({ where: { id: Number(b.educationLevelId) }, data: { hasTransactions: true } });
          return emp;
        });
        return res.status(201).json({ id: created.id, personnelCode: created.personnelCode });
      } catch (e: any) {
        if (e?.code === "P2002" && !personnelCode && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e: any) {
    fail(res, e, "خطا در ثبت کارمند");
  }
});

// ── ویرایش مشخصات (انتصاب و وضعیت از مسیرهای جدا) ──
router.put("/employees/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const emp = await prisma.employee.findUnique({ where: { id }, include: { party: true } });
    if (!emp) return res.status(404).json({ error: "کارمند یافت نشد" });
    assertRecordNotStale(emp.updatedAt, b.updatedAt, "این کارمند");
    await checkRefs(b);

    const code = b.personnelCode === undefined ? undefined : str(b.personnelCode);
    if (code === null) throw new HrError("کد پرسنلی الزامی است");
    if (code !== undefined && code !== emp.personnelCode) {
      if (await prisma.employee.findUnique({ where: { personnelCode: code } })) throw new HrError("کد پرسنلی تکراری است");
    }
    let photo: { mimeType: string; data: Buffer } | undefined;
    if (b.photo !== undefined && b.photo !== null) photo = decodePhoto(b.photo);
    if (b.salaryBankAccountId) {
      const acc = await prisma.partyBankAccount.findUnique({ where: { id: Number(b.salaryBankAccountId) } });
      if (!acc || acc.partyId !== emp.partyId) throw new HrError("حساب دریافت حقوق باید از حساب‌های بانکی همین شخص باشد");
    }

    const has = (k: string) => b[k] !== undefined;
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          personnelCode: code,
          employmentTypeId: has("employmentTypeId") ? b.employmentTypeId || null : undefined,
          fatherName: has("fatherName") ? str(b.fatherName) : undefined,
          birthCertificateNumber: has("birthCertificateNumber") ? str(b.birthCertificateNumber) : undefined,
          birthPlaceId: has("birthPlaceId") ? (b.birthPlaceId ? Number(b.birthPlaceId) : null) : undefined,
          issuePlaceId: has("issuePlaceId") ? (b.issuePlaceId ? Number(b.issuePlaceId) : null) : undefined,
          militaryStatus: has("militaryStatus") ? b.militaryStatus || null : undefined,
          insuranceNumber: has("insuranceNumber") ? str(b.insuranceNumber) : undefined,
          hasDisability: has("hasDisability") ? !!b.hasDisability : undefined,
          notes: has("notes") ? str(b.notes) : undefined,
          salaryBankAccountId: has("salaryBankAccountId") ? (b.salaryBankAccountId ? Number(b.salaryBankAccountId) : null) : undefined,
        },
      });
      if (photo) {
        await tx.employeePhoto.upsert({
          where: { employeeId: id },
          create: { employeeId: id, ...photo },
          update: photo,
        });
      }
      if (b.employmentTypeId) await tx.employmentType.update({ where: { id: b.employmentTypeId }, data: { hasTransactions: true } });
    });
    res.json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در ویرایش کارمند");
  }
});

// ── انتصاب جدید (بستن انتصاب فعال + ردیف تازه) ──
router.post("/employees/:id/assignments", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: "کارمند یافت نشد" });
    if (isEnded(emp.status)) throw new HrError("همکاری این کارمند پایان یافته است؛ ابتدا او را مجدداً شاغل کنید");
    const fromDate = parseDay(b.fromDate, "تاریخ شروع انتصاب")!;
    await checkAssignmentRefs(b);
    const open = await prisma.employeeAssignment.findFirst({ where: { employeeId: id, toDate: null } });
    await prisma.$transaction(async (tx) => {
      if (open) {
        if (fromDate <= open.fromDate) throw new HrError("تاریخ انتصاب جدید باید بعد از شروع انتصاب فعلی باشد");
        const prev = new Date(fromDate.getTime() - 86400000);
        await tx.employeeAssignment.update({ where: { id: open.id }, data: { toDate: prev } });
      }
      await tx.employeeAssignment.create({
        data: {
          employeeId: id,
          positionId: Number(b.positionId),
          orgUnitId: Number(b.orgUnitId),
          costCenterId: b.costCenterId || null,
          fromDate,
        },
      });
      await tx.position.update({ where: { id: Number(b.positionId) }, data: { hasTransactions: true } });
    });
    res.status(201).json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در ثبت انتصاب");
  }
});

// ── تغییر وضعیت همکاری ──
// ACTIVE/مرخصی/تعلیق ⇄ بین خودشان: فقط وضعیت. به پایان (خاتمه/بازنشسته/ترک کار): بستن دوره و انتصاب فعال.
// از پایان به شاغل: دوره‌ی تازه + انتصاب تازه (استخدام مجدد؛ کد پرسنلی و سوابق همان می‌ماند).
router.post("/employees/:id/status", can(`${FORM}.changeStatus`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: "کارمند یافت نشد" });
    const target = b.status as Status;
    if (!STATUSES.includes(target)) throw new HrError("وضعیت نامعتبر است");
    if (target === emp.status) throw new HrError("کارمند هم‌اکنون در همین وضعیت است");
    const date = parseDay(b.date, "تاریخ")!;
    const wasEnded = isEnded(emp.status);

    if (wasEnded && target !== "ACTIVE") {
      throw new HrError("همکاری این کارمند پایان یافته است؛ برای هر تغییر ابتدا باید مجدداً «شاغل» شود");
    }

    await prisma.$transaction(async (tx) => {
      const openPeriod = await tx.employmentPeriod.findFirst({ where: { employeeId: id, endDate: null } });
      if (isEnded(target)) {
        if (!openPeriod) throw new HrError("دوره‌ی همکاری باز یافت نشد");
        if (date < openPeriod.startDate) throw new HrError("تاریخ نباید قبل از شروع همکاری باشد");
        let reasonId: number | null = null;
        if (b.terminationReasonId) {
          if (!(await tx.terminationReason.findUnique({ where: { id: Number(b.terminationReasonId) } }))) {
            throw new HrError("دلیل خاتمه همکاری یافت نشد");
          }
          reasonId = Number(b.terminationReasonId);
          await tx.terminationReason.update({ where: { id: reasonId }, data: { hasTransactions: true } });
        } else if (target === "TERMINATED") {
          throw new HrError("دلیل خاتمه همکاری الزامی است");
        }
        await tx.employmentPeriod.update({
          where: { id: openPeriod.id },
          data: { endDate: date, terminationReasonId: reasonId, note: str(b.note) },
        });
        const open = await tx.employeeAssignment.findFirst({ where: { employeeId: id, toDate: null } });
        if (open) {
          // انتصابی که در همان روز شروع شده بود، تاریخ پایان قبل از شروع پیدا نکند
          await tx.employeeAssignment.update({ where: { id: open.id }, data: { toDate: date < open.fromDate ? open.fromDate : date } });
        }
      } else if (wasEnded) {
        // استخدام مجدد: دوره‌ی تازه + انتصاب تازه
        const last = await tx.employmentPeriod.findFirst({ where: { employeeId: id }, orderBy: { startDate: "desc" } });
        if (last?.endDate && date <= last.endDate) throw new HrError("تاریخ استخدام مجدد باید بعد از پایان همکاری قبلی باشد");
        await checkAssignmentRefs(b);
        await tx.employmentPeriod.create({ data: { employeeId: id, startDate: date, note: str(b.note) } });
        await tx.employeeAssignment.create({
          data: {
            employeeId: id,
            positionId: Number(b.positionId),
            orgUnitId: Number(b.orgUnitId),
            costCenterId: b.costCenterId || null,
            fromDate: date,
          },
        });
        await tx.position.update({ where: { id: Number(b.positionId) }, data: { hasTransactions: true } });
      }
      await tx.employee.update({ where: { id }, data: { status: target } });
    });
    res.json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در تغییر وضعیت");
  }
});

// ── وابستگان ──
function dependentData(b: any) {
  const firstName = str(b.firstName);
  const lastName = str(b.lastName);
  if (!firstName || !lastName) throw new HrError("نام و نام خانوادگی وابسته الزامی است");
  if (!RELATIONS.includes(b.relation)) throw new HrError("نسبت نامعتبر است");
  if (b.gender && b.gender !== "MALE" && b.gender !== "FEMALE") throw new HrError("جنسیت نامعتبر است");
  return {
    relation: b.relation,
    firstName,
    lastName,
    nationalId: str(b.nationalId),
    birthDate: parseDay(b.birthDate, "تاریخ تولد وابسته", false),
    gender: b.gender || null,
    eligibleForChildAllowance: b.relation === "CHILD" && !!b.eligibleForChildAllowance,
    isStudent: !!b.isStudent,
    hasDisability: !!b.hasDisability,
    note: str(b.note),
  };
}

router.post("/employees/:id/dependents", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (!(await prisma.employee.findUnique({ where: { id } }))) return res.status(404).json({ error: "کارمند یافت نشد" });
    const created = await prisma.employeeDependent.create({ data: { employeeId: id, ...dependentData(req.body) } });
    res.status(201).json({ id: created.id });
  } catch (e: any) {
    fail(res, e, "خطا در ثبت وابسته");
  }
});

router.put("/employees/:id/dependents/:depId", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const depId = Number(req.params.depId);
  try {
    const dep = await prisma.employeeDependent.findUnique({ where: { id: depId } });
    if (!dep || dep.employeeId !== id) return res.status(404).json({ error: "وابسته یافت نشد" });
    await prisma.employeeDependent.update({ where: { id: depId }, data: dependentData(req.body) });
    res.json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در ویرایش وابسته");
  }
});

router.delete("/employees/:id/dependents/:depId", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const depId = Number(req.params.depId);
  const dep = await prisma.employeeDependent.findUnique({ where: { id: depId } });
  if (!dep || dep.employeeId !== id) return res.status(404).json({ error: "وابسته یافت نشد" });
  await prisma.employeeDependent.delete({ where: { id: depId } });
  res.status(204).send();
});

// ── حذف ──
router.delete("/employees/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return res.status(404).json({ error: "کارمند یافت نشد" });
  if (emp.hasTransactions) return res.status(400).json({ error: "این کارمند گردش دارد و قابل حذف نیست" });
  try {
    // شخص (Party) و تفصیلی‌اش دست‌نخورده می‌ماند؛ فقط نقش کارمند و سوابق پرسنلی پاک می‌شود
    await prisma.employee.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این کارمند در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف کارمند" });
  }
});

export default router;
