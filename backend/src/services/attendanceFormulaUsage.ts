import { prisma } from "../lib/prisma";

// مدیریت تردد: «کدام فرمول‌ها به این متغیر/عامل ارجاع می‌دهند؟» — تنها محل این جست‌وجو (حذف بازه/نوع مرخصی/نوع ماموریت/عامل با آن بررسی می‌شود).
// هم روش‌های عامل‌های تردد و هم روش‌های «عامل حقوق» (فرم «روش محاسبه») را می‌گردد؛ عنوانِ عامل حقوق با پسوند «(حقوق)» می‌آید.

export async function formulaUsers(re: RegExp, exceptFactorKey?: string): Promise<string[]> {
  const rows = await prisma.attendanceFactorMethod.findMany({
    select: { factor: { select: { key: true, title: true } }, payrollComponent: { select: { title: true } }, branches: { select: { formulaText: true, conditionText: true } } },
  });
  const titles = new Set<string>();
  for (const m of rows) {
    if (!m.branches.some((b) => re.test(b.formulaText) || re.test(b.conditionText ?? ""))) continue;
    if (m.factor) {
      if (m.factor.key !== exceptFactorKey) titles.add(m.factor.title);
    } else if (m.payrollComponent) titles.add(`${m.payrollComponent.title} (حقوق)`);
  }
  return [...titles];
}
