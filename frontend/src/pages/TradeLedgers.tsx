import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, downloadFile } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

// «دفاتر تجاری» (امور مالیاتی › عملیات): گروهی از اسناد تجمیعی یک بازه + خروجی CSV (فرمت نمونه: Documents/TaxLedger.CSV).
// وضعیت: پیش‌نویس ⇄ تاییدشده؛ دفتر تاییدشده حذف نمی‌شود و سند تجمیعیِ ثبت‌شده در دفتر هم (در بک‌اند کنترل می‌شود).

interface TradeLedger {
  id: number;
  number: number;
  fromDate: string;
  toDate: string;
  status: "DRAFT" | "APPROVED";
  documentCount: number;
  totalDebit: string;
  totalCredit: string;
}

interface LedgerItem {
  number: number;
  date: string;
  kolCode: string;
  kolTitle: string;
  description: string;
  debit: string;
  credit: string;
}

const LIST_PATH = "/trade-ledgers";
const STATUS_FA = { DRAFT: "پیش‌نویس", APPROVED: "تاییدشده" } as const;

export default function TradeLedgers() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <IssueForm />;
  if (location.pathname.endsWith("/edit")) return <LedgerView id={Number(id)} />;
  return <LedgerList />;
}

function LedgerList() {
  const [items, setItems] = useState<TradeLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setItems(await api.get("/trade-ledgers"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="دفاتر تجاری" text="فهرست دفاتر تجاریِ دوره مالی جاری. با «جدید» اسناد تجمیعیِ بعد از آخرین دفتر تا تاریخ دلخواه در یک دفتر ثبت می‌شوند و خروجی CSV از داخل دفتر قابل دانلود است." />
          <NewRecordButton path={`${LIST_PATH}/new`} />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable<TradeLedger>
          columns={[
            { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "90px", filterType: "number", filterValue: (r) => r.number },
            { header: "از تاریخ", render: (r) => formatJalaliDate(r.fromDate), width: "120px", filterType: "date", filterValue: (r) => r.fromDate.slice(0, 10) },
            { header: "تا تاریخ", render: (r) => formatJalaliDate(r.toDate), width: "120px", filterType: "date", filterValue: (r) => r.toDate.slice(0, 10) },
            { header: "تعداد اسناد تجمیعی", render: (r) => toFaDigits(String(r.documentCount)), width: "140px", filterType: "number", filterValue: (r) => r.documentCount },
            { header: "جمع بدهکار", render: (r) => formatAmountFa(Number(r.totalDebit)), filterType: "number", filterValue: (r) => Number(r.totalDebit), decimal: true },
            { header: "جمع بستانکار", render: (r) => formatAmountFa(Number(r.totalCredit)), filterType: "number", filterValue: (r) => Number(r.totalCredit), decimal: true },
            { header: "وضعیت", render: (r) => STATUS_FA[r.status], width: "110px", filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
          ]}
          rows={items}
          edit={{ path: (r) => `${LIST_PATH}/${r.id}/edit` }}
          onDelete={async (r) => {
            try {
              await api.del(`/trade-ledgers/${r.id}`);
            } catch (e: any) {
              showError(e.message);
            }
            await load();
          }}
          emptyText="هنوز دفتر تجاری تهیه نشده است"
        />
      )}
    </div>
  );
}

