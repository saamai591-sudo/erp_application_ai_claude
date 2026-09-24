import { prisma } from "../lib/prisma";

export function bankAccountDisplayText(b: { accountNumber: string; bankBranch?: { title: string } | null } | null | undefined): string | null {
  return b ? `${b.accountNumber}${b.bankBranch ? ` — ${b.bankBranch.title}` : ""}` : null;
}

// حساب بانکیِ واگذاریِ تاییدشده‌ای که یک چک را «واگذار به وصول» کرده — برای صدور سند برگشت از واگذاری و نتیجه‌ی وصول/برگشت.
// ردیف واگذاری با chequeStep یک واحد کمتر از chequeStep ردیفِ سندِ فعلی (دقیق‌ترین تطبیق)؛ در نبودِ آن، آخرین واگذاریِ تاییدشده.
// بدون محدودیت دوره مالی: چک ممکن است در سال قبل واگذار شده باشد.
export async function findDepositBankByCheque(lines: { chequeItemId: number; chequeStep: number | null }[]) {
  const depositLines = await prisma.chequeDepositLine.findMany({
    where: { chequeItemId: { in: lines.map((l) => l.chequeItemId) }, chequeDeposit: { status: "APPROVED" } },
    include: { chequeDeposit: { include: { bankAccount: { include: { bankBranch: true } } } } },
  });

  const result = new Map<number, { bankAccountId: number; bankAccount: any }>();
  for (const l of lines) {
    const candidates = depositLines.filter((d) => d.chequeItemId === l.chequeItemId);
    const exact = l.chequeStep != null ? candidates.find((d) => d.chequeStep === l.chequeStep! - 1) : undefined;
    const latest = [...candidates].sort((a, b) => b.chequeDeposit.date.getTime() - a.chequeDeposit.date.getTime() || b.chequeDepositId - a.chequeDepositId)[0];
    const deposit = (exact ?? latest)?.chequeDeposit;
    if (deposit) result.set(l.chequeItemId, { bankAccountId: deposit.bankAccountId, bankAccount: deposit.bankAccount });
  }
  return result;
}
