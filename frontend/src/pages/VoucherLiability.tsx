import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { api } from "../lib/api";

// باشگاه مشتریان › گزارش › «تعهد بن‌کارت‌ها»: به تفکیک سازمان — فروخته‌شده، مصرف‌شده، مانده‌ی قابل مصرف (تعهد ما) و مانده‌ی منقضی. جمع «مانده‌ی قابل مصرف + منقضی» باید با مانده‌ی حساب «بدهی بن‌کارت» بخواند.

interface Row {
  id: number;
  customerId: number;
  customerCode: number | null;
  customerTitle: string;
  soldCount: number;
  soldAmount: number;
  usedCount: number;
  usedAmount: number;
  openCount: number;
  openAmount: number;
  expiredCount: number;
  expiredAmount: number;
}

export default function VoucherLiability() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/voucher-liability-report").then((r: Omit<Row, "id">[]) => { setRows(r.map((x) => ({ ...x, id: x.customerId }))); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    reload();
  }, []);
  const n = (f: (r: Row) => number, extra: object = {}) => ({ render: (r: Row) => formatAmountFa(f(r)), filterType: "number" as const, filterValue: (r: Row) => f(r), decimal: true, width: "130px", ...extra });
  const c = (f: (r: Row) => number) => ({ render: (r: Row) => toFaDigits(String(f(r))), filterType: "number" as const, filterValue: (r: Row) => f(r), width: "80px" });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="تعهد بن‌کارت‌ها" text="مانده‌ی قابل مصرف = بن‌های فروخته‌شده‌ی مصرف‌نشده و منقضی‌نشده (بدهی ما). بنِ منقضی‌شده‌ی مصرف‌نشده جدا نمایش داده می‌شود؛ تصمیم درباره‌ی آن (درآمد یا بازپرداخت) با شماست." />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => (r.customerCode != null ? toFaDigits(String(r.customerCode)) : ""), filterType: "string", filterValue: (r) => String(r.customerCode ?? ""), width: "70px" },
          { header: "سازمان", render: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
          { header: "تعداد فروخته‌شده", ...c((r) => r.soldCount) },
          { header: "مبلغ فروخته‌شده", ...n((r) => r.soldAmount, { totalValue: (r: Row) => r.soldAmount }) },
          { header: "تعداد مصرف‌شده", ...c((r) => r.usedCount) },
          { header: "مبلغ مصرف‌شده", ...n((r) => r.usedAmount, { totalValue: (r: Row) => r.usedAmount }) },
          { header: "تعداد مانده", ...c((r) => r.openCount) },
          { header: "مانده‌ی قابل مصرف", ...n((r) => r.openAmount, { totalValue: (r: Row) => r.openAmount }) },
          { header: "تعداد منقضی", ...c((r) => r.expiredCount) },
          { header: "مانده‌ی منقضی", ...n((r) => r.expiredAmount, { totalValue: (r: Row) => r.expiredAmount }) },
        ]}
        rows={rows}
      />
    </div>
  );
}
