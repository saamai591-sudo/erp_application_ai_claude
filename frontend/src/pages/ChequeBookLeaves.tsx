import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError, showToast } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RecordPickerField } from "../components/RecordPicker";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// «دسته چک» — طبق Documents/دسته چک.md. هر رکورد یک برگه‌ی چک پرداختنی مجزاست (نه کل دسته)؛ فقط
// حساب‌های بانکیِ نوعِ «دارای دسته چک» (BankAccountTypes.tsx) قابل انتخابند. وضعیت (خام/صادر شده/باطل
// شده) خودکار محاسبه می‌شود: صادر شده وقتی در سند پرداخت برای صدور چک تازه مصرف شود (نگاه کنید به
// Payments.tsx و بک‌اند routes/payments.ts)، باطل شده فقط با اکشن دستی «ابطال» از حالت خام.

const STATUS_FA: Record<string, string> = { RAW: "خام", ISSUED: "صادر شده", VOID: "باطل شده" };

interface BankAccountOption {
  id: number;
  detailCode: string;
  accountNumber: string;
  accountType: { id: number; hasChequeBook: boolean };
  bankBranch: { title: string };
}
interface ChequeBookLeaf {
  id: number;
  bankAccountId: number;
  series: string;
  number: string;
  printTemplate: string | null;
  status: "RAW" | "ISSUED" | "VOID";
  bankAccount: BankAccountOption;
}

function accountLabel(a: BankAccountOption): string {
  return `${toFaDigits(a.detailCode)} - ${a.accountNumber} — ${a.bankBranch.title}`;
}

export default function ChequeBookLeaves() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ChequeBookLeafForm />;
  if (location.pathname.endsWith("/edit")) return <ChequeBookLeafForm editId={Number(id)} />;
  return <ChequeBookLeafList />;
}

