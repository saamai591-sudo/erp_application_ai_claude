import { prisma } from "../lib/prisma";
import { wrapPrintHtml } from "./printService";

// چاپ «فیش حقوقی» یک یا چند کارمند از فیش‌های محاسبه‌شده‌ی یک ماه (چیدمان بر اساس نمونه‌ی `Documents/فیش.pdf`):
// عنوان شرکت و «فیش حقوق ماه … سال …»، مشخصات کارمند، سه ستون کارکرد | مزایا | کسورات، جمع‌ها و جمله‌ی واریز به حساب.
// اعداد از خودِ فیش ذخیره‌شده خوانده می‌شود (نه محاسبه‌ی دوباره)؛ هر فیش یک بلوک است و چند فیش پشت سر هم در صفحه‌ها می‌آید.

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (v: string | number) => Math.round(Number(v)).toLocaleString("en-US");

function hhmm(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function valueText(amount: number, valueType: string | undefined): string {
  if (valueType === "TIME") return hhmm(amount);
  if (valueType === "DAYS" || valueType === "NUMBER") return String(Math.round(amount * 100) / 100);
  return money(amount);
}

const CSS = `
.slip { border: 1px solid #000; margin: 0 0 7mm; page-break-inside: avoid; break-inside: avoid; font-size: 8.5pt; }
.slip h1 { font-size: 10pt; margin: 0; padding: 2mm 0 0; text-align: center; font-weight: 700; }
.slip h2 { font-size: 9.5pt; margin: 0; padding: 1mm 0 2mm; text-align: center; font-weight: 700; }
.slip .info { display: flex; flex-wrap: wrap; border-top: 1px solid #000; padding: 1.5mm 2mm; gap: 1mm 6mm; }
.slip .info div { white-space: nowrap; }
.slip .cols { display: flex; border-top: 1px solid #000; }
.slip .col { flex: 1 1 0; border-left: 1px solid #000; min-width: 0; }
.slip .col:last-child { border-left: none; }
.slip .col .head { text-align: center; font-weight: 700; border-bottom: 1px solid #000; padding: 0.8mm 0; }
.slip table { width: 100%; border-collapse: collapse; }
.slip th { font-weight: 700; padding: 0.8mm 1.5mm; border-bottom: 1px solid #000; text-align: center; }
.slip td { padding: 0.8mm 1.5mm; vertical-align: top; }
.slip td.n { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
.slip .tot { display: flex; border-top: 1px solid #000; font-weight: 700; }
.slip .tot > div { flex: 1 1 0; padding: 1.2mm 2mm; border-left: 1px solid #000; display: flex; justify-content: space-between; gap: 4mm; }
.slip .tot > div:last-child { border-left: none; }
.slip .note { border-top: 1px solid #000; padding: 1.5mm 2mm; }
.slip .warn { border-top: 1px solid #000; padding: 1.2mm 2mm; color: #b00020; font-weight: 700; }
`;

interface LineLite {
  kind: string;
  title: string;
  amount: number;
  error: string | null;
  valueType?: string;
}

function section(title: string, valueHead: string, lines: LineLite[]): string {
  const rows = lines
    .map((l) => `<tr><td>${esc(l.title)}</td><td class="n">${l.error ? "—" : valueText(l.amount, l.valueType)}</td></tr>`)
    .join("");
  return `<div class="col"><div class="head">${esc(title)}</div><table><thead><tr><th>عنوان</th><th>${esc(valueHead)}</th></tr></thead><tbody>${rows || `<tr><td colspan="2">&nbsp;</td></tr>`}</tbody></table></div>`;
}

export interface SlipPrintResult {
  html: string;
  fileName: string;
  count: number;
  /** کارمندانی که برای ماه فیش محاسبه‌شده ندارند */
  missing: number[];
}

export async function buildPayrollSlipsPrint(year: number, month: number, employeeIds: number[], digits: "LATIN" | "PERSIAN" = "PERSIAN", calcTypeId?: number): Promise<SlipPrintResult> {
  const calcType = calcTypeId ? await prisma.payrollCalcType.findUnique({ where: { id: calcTypeId } }) : await prisma.payrollCalcType.findFirst({ where: { isBase: true } });
  // عنوان فیش: حقوق ماهانه «فیش حقوق ماه …»، انواع دیگر «فیش <نوع> ماه …»
  const docTitle = !calcType || calcType.isBase ? "فیش حقوق" : `فیش ${calcType.title}`;
  const slips = await prisma.payrollSlip.findMany({
    where: { year, month, employeeId: { in: employeeIds }, ...(calcType ? { calcTypeId: calcType.id } : {}) },
    include: {
      lines: { orderBy: { seq: "asc" } },
      decree: { select: { employmentType: { select: { title: true } } } },
      employee: {
        select: {
          id: true,
          personnelCode: true,
          salaryBankAccountId: true,
          partyId: true,
          party: { select: { firstName: true, lastName: true, name: true, nationalId: true } },
          assignments: {
            where: { toDate: null },
            take: 1,
            select: { position: { select: { title: true } }, costCenter: { select: { title: true } } },
          },
        },
      },
    },
    orderBy: { employee: { personnelCode: "asc" } },
  });
  const have = new Set(slips.map((s) => s.employeeId));
  const missing = employeeIds.filter((id) => !have.has(id));
  const company = await prisma.companyProfile.findUnique({ where: { id: 1 }, select: { name: true } });

  // حساب بانکی حقوق: ارجاع به یکی از حساب‌های بانکیِ همان شخص
  const accIds = slips.map((s) => s.employee.salaryBankAccountId).filter((x): x is number => !!x);
  const accounts = accIds.length ? await prisma.partyBankAccount.findMany({ where: { id: { in: accIds } } }) : [];
  const bankPartyIds = accounts.map((a) => a.bankPartyId).filter((x): x is number => !!x);
  const bankParties = bankPartyIds.length ? await prisma.party.findMany({ where: { id: { in: bankPartyIds } }, select: { id: true, name: true, firstName: true, lastName: true } }) : [];

  const blocks = slips.map((s) => {
    const p = s.employee.party;
    const first = p.firstName ?? "";
    const last = p.lastName ?? p.name ?? "";
    const cur = s.employee.assignments[0];
    const lines: LineLite[] = s.lines.map((l) => ({
      kind: l.kind,
      title: l.title,
      amount: Number(l.amount),
      error: l.error,
      valueType: (l.trace as any)?.valueType,
    }));
    const work = lines.filter((l) => l.kind === "WORK" || l.kind === "INFO");
    const earn = lines.filter((l) => l.kind === "EARNING");
    const ded = lines.filter((l) => l.kind === "DEDUCTION");
    const acc = accounts.find((a) => a.id === s.employee.salaryBankAccountId);
    const bank = acc?.bankPartyId ? bankParties.find((b) => b.id === acc.bankPartyId) : undefined;
    const bankName = bank ? bank.name ?? [bank.firstName, bank.lastName].filter(Boolean).join(" ") : "";
    const accNo = acc ? acc.accountNumber || acc.iban || acc.cardNumber || "" : "";
    const info: string[] = [
      `<div>نام: <b>${esc(first)}</b></div>`,
      `<div>نام خانوادگی: <b>${esc(last)}</b></div>`,
      `<div>کد پرسنلی: <b>${esc(s.employee.personnelCode)}</b></div>`,
      p.nationalId ? `<div>کد ملی: <b>${esc(p.nationalId)}</b></div>` : "",
      cur?.costCenter?.title ? `<div>مرکز هزینه: <b>${esc(cur.costCenter.title)}</b></div>` : "",
      cur?.position?.title ? `<div>شغل: <b>${esc(cur.position.title)}</b></div>` : "",
      s.decree?.employmentType?.title ? `<div>نوع استخدام: <b>${esc(s.decree.employmentType.title)}</b></div>` : "",
    ].filter(Boolean);
    return `<div class="slip">
<h1>${esc(company?.name ?? "")}</h1>
<h2>${esc(docTitle)} ماه ${MONTHS[month - 1]} سال ${year}</h2>
<div class="info">${info.join("")}</div>
<div class="cols">${section("کارکرد", "مقدار", work)}${section("مزایا", "مبلغ – ریال", earn)}${section("کسورات", "مبلغ – ریال", ded)}</div>
<div class="tot"><div><span>جمع مزایا</span><span>${money(s.earnings.toString())}</span></div><div><span>جمع کسور</span><span>${money(s.deductions.toString())}</span></div><div><span>خالص پرداختی</span><span>${money(s.netPay.toString())}</span></div></div>
${accNo ? `<div class="note">مبلغ خالص پرداختنی به حساب شماره ${esc(accNo)}${bankName ? ` نزد بانک ${esc(bankName)}` : ""} واریز گردید.</div>` : ""}
${s.hasErrors ? `<div class="warn">توجه: محاسبه‌ی این فیش در برخی عوامل خطا داشته و جمع‌ها ناقص است؛ فیش را پیش از استفاده بررسی کنید.</div>` : ""}
</div>`;
  });

  const title = slips.length === 1 ? `${docTitle} ${MONTHS[month - 1]} ${year} - ${slips[0].employee.party.lastName ?? ""}`.trim() : `${docTitle} ${MONTHS[month - 1]} ${year}`;
  const html = wrapPrintHtml(`<style>${CSS}</style>${blocks.join("") || "<p>فیشی برای چاپ وجود ندارد</p>"}`, { title, paper: "A4", orientation: "PORTRAIT", marginMm: 8, digits });
  return { html, fileName: title, count: slips.length, missing };
}
