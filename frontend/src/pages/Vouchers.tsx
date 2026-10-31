import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";

// باشگاه مشتریان › عملیات › «بن‌کارت‌ها»: فهرست همه‌ی بن‌ها با فیلتر وضعیت/نوع/سریال؛ خروجی Excel برای چاپ بارکد (دکمه‌ی خروجی جدول)؛ ابطال بن با علت.

interface VoucherRow {
  id: number;
  serial: string;
  typeId: number;
  typeTitle: string;
  batchNumber: number | null;
  faceValue: number;
  validUntil: string | null;
  status: "CREATED" | "SOLD" | "USED" | "VOID";
  statusTitle: string;
  expired: boolean;
  saleNumber: number | null;
  customerTitle: string;
  voidReason: string;
  usedReceiptNumber: number | null;
}
interface TypeOpt {
  id: number;
  title: string;
}

export default function Vouchers() {
  const { hasPermission } = usePermissions();
  const canVoid = hasPermission("customer-club.operations.vouchers.void");
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [status, setStatus] = useState("");
  const [typeId, setTypeId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voidRow, setVoidRow] = useState<VoucherRow | null>(null);
  const [reason, setReason] = useState("");

  async function reload() {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (typeId) qs.set("typeId", typeId);
    if (search.trim()) qs.set("search", search.trim());
    api.get(`/vouchers?${qs.toString()}`).then((r) => { setRows(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    api.get("/voucher-types").then(setTypes).catch(() => {});
  }, []);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, typeId]);

  async function doVoid() {
    if (!voidRow) return;
    try {
      await api.post(`/vouchers/${voidRow.id}/void`, { reason });
      setVoidRow(null);
      setReason("");
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const s = (f: (r: VoucherRow) => string, extra: object = {}) => ({ render: (r: VoucherRow) => f(r), filterType: "string" as const, filterValue: (r: VoucherRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
          <InfoHint title="بن‌کارت‌ها" text="ایجادشده = هنوز فروخته نشده (بدهی نیست)؛ فروخته‌شده = بدهی ما به حامل بن؛ مصرف‌شده = در یک دریافت فروش فروشگاهی خرج شده؛ منقضی = تاریخ اعتبارش گذشته. سریال‌ها برای چاپ بارکد با دکمه‌ی خروجی Excel جدول قابل برداشت‌اند." />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
            <option value="">همه‌ی وضعیت‌ها</option>
            <option value="CREATED">ایجادشده</option>
            <option value="SOLD">فروخته‌شده</option>
            <option value="USED">مصرف‌شده</option>
            <option value="VOID">باطل</option>
          </select>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} style={{ width: 170 }}>
            <option value="">همه‌ی انواع</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <input dir="ltr" placeholder="جست‌وجوی سریال" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") reload(); }} style={{ width: 170 }} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "سریال", ...s((r) => r.serial), width: "140px" },
          { header: "نوع بن", ...s((r) => r.typeTitle) },
          { header: "ارزش اسمی", render: (r) => formatAmountFa(r.faceValue), filterType: "number", filterValue: (r) => r.faceValue, decimal: true, width: "120px" },
          { header: "وضعیت", ...s((r) => r.statusTitle), width: "100px" },
          { header: "سازمان خریدار", ...s((r) => r.customerTitle) },
          { header: "فروش بن", ...s((r) => (r.saleNumber != null ? toFaDigits(String(r.saleNumber)) : "")), width: "90px" },
          { header: "انقضا", render: (r) => (r.validUntil ? formatJalaliDate(r.validUntil) : "—"), filterType: "date", filterValue: (r) => r.validUntil ?? "", width: "110px" },
          { header: "دسته", ...s((r) => (r.batchNumber != null ? toFaDigits(String(r.batchNumber)) : "")), width: "70px" },
          { header: "دریافت مصرف", ...s((r) => (r.usedReceiptNumber != null ? toFaDigits(String(r.usedReceiptNumber)) : "")), width: "100px" },
          { header: "علت ابطال", ...s((r) => r.voidReason) },
        ]}
        rows={rows}
        bulkActions={canVoid ? [{ label: (n: number) => `ابطال بن (${toFaDigits(String(n))})`, onClick: (rs: VoucherRow[]) => { if (rs.length !== 1) return showError("برای ابطال، یک بن را انتخاب کنید"); if (rs[0].status === "USED" || rs[0].status === "VOID") return showError("این بن قابل ابطال نیست"); setVoidRow(rs[0]); } }] : undefined}
      />
      {voidRow && (
        <Modal title={`ابطال بن ${voidRow.serial}`} onClose={() => setVoidRow(null)}>
          <div className="form-field">
            <label>علت ابطال</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn danger" onClick={doVoid} disabled={!reason.trim()}>ابطال</button>
            <button type="button" className="btn secondary" onClick={() => setVoidRow(null)}>انصراف</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
