import { prisma } from "../lib/prisma";

/**
 * تولید کد تفصیلی خودکار طبق مستند «نوع تفصیل»:
 * - اگر رکوردی از این نوع تفصیل قبلا ثبت شده: بزرگترین کد + ۱ (به شرط عدم عبور از شماره پایان)
 * - در غیر این صورت: شماره شروع نوع تفصیل
 * - سمت چپ کد تا طول تعریف شده با صفر پر می‌شود (padStart)
 */
export async function generateDetailCode(detailTypeCode: number): Promise<{
  code: string;
  detailTypeId: number;
}> {
  const detailType = await prisma.detailType.findUnique({ where: { code: detailTypeCode } });
  if (!detailType) {
    throw new Error(`نوع تفصیل با کد ${detailTypeCode} یافت نشد`);
  }

  const last = await prisma.detailCodeUsage.findFirst({
    where: { detailTypeId: detailType.id },
    orderBy: { code: "desc" },
  });

  let nextNumber: number;
  if (last) {
    nextNumber = parseInt(last.code, 10) + 1;
  } else {
    nextNumber = detailType.startNumber;
  }

  if (nextNumber > detailType.endNumber) {
    throw new Error(
      `ظرفیت کدگذاری برای نوع تفصیل «${detailType.title}» تمام شده است (بازه ${detailType.startNumber} تا ${detailType.endNumber})`
    );
  }

  const code = String(nextNumber).padStart(detailType.codeLength, "0");
  return { code, detailTypeId: detailType.id };
}

/**
 * مثل generateDetailCode، با این تفاوت که اگر explicitCode داده شود (مثلاً از ورود اکسل)،
 * به‌جای تولید خودکار، همان کد را پس از اعتبارسنجی (طول کد و بازه‌ی مجاز نوع تفصیل) برمی‌گرداند.
 * یکتایی سراسری کد در هر دو حالت توسط registerDetailCode (که باید پس از این تابع فراخوانی شود) تضمین می‌شود.
 */
export async function resolveDetailCode(
  detailTypeCode: number,
  explicitCode?: string | null
): Promise<{ code: string; detailTypeId: number }> {
  const detailType = await prisma.detailType.findUnique({ where: { code: detailTypeCode } });
  if (!detailType) {
    throw new Error(`نوع تفصیل با کد ${detailTypeCode} یافت نشد`);
  }

  if (explicitCode && explicitCode.trim()) {
    const trimmed = explicitCode.trim();
    if (trimmed.length !== detailType.codeLength) {
      throw new Error(`طول کد تفصیل باید ${detailType.codeLength} رقم باشد`);
    }
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < detailType.startNumber || num > detailType.endNumber) {
      throw new Error(`کد باید عددی در بازه ${detailType.startNumber} تا ${detailType.endNumber} باشد`);
    }
    return { code: trimmed, detailTypeId: detailType.id };
  }

  const last = await prisma.detailCodeUsage.findFirst({
    where: { detailTypeId: detailType.id },
    orderBy: { code: "desc" },
  });

  let nextNumber: number;
  if (last) {
    nextNumber = parseInt(last.code, 10) + 1;
  } else {
    nextNumber = detailType.startNumber;
  }

  if (nextNumber > detailType.endNumber) {
    throw new Error(
      `ظرفیت کدگذاری برای نوع تفصیل «${detailType.title}» تمام شده است (بازه ${detailType.startNumber} تا ${detailType.endNumber})`
    );
  }

  const code = String(nextNumber).padStart(detailType.codeLength, "0");
  return { code, detailTypeId: detailType.id };
}

/**
 * ثبت کد تفصیلی صادر شده در جدول مرکزی، برای رعایت یکتایی سراسری بین همه انواع تفصیل.
 * اگر کد به صورت دستی وارد شده هم باید همینجا ثبت شود.
 */
export async function registerDetailCode(
  code: string,
  detailTypeId: number,
  entityTable: string,
  entityId: number
) {
  const existing = await prisma.detailCodeUsage.findUnique({ where: { code } });
  if (existing) {
    throw new Error("این کد قبلا برای یک تفصیلی دیگر (از هر نوعی) استفاده شده است");
  }
  await prisma.detailCodeUsage.create({
    data: { code, detailTypeId, entityTable, entityId },
  });
}

/**
 * تولید کد سریالی ساده برای فرم‌هایی مثل نقش کاربری/کاربر/واحد سازمانی/نوع سند
 * که کد آن‌ها صرفا «آخرین کد + ۱» است و به نوع تفصیل وابسته نیست.
 */
export async function nextSerialNumber(
  model: { findFirst: (args: any) => Promise<any> },
  field: string
): Promise<number> {
  const last = await model.findFirst({ orderBy: { [field]: "desc" } });
  return last ? (last[field] as number) + 1 : 1;
}
