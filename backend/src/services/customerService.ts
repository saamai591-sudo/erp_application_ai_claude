import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { createParty, PartyInput } from "./partyService";
import { assertPartyGroup } from "../routes/partyGroups";

// تنها محل ساخت مشتری (نقش «مشتری» روی یک Party): فرم مشتری (POST /customers) و «دستیار» هر دو از همین تابع می‌گذرند.
// مشتری یا با «طرف‌حساب موجود» (partyId) ساخته می‌شود یا با «تعریف سریع شخص» (party) که از همان سرویس مشترک ساخت شخص می‌گذرد.

export class CustomerError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface CreateCustomerInput {
  code?: number;
  partyId?: number;
  party?: PartyInput;
  confirmDuplicate?: boolean;
  /** هنگام تعریف سریع شخص: اگر عنوان تفصیل تکراری بود، کد تفصیل به آن افزوده شود (به‌جای خطا) */
  autoDisambiguate?: boolean;
  isActive?: boolean;
  /** «گروه مشتری» (اختیاری) */
  groupId?: number | null;
}

export async function createCustomer(body: CreateCustomerInput) {
  if (!body.partyId && !body.party) throw new CustomerError("طرف حساب الزامی است");
  let partyId = body.partyId;
  const finalCode = body.code ?? (await nextSerialNumber(prisma.customer, "code"));
  if (partyId) {
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new CustomerError("طرف حساب یافت نشد", 404);
    const dup = await prisma.customer.findUnique({ where: { partyId } });
    if (dup) throw new CustomerError("این طرف حساب قبلاً به‌عنوان مشتری تعریف شده است");
  } else {
    // کد مشتری پیش از ساخت شخص بررسی می‌شود تا شخص بی‌نقش (یتیم) نماند
    if (body.code && (await prisma.customer.findUnique({ where: { code: body.code }, select: { id: true } }))) throw new CustomerError("کد تکراری است");
    partyId = (await createParty(body.party!, { confirmDuplicate: !!body.confirmDuplicate, autoDisambiguate: !!body.autoDisambiguate })).id;
  }
  const groupId = await assertPartyGroup("customerGroup", body.groupId).catch((e) => {
    throw new CustomerError(e.message);
  });
  return prisma.customer.create({ data: { code: finalCode, partyId: partyId!, isActive: body.isActive ?? true, groupId } });
}
