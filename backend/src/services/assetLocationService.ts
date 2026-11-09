import { prisma } from "../lib/prisma";
import { AssetError } from "./assetError";

// «درخت موقعیت دارایی» (دارایی ثابت › تنظیمات): ساختمان ← طبقه ← اتاق …، عمق نامحدود. کد در هر سطح یکتا (خودکار: بزرگ‌ترین کد عددی هم‌سطح + ۱)، عنوان در هر سطح یکتا.
// هر گره‌ای را می‌شود در «موقعیت» دارایی انتخاب کرد (AssetPosition.locationId).

const fail = (msg: string): never => {
  throw new AssetError(msg);
};

export async function saveLocation(id: number | null, body: { parentId?: number | null; title?: string; code?: string; isActive?: boolean }) {
  const title = (body.title || "").trim();
  if (!title) fail("عنوان الزامی است");
  if (id) {
    const node = await prisma.assetLocation.findUnique({ where: { id } });
    if (!node) return fail("شاخه یافت نشد");
    const code = (body.code || node!.code).trim();
    if (title !== node!.title && (await prisma.assetLocation.findFirst({ where: { parentId: node!.parentId, title, NOT: { id } } }))) fail("عنوان در این سطح تکراری است");
    if (code !== node!.code && (await prisma.assetLocation.findFirst({ where: { parentId: node!.parentId, code, NOT: { id } } }))) fail("کد در این سطح تکراری است");
    return prisma.assetLocation.update({ where: { id }, data: { title, code, isActive: body.isActive ?? node!.isActive } });
  }
  const parentId = body.parentId ? Number(body.parentId) : null;
  if (parentId) {
    const parent = await prisma.assetLocation.findUnique({ where: { id: parentId } });
    if (!parent) fail("شاخه‌ی مرجع یافت نشد");
    if (!parent!.isActive) fail("زیر شاخه‌ی غیرفعال نمی‌توان شاخه تعریف کرد");
  }
  if (await prisma.assetLocation.findFirst({ where: { parentId, title } })) fail("عنوان در این سطح تکراری است");
  let code = (body.code || "").trim();
  if (!code) {
    const siblings = await prisma.assetLocation.findMany({ where: { parentId }, select: { code: true } });
    const max = siblings.reduce((m, s) => Math.max(m, parseInt(s.code, 10) || 0), 0);
    code = String(max + 1).padStart(2, "0");
  }
  if (await prisma.assetLocation.findFirst({ where: { parentId, code } })) fail("کد در این سطح تکراری است");
  return prisma.assetLocation.create({ data: { parentId, code, title, isActive: body.isActive ?? true } });
}

export async function deleteLocation(id: number) {
  const node = await prisma.assetLocation.findUnique({ where: { id } });
  if (!node) return fail("شاخه یافت نشد");
  if (await prisma.assetLocation.findFirst({ where: { parentId: id } })) fail("این شاخه زیرشاخه دارد و قابل حذف نیست");
  const used = await prisma.assetPosition.findFirst({ where: { locationId: id }, select: { asset: { select: { detailCode: true } } } });
  if (used) fail(`این شاخه در موقعیت دارایی ${used.asset.detailCode} (و شاید موارد دیگر) استفاده شده و قابل حذف نیست`);
  await prisma.assetLocation.delete({ where: { id } });
}

/** مسیر کامل هر شاخه: «ساختمان A › طبقه ۲ › اتاق ۱» */
export async function locationPaths(): Promise<Map<number, string>> {
  const all = await prisma.assetLocation.findMany({ select: { id: true, parentId: true, title: true } });
  const byId = new Map(all.map((n) => [n.id, n]));
  const out = new Map<number, string>();
  for (const n of all) {
    const chain: string[] = [];
    const seen = new Set<number>();
    for (let cur: (typeof all)[number] | undefined = n; cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      seen.add(cur.id);
      chain.unshift(cur.title);
    }
    out.set(n.id, chain.join(" › "));
  }
  return out;
}

/** انتخاب برای موقعیت جدید: شاخه باید وجود داشته باشد و فعال باشد */
export async function assertLocationSelectable(locationId: number): Promise<number> {
  const node = await prisma.assetLocation.findUnique({ where: { id: locationId } });
  if (!node) return fail("شاخه‌ی موقعیت نامعتبر است");
  if (!node!.isActive) fail(`شاخه‌ی «${node!.title}» غیرفعال است`);
  return node!.id;
}