function ChequeBookLeafList() {
  const cacheKey = "/cheque-book-leaves";
  const [items, setItems] = usePersistedState<ChequeBookLeaf[]>(cacheKey, []);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  async function reload() {
    api.get("/cheque-book-leaves").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    api.get("/banking/accounts").then(setBankAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onVoid(row: ChequeBookLeaf) {
    if (!window.confirm(`برگه چک شماره ${toFaDigits(row.number)} باطل شود؟`)) return;
    try {
      await api.post(`/cheque-book-leaves/${row.id}/void`, {});
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function onDelete(row: ChequeBookLeaf) {
    try {
      await api.del(`/cheque-book-leaves/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف برگه‌های چک پرداختنیِ خام اخذشده از بانک، برای کنترل شماره‌ها هنگام صدور چک در سند پرداخت" title="دسته چک" />
          <NewRecordButton path="/cheque-book-leaves/new" />
          <button type="button" className="toolbar-icon-btn primary" onClick={() => setBulkOpen(true)} title="ایجاد دسته چک">
            <PlusIcon />
          </button>
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد حساب بانکی", render: (r) => toFaDigits(r.bankAccount.detailCode), filterType: "string", filterValue: (r) => r.bankAccount.detailCode, width: "110px" },
          { header: "حساب بانکی", render: (r) => `${r.bankAccount.accountNumber} — ${r.bankAccount.bankBranch.title}`, filterType: "string", filterValue: (r) => r.bankAccount.accountNumber },
          { header: "سری", render: (r) => r.series, filterType: "string", filterValue: (r) => r.series, width: "100px" },
          { header: "شماره", render: (r) => toFaDigits(r.number), filterType: "string", filterValue: (r) => r.number, width: "110px" },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status], width: "100px" },
          {
            header: "",
            render: (r) =>
              r.status === "RAW" ? (
                <button type="button" className="btn secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onVoid(r)}>
                  ابطال
                </button>
              ) : null,
            width: "80px",
          },
        ]}
        rows={items}
        edit={{ path: (r) => `/cheque-book-leaves/${r.id}/edit` }}
        onDelete={onDelete}
      />
      {bulkOpen && (
        <BulkCreateModal
          bankAccounts={bankAccounts.filter((a) => a.accountType.hasChequeBook)}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function VoidIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BulkCreateModal({ bankAccounts, onClose, onDone }: { bankAccounts: BankAccountOption[]; onClose: () => void; onDone: () => void }) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccountDisplay, setBankAccountDisplay] = useState("");
  const [series, setSeries] = useState("");
  const [startNumber, setStartNumber] = useState("");
  const [count, setCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setError(null);
    if (!bankAccountId) return setError("حساب بانکی الزامی است");
    if (!series) return setError("سری الزامی است");
    if (!startNumber) return setError("شماره شروع الزامی است");
    if (!(Number(count) > 0)) return setError("تعداد باید عددی مثبت باشد");
    setBusy(true);
    try {
      const res = await api.post("/cheque-book-leaves/bulk", {
        bankAccountId: Number(bankAccountId),
        series,
        startNumber,
        count: Number(count),
      });
      showToast(`${toFaDigits(String(res.count))} برگه چک ایجاد شد`);
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="ایجاد دسته چک" onClose={onClose}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <div className="form-field full">
          <label>حساب بانکی<RequiredMark /></label>
          <RecordPickerField
            title="انتخاب حساب بانکی"
            displayValue={bankAccountDisplay}
            rows={bankAccounts}
            columns={[
              { header: "کد", render: (a) => toFaDigits(a.detailCode), filterValue: (a) => a.detailCode, width: "100px" },
              { header: "شماره حساب", render: (a) => `${a.accountNumber} — ${a.bankBranch.title}`, filterValue: (a) => a.accountNumber },
            ]}
            onSelect={(a) => {
              setBankAccountId(String(a.id));
              setBankAccountDisplay(accountLabel(a));
            }}
          />
        </div>
        <div className="form-field">
          <label>سری<RequiredMark /></label>
          <input value={series} onChange={(e) => setSeries(e.target.value)} />
        </div>
        <div className="form-field">
          <label>شماره شروع<RequiredMark /></label>
          <input dir="ltr" value={startNumber} onChange={(e) => setStartNumber(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
        <div className="form-field">
          <label>تعداد<RequiredMark /></label>
          <input dir="ltr" value={count} onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={confirm} disabled={busy}>تایید</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

const DEFAULT_FORM = { bankAccountId: "", bankAccountDisplay: "", series: "", number: "", printTemplate: "" };

function ChequeBookLeafForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [status, setStatus] = useState<ChequeBookLeaf["status"]>("RAW");
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/banking/accounts").then(setBankAccounts);
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/cheque-book-leaves").then((items: ChequeBookLeaf[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setStatus(found.status);
        setForm({
          bankAccountId: String(found.bankAccountId),
          bankAccountDisplay: accountLabel(found.bankAccount),
          series: found.series,
          number: found.number,
          printTemplate: found.printTemplate || "",
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const locked = !!editId && status !== "RAW";
  const eligibleAccounts = bankAccounts.filter((a) => a.accountType.hasChequeBook);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.bankAccountId) return setError("حساب بانکی الزامی است");
    if (!form.series) return setError("سری الزامی است");
    if (!form.number) return setError("شماره الزامی است");
    const body = {
      bankAccountId: Number(form.bankAccountId),
      series: form.series,
      number: form.number,
      printTemplate: form.printTemplate || null,
    };
    try {
      if (editId) {
        await api.put(`/cheque-book-leaves/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/cheque-book-leaves", body);
        flash();
        navigate(`/cheque-book-leaves/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cheque-book-leaves/${editId}`);
      navigate("/cheque-book-leaves");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleVoid() {
    if (!editId) return;
    if (!window.confirm("این برگه چک باطل شود؟")) return;
    try {
      await api.post(`/cheque-book-leaves/${editId}/void`, {});
      setStatus("VOID");
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش برگه چک" : "برگه چک جدید"}
      formId="cheque-book-leaf-form"
      closePath="/cheque-book-leaves"
      newPath="/cheque-book-leaves/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={editId && status === "RAW" ? [{ label: "ابطال", icon: <VoidIcon />, onClick: handleVoid }] : []}
    >
      <form id="cheque-book-leaf-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          {editId && (
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
          )}
          <div className="form-field">
            <label>
              حساب بانکی
              <RequiredMark />
              <FieldHint label="حساب بانکی" text="فقط حساب‌های بانکیِ نوعِ «دارای دسته چک»" />
            </label>
            <RecordPickerField
              title="انتخاب حساب بانکی"
              disabled={locked}
              displayValue={form.bankAccountDisplay}
              rows={eligibleAccounts}
              columns={[
                { header: "کد", render: (a) => toFaDigits(a.detailCode), filterValue: (a) => a.detailCode, width: "100px" },
                { header: "شماره حساب", render: (a) => `${a.accountNumber} — ${a.bankBranch.title}`, filterValue: (a) => a.accountNumber },
              ]}
              onSelect={(a) => setForm({ ...form, bankAccountId: String(a.id), bankAccountDisplay: accountLabel(a) })}
            />
          </div>
          <div className="form-field">
            <label>سری<RequiredMark /></label>
            <input value={form.series} disabled={locked} onChange={(e) => setForm({ ...form, series: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شماره<RequiredMark /></label>
            <input dir="ltr" value={form.number} disabled={locked} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </div>
          <div className="form-field">
            <label>قالب چاپ</label>
            <input value={form.printTemplate} disabled={locked} onChange={(e) => setForm({ ...form, printTemplate: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
