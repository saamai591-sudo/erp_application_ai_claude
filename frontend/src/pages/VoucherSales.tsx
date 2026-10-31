import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// باشگاه مشتریان › عملیات › «فروش بن‌کارت به سازمان»: بن‌های «ایجادشده» (به تعداد یا فهرست سریال) به یک سازمان (مشتری) فروخته می‌شوند و از این لحظه بدهی ما هستند.
// سند حسابداری (دستی): بدهکار «طلب از سازمان بابت بن‌کارت»، بستانکار «بدهی بن‌کارت» (تفصیل: سازمان). قواعد در سرور (services/voucherService.ts).

interface SaleRow {
  id: number;
  number: number;
  date: string;
  customerId: number;
  customerTitle: string;
  description: string;
  count: number;
  amount: number;
  usedCount: number;
  journalEntryId: number | null;
  journalEntryReferenceNumber: number | null;
  vouchers?: { serial: string; typeTitle: string; faceValue: number; status: string }[];
}
interface CustomerOpt {
  id: number;
  code: number;
  isActive: boolean;
  party: { detailTitle?: string; name?: string; firstName?: string; lastName?: string; category?: string };
}
interface TypeOpt {
  id: number;
  title: string;
  faceValue: number;
  isActive: boolean;
}
const customerTitleOf = (c: CustomerOpt) => c.party.detailTitle || (c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim());
const STATUS_FA: Record<string, string> = { CREATED: "ایجادشده", SOLD: "فروخته‌شده", USED: "مصرف‌شده", VOID: "باطل" };

export default function VoucherSales() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <SaleForm />;
  if (location.pathname.endsWith("/edit")) return <SaleForm editId={Number(id)} />;
  return <SaleList />;
}