/** «جدید» = تهیه‌ی دفتر: از تاریخ خودکار و غیرقابل ویرایش، تا تاریخ را کاربر تعیین می‌کند */
function IssueForm() {
  const navigate = useNavigate();
  const { flash } = useSavedFlash();
  const [toDate, setToDate] = usePersistedState("form:/trade-ledgers/new:toDate", "");
  const [fromDate, setFromDate] = useState<string>("");
  const [period, setPeriod] = useState("");
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [created, setCreated] = useState<{ id: number; number: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/trade-ledgers/status")
      .then((s: any) => {
        setFromDate(s.fromDate);
        setPeriod(s.fiscalPeriodTitle);
      })
      .catch((e: any) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (created) return;
    if (!toDate) return showError("تاریخ پایان را وارد کنید");
    try {
      const r = await api.post("/trade-ledgers", { toDate });
      setCreated({ id: r.id, number: r.number });
      setItems(await api.get(`/trade-ledgers/${r.id}/items`));
      flash(`دفتر تجاری شماره ${toFaDigits(String(r.number))} با ${toFaDigits(String(r.documentCount))} سند تجمیعی ثبت شد`);
    } catch (err: any) {
      showError(err?.message || "ثبت دفتر تجاری انجام نشد");
    }
  }

  return (
    <FormPage title="دفتر تجاری جدید" formId="trade-ledger-form" closePath={LIST_PATH}>
      <ErrorToast message={error} />
      <form id="trade-ledger-form" onSubmit={onSubmit}>
        {period && <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>دوره مالی جاری: {period}</p>}
        <div className="form-grid" style={{ maxWidth: 560 }}>
          <div className="form-field">
            <label>از تاریخ</label>
            <input disabled dir="ltr" value={fromDate ? formatJalaliDate(fromDate) : ""} />
          </div>
          <div className="form-field">
            <label>تا تاریخ<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={toDate} onChange={setToDate} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={!!created}>ثبت دفتر</button>
        </div>
      </form>
      <ItemsGrid items={items} />
    </FormPage>
  );
}


/** آیتم‌های دفتر (قالب خروجی CSV): سرستون‌ها همیشه هست، حتی قبل از ثبت دفتر یا هنگام بارگذاری */
function ItemsGrid({ items }: { items: LedgerItem[] }) {
  return (
    <>
      <h4 style={{ margin: "18px 0 8px" }}>آیتم‌ها (قالب خروجی CSV)</h4>
      <div className="card grid-scroll-area" style={{ maxHeight: 420, overflowX: "auto", overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ردیف</th><th>تاریخ</th><th>کد حساب کل</th><th>عنوان حساب کل</th><th>کد حساب معین</th><th>عنوان حساب معین</th><th>شرح</th><th>مبلغ بدهکار (ریال)</th><th>مبلغ بستانکار (ریال)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i}>
                <td>{toFaDigits(String(r.number))}</td>
                <td>{toFaDigits(r.date)}</td>
                <td>{toFaDigits(r.kolCode)}</td>
                <td>{r.kolTitle}</td>
                <td></td>
                <td></td>
                <td>{r.description}</td>
                <td>{formatAmountFa(Number(r.debit))}</td>
                <td>{formatAmountFa(Number(r.credit))}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-soft)" }}>آیتمی وجود ندارد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LedgerView({ id }: { id: number }) {
  const navigate = useNavigate();
  const [ledger, setLedger] = useState<TradeLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);

  async function load() {
    try {
      setItems(await api.get(`/trade-ledgers/${id}/items`));
      setLedger(await api.get(`/trade-ledgers/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      showToast(ok);
      await load();
    } catch (e: any) {
      showError(e.message);
    }
  }

  const approved = ledger?.status === "APPROVED";
  const actions = !ledger ? [] : [
    approved
      ? { label: "لغو تایید", icon: <UndoIcon />, onClick: () => run(() => api.post(`/trade-ledgers/${id}/unapprove`, {}), "تایید دفتر لغو شد") }
      : { label: "تایید", icon: <CheckIcon />, onClick: () => run(() => api.post(`/trade-ledgers/${id}/approve`, {}), "دفتر تجاری تایید شد") },
    ...(approved ? [{
      label: "دانلود CSV",
      icon: <DownloadIcon />,
      onClick: async () => {
        try {
          await downloadFile(`/trade-ledgers/${id}/csv`, `TaxLedger-${ledger?.number}.csv`);
          showToast("فایل CSV دانلود شد");
        } catch (e: any) {
          showError(e.message);
        }
      },
    }] : []),
  ];

  return (
    <FormPage
      title={ledger ? `دفتر تجاری ${toFaDigits(String(ledger.number))}` : "دفتر تجاری"}
      closePath={LIST_PATH}
      saveDisabled
      extraActions={actions}
      onDelete={!ledger || approved ? undefined : async () => {
        try {
          await api.del(`/trade-ledgers/${id}`);
          navigate(LIST_PATH);
        } catch (e: any) {
          showError(e.message);
        }
      }}
    >
      <ErrorToast message={error} />
      <div className="form-grid" style={{ maxWidth: 760 }}>
        <div className="form-field">
          <label>شماره</label>
          <input disabled dir="ltr" value={ledger ? toFaDigits(String(ledger.number)) : ""} />
        </div>
        <div className="form-field">
          <label>وضعیت</label>
          <input disabled value={ledger ? STATUS_FA[ledger.status] : ""} />
        </div>
        <div className="form-field">
          <label>از تاریخ</label>
          <input disabled dir="ltr" value={ledger ? formatJalaliDate(ledger.fromDate) : ""} />
        </div>
        <div className="form-field">
          <label>تا تاریخ</label>
          <input disabled dir="ltr" value={ledger ? formatJalaliDate(ledger.toDate) : ""} />
        </div>
        <div className="form-field">
          <label>تعداد اسناد تجمیعی</label>
          <input disabled dir="ltr" value={ledger ? toFaDigits(String(ledger.documentCount)) : ""} />
        </div>
        <div className="form-field" />
        <div className="form-field">
          <label>جمع بدهکار</label>
          <input disabled dir="ltr" value={ledger ? formatAmountFa(Number(ledger.totalDebit)) : ""} />
        </div>
        <div className="form-field">
          <label>جمع بستانکار</label>
          <input disabled dir="ltr" value={ledger ? formatAmountFa(Number(ledger.totalCredit)) : ""} />
        </div>
      </div>
      <ItemsGrid items={items} />
    </FormPage>
  );
}
