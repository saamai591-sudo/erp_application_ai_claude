import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

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
  code?: number;
  title: string;
  faceValue?: number;
  isActive?: boolean;
}

const EMPTY_ISSUE = { typeId: "", count: "", date: localTodayIso(), validUntil: "", description: "" };

export default function Vouchers() {
  const location = useLocation();
  if (location.pathname.endsWith("/new")) return <VoucherForm />;
  return <VoucherList />;
}

function VoucherList() {
  const { hasPermission } = usePermissions();
  const canVoid = hasPermission("customer-club.operations.vouchers.void");
  const canIssue = hasPermission("customer-club.operations.vouchers.issue");
  const canDelete = hasPermission("customer-club.operations.vouchers.delete");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issue, setIssue] = useState(EMPTY_ISSUE);
  const [issueBusy, setIssueBusy] = useState(false);
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

  // صدور دسته‌ای: سریال‌های یکتا و غیرقابل‌حدس (۱۰ رقم تصادفی + رقم کنترل) برای یک نوع بن؛ بن‌های تازه «ایجادشده»اند و بدهی نیستند.
  async function doIssue() {
    if (!issue.typeId) return showError("نوع بن را انتخاب کنید");
    if (!(Number(issue.count) >= 1)) return showError("تعداد باید عدد صحیحِ مثبت باشد");
    if (issueBusy) return;
    setIssueBusy(true);
    try {
      await api.post("/voucher-batches", { typeId: Number(issue.typeId), count: Number(issue.count), date: issue.date, validUntil: issue.validUntil || null, description: issue.description });
      setIssueOpen(false);
      setIssue(EMPTY_ISSUE);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setIssueBusy(false);
    }
  }
  // حذف بن‌های استفاده‌نشده: فقط فروخته‌نشده و بدون دریافت (سرور دوباره کنترل می‌کند)؛ همه‌یا‌هیچ
  async function doDelete(rs: VoucherRow[]) {
    const blocked = rs.filter((r) => r.saleNumber != null || r.usedReceiptNumber != null || (r.status !== "CREATED" && r.status !== "VOID"));
    if (blocked.length) return showError(`فقط بن‌های فروخته‌نشده قابل حذف‌اند؛ ${toFaDigits(String(blocked.length))} بن انتخابی فروخته یا مصرف شده است (آن‌ها را باطل کنید)`);
    if (!window.confirm(`${toFaDigits(String(rs.length))} بن حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    try {
      await api.post("/vouchers/delete", { ids: rs.map((r) => r.id) });
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const issueType = types.find((t) => String(t.id) === issue.typeId);

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
          <NewRecordButton path="/vouchers/new" />
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
        bulkActions={[
          ...(canIssue ? [{ label: () => "صدور بن‌کارت", noSelection: true, onClick: () => setIssueOpen(true) }] : []),
          ...(canDelete ? [{ label: (n: number) => `حذف بن‌های استفاده‌نشده (${toFaDigits(String(n))})`, danger: true, onClick: doDelete }] : []),
          ...(canVoid ? [{ label: (n: number) => `ابطال بن (${toFaDigits(String(n))})`, onClick: (rs: VoucherRow[]) => { if (rs.length !== 1) return showError("برای ابطال، یک بن را انتخاب کنید"); if (rs[0].status === "USED" || rs[0].status === "VOID") return showError("این بن قابل ابطال نیست"); setVoidRow(rs[0]); } }] : []),
        ]}
      />
      {issueOpen && (
        <Modal title="صدور بن‌کارت" onClose={() => setIssueOpen(false)}>
          <div className="form-grid">
            <div className="form-field">
              <label>نوع بن<RequiredMark /></label>
              <RecordPickerField<TypeOpt>
                title="انتخاب نوع بن"
                displayValue={issueType ? `${issueType.title} — ${formatAmountFa(issueType.faceValue ?? 0)}` : ""}
                rows={types.filter((t) => t.isActive !== false)}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code ?? "")), filterValue: (x) => String(x.code ?? ""), width: "70px" },
                  { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                  { header: "ارزش اسمی", render: (x) => formatAmountFa(x.faceValue ?? 0), filterValue: (x) => String(x.faceValue ?? ""), width: "130px" },
                ]}
                onSelect={(x) => setIssue({ ...issue, typeId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>تعداد<RequiredMark /> <FieldHint label="تعداد" text="حداکثر ۲۰٬۰۰۰ بن در هر دسته. سریال‌ها تصادفی و یکتایند." /></label>
              <input dir="ltr" inputMode="numeric" value={issue.count} onChange={(e) => setIssue({ ...issue, count: e.target.value.replace(/[^\d]/g, "") })} autoFocus />
            </div>
            <div className="form-field">
              <label>تاریخ صدور<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={issue.date} onChange={(v) => setIssue({ ...issue, date: v })} />
            </div>
            <div className="form-field">
              <label>تاریخ انقضا <FieldHint label="تاریخ انقضا" text="اختیاری؛ خالی = از مدت اعتبار نوع بن (از تاریخ صدور) محاسبه می‌شود." /></label>
              <JalaliDatePicker value={issue.validUntil} onChange={(v) => setIssue({ ...issue, validUntil: v })} />
            </div>
            <DescriptionField value={issue.description} onChange={(v) => setIssue({ ...issue, description: v })} />
          </div>
          {issueType && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>ارزش کل این دسته: {formatAmountFa((issueType.faceValue ?? 0) * (Number(issue.count) || 0))}</p>}
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={doIssue} disabled={issueBusy}>صدور</button>
            <button type="button" className="btn secondary" onClick={() => setIssueOpen(false)}>انصراف</button>
          </div>
        </Modal>
      )}
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

// ثبت بنِ تکی (کارت از قبل چاپ‌شده یا یک بنِ تصادفی)؛ صدور دسته‌ای = عملیات گروهی همین فهرست.
function VoucherForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = usePersistedState(`form:${location.pathname}:form`, { typeId: "", serial: "", date: localTodayIso(), validUntil: "", description: "" });
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/voucher-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.isActive !== false))).catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.typeId) return setError("نوع بن را انتخاب کنید");
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/vouchers", { typeId: Number(form.typeId), serial: form.serial.trim() || null, date: form.date, validUntil: form.validUntil || null, description: form.description });
      flash();
      navigate("/vouchers");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const type = types.find((t) => String(t.id) === form.typeId);
  return (
    <FormPage title="ثبت بن‌کارت" formId="voucher-form" closePath="/vouchers" newPath="/vouchers/new" saveDisabled={busy}>
      <form id="voucher-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نوع بن<RequiredMark /></label>
            <RecordPickerField<TypeOpt>
              title="انتخاب نوع بن"
              displayValue={type ? `${type.title} — ${formatAmountFa(type.faceValue ?? 0)}` : ""}
              rows={types}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code ?? "")), filterValue: (x) => String(x.code ?? ""), width: "70px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                { header: "ارزش اسمی", render: (x) => formatAmountFa(x.faceValue ?? 0), filterValue: (x) => String(x.faceValue ?? ""), width: "130px" },
              ]}
              onSelect={(x) => setForm({ ...form, typeId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>سریال <FieldHint label="سریال" text="اختیاری؛ خالی = سریال تصادفی و یکتا ساخته می‌شود. سریال دلخواه (مثلاً کارتِ از قبل چاپ‌شده) هر مقداری می‌تواند باشد، به شرط اینکه تکراری نباشد." /></label>
            <input dir="ltr" inputMode="numeric" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} maxLength={50} autoFocus />
          </div>
          <div className="form-field">
            <label>تاریخ صدور<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>تاریخ انقضا <FieldHint label="تاریخ انقضا" text="اختیاری؛ خالی = از مدت اعتبار نوع بن (از تاریخ صدور) محاسبه می‌شود." /></label>
            <JalaliDatePicker value={form.validUntil} onChange={(v) => setForm({ ...form, validUntil: v })} />
          </div>
          <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
      </form>
    </FormPage>
  );
}