function SaleList() {
  const cacheKey = "/voucher-sales";
  const [items, setItems] = usePersistedState<SaleRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/voucher-sales").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: SaleRow) {
    try {
      await api.del(`/voucher-sales/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: SaleRow) => string, extra: object = {}) => ({ render: (r: SaleRow) => f(r), filterType: "string" as const, filterValue: (r: SaleRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="فروش بن‌کارت به سازمان" text="بن‌های ایجادشده به یک سازمان فروخته می‌شوند و از همین لحظه بدهی ما به حاملِ بن‌اند. سند حسابداری: بدهکار «طلب از سازمان»، بستانکار «بدهی بن‌کارت»؛ درآمد هنگام مصرف بن در فروش فروشگاهی شناسایی می‌شود." />
          <NewRecordButton path="/voucher-sales/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: SaleRow) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "سازمان", ...s((r) => r.customerTitle) },
          { header: "تعداد بن", ...s((r) => toFaDigits(String(r.count))), width: "90px" },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount), filterType: "number", filterValue: (r) => r.amount, decimal: true, width: "130px" },
          { header: "مصرف‌شده", ...s((r) => toFaDigits(String(r.usedCount))), width: "100px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: SaleRow) => `/voucher-sales/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function SaleForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { date: localTodayIso(), customerId: "", typeId: "", count: "", serials: "", description: "" });
  const [data, setData] = useState<SaleRow | null>(null);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId);
  const { flash } = useSavedFlash();

  async function load() {
    const d: SaleRow = await api.get(`/voucher-sales/${editId}`);
    setData(d);
    setLoaded(true);
  }
  useEffect(() => {
    Promise.all([api.get("/customers"), api.get("/voucher-types")]).then(([cu, ty]) => { setCustomers((cu as CustomerOpt[]).filter((c) => c.isActive !== false)); setTypes((ty as TypeOpt[]).filter((t) => t.isActive)); }).catch(() => {});
    if (editId) load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (editId) return; // سند ثبت‌شده ویرایش نمی‌شود (حذف و ثبت دوباره)
    if (!form.customerId) return setError("سازمان (مشتری) را انتخاب کنید");
    const serials = form.serials.split(/[\s,;،]+/).map((x) => x.trim()).filter(Boolean);
    if (!serials.length && (!form.typeId || !(Number(form.count) >= 1))) return setError("یا نوع بن و تعداد را بدهید، یا فهرست سریال‌ها را وارد کنید");
    try {
      const created = await api.post("/voucher-sales", { date: form.date, customerId: Number(form.customerId), description: form.description, ...(serials.length ? { serials } : { typeId: Number(form.typeId), count: Number(form.count) }) });
      flash();
      navigate(`/voucher-sales/${created.id}/edit`);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/voucher-sales/${editId}`);
      navigate("/voucher-sales");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function issueJournal() {
    try {
      await api.post(`/voucher-sales/${editId}/issue-journal-entry`, {});
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function revertJournal() {
    try {
      await api.del(`/voucher-sales/${editId}/journal-entry`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const customer = customers.find((c) => String(c.id) === form.customerId);
  const type = types.find((t) => String(t.id) === form.typeId);
  const extraActions: { label: string; onClick: () => void }[] = [];
  if (editId && data) {
    if (data.journalEntryId) {
      extraActions.push({ label: "مشاهده سند حسابداری", onClick: () => openTab(`/journal-entries/${data.journalEntryId}/edit`) });
      if (hasPermission("customer-club.operations.voucher-sales.deleteJournalEntry")) extraActions.push({ label: "حذف سند حسابداری", onClick: revertJournal });
    } else if (hasPermission("customer-club.operations.voucher-sales.issueJournalEntry")) {
      extraActions.push({ label: "صدور سند حسابداری", onClick: issueJournal });
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `فروش بن‌کارت شماره ${toFaDigits(String(data?.number ?? ""))}` : "فروش بن‌کارت به سازمان"} formId="voucher-sale-form" closePath="/voucher-sales" newPath="/voucher-sales/new" onDelete={editId ? handleDelete : undefined} saveDisabled={!!editId} extraActions={extraActions}>
      <form id="voucher-sale-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {editId && data ? (
          <>
            <div className="form-grid">
              <div className="form-field"><label>تاریخ</label><input disabled value={formatJalaliDate(data.date)} /></div>
              <div className="form-field"><label>سازمان</label><input disabled value={data.customerTitle} /></div>
              <div className="form-field"><label>تعداد بن</label><input disabled value={toFaDigits(String(data.count))} /></div>
              <div className="form-field"><label>مبلغ</label><input disabled value={formatAmountFa(data.amount)} /></div>
              <div className="form-field"><label>مصرف‌شده</label><input disabled value={toFaDigits(String(data.usedCount))} /></div>
              <div className="form-field"><label>سند حسابداری</label><input disabled value={data.journalEntryReferenceNumber != null ? toFaDigits(String(data.journalEntryReferenceNumber)) : "صادر نشده"} /></div>
              <div className="form-field full"><label>شرح</label><input disabled value={data.description} /></div>
            </div>
            <table className="je-lines-table" style={{ marginTop: 12 }}>
              <thead><tr><th>ردیف</th><th>سریال</th><th>نوع</th><th>ارزش اسمی</th><th>وضعیت</th></tr></thead>
              <tbody>
                {(data.vouchers ?? []).map((v, i) => (
                  <tr key={v.serial}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td dir="ltr">{v.serial}</td>
                    <td>{v.typeTitle}</td>
                    <td>{formatAmountFa(v.faceValue)}</td>
                    <td>{STATUS_FA[v.status] ?? v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="form-field">
              <label>سازمان<RequiredMark /></label>
              <RecordPickerField<CustomerOpt>
                title="انتخاب سازمان (مشتری)"
                displayValue={customer ? `${toFaDigits(String(customer.code))} — ${customerTitleOf(customer)}` : ""}
                rows={customers}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                  { header: "عنوان", render: (x) => customerTitleOf(x), filterValue: (x) => customerTitleOf(x) },
                ]}
                onSelect={(x) => setForm({ ...form, customerId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>نوع بن <FieldHint label="انتخاب بن‌ها" text="دو راه: نوع بن + تعداد (کمترین سریال‌های ایجادشده و بدون انقضا برداشته می‌شود)، یا فهرست سریال‌ها در کادر پایین." /></label>
              <RecordPickerField<TypeOpt>
                title="انتخاب نوع بن"
                displayValue={type ? `${type.title} — ${formatAmountFa(type.faceValue)}` : ""}
                rows={types}
                columns={[
                  { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                  { header: "ارزش اسمی", render: (x) => formatAmountFa(x.faceValue), filterValue: (x) => String(x.faceValue), width: "130px" },
                ]}
                onSelect={(x) => setForm({ ...form, typeId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>تعداد</label>
              <input dir="ltr" inputMode="numeric" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value.replace(/[^\d]/g, "") })} />
            </div>
            <div className="form-field full">
              <label>یا فهرست سریال‌ها</label>
              <textarea dir="ltr" rows={4} placeholder="هر سریال در یک خط (یا با فاصله/ویرگول)" value={form.serials} onChange={(e) => setForm({ ...form, serials: e.target.value })} />
            </div>
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            {type && Number(form.count) > 0 && !form.serials.trim() && <p style={{ fontSize: 12, opacity: 0.7, gridColumn: "1 / -1" }}>مبلغ این فروش: {formatAmountFa(type.faceValue * Number(form.count))}</p>}
          </div>
        )}
      </form>
    </FormPage>
  );
}
