import { DataTable } from "./DataTable";
import { minutesToMask } from "./TimeInput";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// دو تبِ مشترکِ گزارش‌های «کارکرد روزانه» و «مرور کارکرد» (داده‌ی هر دو از services/attendanceWorksheetReportService.ts می‌آید، پس ستون‌ها یکی است):
// «کارکرد» = یک ردیف برای هر روزِ هر کارمند با ردیف‌های شیفت، اولین ورود، آخرین خروج و عامل‌های روزانه‌ای که «نمایش در گزارش کارکرد» دارند؛
// «ریز ورود و خروج» = تک‌تک ترددها با ردیف شیفت و جهتِ مشتق. showEmployee = ستون «کارمند» (گزارش چندکارمندی).

export interface FactorCol {
  key: string;
  title: string;
  valueType: "NUMBER" | "TIME" | "DAYS";
}
export interface DayVal {
  value: number | null;
  error?: string;
}
export interface DayRow {
  id: string;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  shiftText: string;
  firstIn: string | null;
  lastOut: string | null;
  incomplete: boolean;
  values: Record<string, DayVal>;
}
export interface PunchRow {
  id: string;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  rowNo: number | null;
  shiftRow: string;
  time: string;
  direction: string;
  manual: boolean;
}
export interface WorksheetData {
  from: string;
  to: string;
  factors: FactorCol[];
  rows: DayRow[];
  punches: PunchRow[];
  review: any[];
  summary: { employees: number; days: number; incompleteDays: number; unassigned: number };
  linked?: boolean;
}

const fmtVal = (v: DayVal | undefined, t: FactorCol["valueType"]) => {
  if (!v) return "";
  if (v.value === null) return "خطا";
  if (t === "TIME") return toFaDigits(minutesToMask(Math.round(v.value)));
  return toFaDigits(String(Math.round(v.value * 100) / 100));
};

const s = <T,>(f: (r: T) => string, extra: object = {}) => ({ render: (r: T) => f(r), filterType: "string" as const, filterValue: (r: T) => f(r), ...extra });

export function WorksheetGrid({ data, showEmployee }: { data: WorksheetData | null; showEmployee?: boolean }) {
  const cols: any[] = [
    { header: "کد پرسنلی", ...s<DayRow>((r) => toFaDigits(r.personnelCode)), width: "100px" },
    ...(showEmployee ? [{ header: "کارمند", ...s<DayRow>((r) => r.employeeName), width: "170px" }] : []),
    { header: "تاریخ", ...s<DayRow>((r) => formatJalaliDate(r.date)), width: "100px" },
    { header: "ردیف شیفت", ...s<DayRow>((r) => toFaDigits(r.shiftText)), width: "200px" },
    { header: "اولین ورود", ...s<DayRow>((r) => (r.firstIn ? toFaDigits(r.firstIn) : "")), width: "100px" },
    { header: "آخرین خروج", ...s<DayRow>((r) => (r.lastOut ? toFaDigits(r.lastOut) : "")), width: "100px" },
    ...(data?.factors ?? []).map((f) => ({ header: f.title, ...s<DayRow>((r) => fmtVal(r.values[f.key], f.valueType)), width: "130px" })),
  ];
  return <DataTable<DayRow> columns={cols} rows={data?.rows ?? []} />;
}

export function PunchGrid({ data, showEmployee }: { data: WorksheetData | null; showEmployee?: boolean }) {
  const cols: any[] = [
    { header: "کد پرسنلی", ...s<PunchRow>((r) => toFaDigits(r.personnelCode)), width: "100px" },
    ...(showEmployee ? [{ header: "کارمند", ...s<PunchRow>((r) => r.employeeName), width: "170px" }] : []),
    { header: "تاریخ", ...s<PunchRow>((r) => formatJalaliDate(r.date)), width: "100px" },
    { header: "ردیف شیفت", ...s<PunchRow>((r) => toFaDigits(r.shiftRow)), width: "230px" },
    { header: "ساعت", ...s<PunchRow>((r) => toFaDigits(r.time) + (r.manual ? " *" : "")), width: "110px" },
    { header: "جهت", ...s<PunchRow>((r) => r.direction), width: "110px" },
  ];
  return <DataTable<PunchRow> columns={cols} rows={data?.punches ?? []} />;
}
