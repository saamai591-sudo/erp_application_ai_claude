import { IssueLineInput } from "./journalEntryService";
import { accountLinksDetailType, resolveAccountDetailFieldsForCodes, resolveDetailTypeId } from "../utils/detailValues";

// =========================================================================
// ردیف‌های سندِ حسابداریِ چک دریافتنی روی معینی که ممکن است به «طرف‌حساب» وصل باشد (اسناد در جریان وصول، حساب بانکی).
// قاعده: اگر معین در یکی از سطوح تفصیل خود به نوع تفصیلِ طرف‌حسابِ چک وصل باشد، طرف‌حسابِ چک خودکار در همان سطح
// ثبت می‌شود (کنار تفصیل حساب بانکی)؛ چون طرف‌حساب هر چک متفاوت است، ردیف به‌ازای هر طرف‌حساب جدا می‌شود. اگر معین به
// طرف‌حساب وصل نباشد، رفتار قبلی حفظ می‌شود: یک ردیفِ مجموع با تفصیل حساب بانکی.
// =========================================================================

type AccountRef = { id: number; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
export type CounterpartyCheque = { amount: number; party: { detailCode: string | null; category?: string; name?: string | null; firstName?: string | null; lastName?: string | null } };

function partyName(p: CounterpartyCheque["party"]): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function buildChequeLedgerLines(opts: {
  account: AccountRef;
  baseDetailCode: string | null; // تفصیل ثابتِ ردیف (معمولاً حساب بانکی)
  cheques: CounterpartyCheque[];
  side: "debit" | "credit";
  currencyId: number;
  description: string;
}): Promise<IssueLineInput[]> {
  const { account, baseDetailCode, cheques, side, currencyId, description } = opts;
  const groups = new Map<string, { amount: number; party: CounterpartyCheque["party"] | null }>();
  for (const c of cheques) {
    const typeId = await resolveDetailTypeId(c.party.detailCode);
    const linked = !!c.party.detailCode && accountLinksDetailType(account, typeId);
    const key = linked ? c.party.detailCode! : "";
    const g = groups.get(key) ?? { amount: 0, party: linked ? c.party : null };
    g.amount += c.amount;
    groups.set(key, g);
  }

  const lines: IssueLineInput[] = [];
  for (const [code, g] of groups) {
    const details = await resolveAccountDetailFieldsForCodes(account, [baseDetailCode, code || null]);
    lines.push({
      accountId: account.id,
      ...details,
      currencyId,
      debit: side === "debit" ? g.amount : 0,
      credit: side === "credit" ? g.amount : 0,
      fxRate: 1,
      description: g.party ? `${description} — ${partyName(g.party)}`.trim() : description,
    });
  }
  return lines;
}
