import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import type { TaskRow } from "./MyTasks";

// کارتابل › گزارش › «همه‌ی کارها»: همه‌ی کارهای سیستم (برای مدیر). دابل‌کلیک = جزئیات کار (و واگذاری به کاربر دیگر با مجوز «واگذاری»).

const STATUS_FA: Record<string, string> = { OPEN: "باز", CLAIMED: "برداشته‌شده", DONE: "انجام‌شده", SKIPPED: "ردشده", CANCELLED: "لغو" };
const dt = (iso: string | null) => (iso ? `${formatJalaliDate(iso)} ${toFaDigits(new Date(iso).toTimeString().slice(0, 5))}` : "");

export default function WorkflowAllTasks() {
  const [rows, setRows] = useState<(TaskRow & { id: number })[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    api.get("/workflow/all-tasks").then(setRows).catch((e: ApiError) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, []);
  const s = (f: (r: TaskRow) => string, extra: object = {}) => ({ render: (r: TaskRow) => f(r), filterType: "string" as const, filterValue: (r: TaskRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="همه‌ی کارها" text="همه‌ی کارهای فرایندها با وضعیت و مسئول؛ برای دیدن جزئیات یا واگذاری روی ردیف دابل‌کلیک کنید." />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "سند", ...s((r) => r.rootTitle) },
          { header: "مرحله", ...s((r) => r.stepTitle), width: "180px" },
          { header: "وضعیت", ...s((r) => STATUS_FA[r.status] ?? r.status), width: "110px" },
          { header: "برداشته‌شده توسط", ...s((r) => r.claimedByName), width: "150px" },
          { header: "مهلت", ...s((r) => dt(r.dueAt)), width: "150px" },
          { header: "عقب‌افتاده", ...s((r) => (r.overdue ? "بله" : "")), width: "90px" },
          { header: "انجام", ...s((r) => dt(r.completedAt)), width: "150px" },
          { header: "انجام‌دهنده", ...s((r) => r.completedByName), width: "150px" },
        ]}
        rows={rows}
        edit={{ path: (r: TaskRow) => `/my-tasks/${r.id}` }}
      />
    </div>
  );
}
