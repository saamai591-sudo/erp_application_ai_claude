import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// ماژول «خزانه‌داری» > چک‌ها. طبق تصمیم صریح کاربر، چک یک موجودیت مستقل با چرخه‌ی عمر خودش است
// (نگاه کنید به backend/src/routes/cheques.ts). این صفحه صرفاً فهرست/مشاهده و «ابطال» تکی (پیش از
// واگذاری/صدور مؤثر) را پوشش می‌دهد. واگذاری به بانک، برگشت از واگذاری، و نتیجه‌ی وصول/برگشت هرکدام
// سند دسته‌ای مستقل خودشان را دارند (ChequeDeposits.tsx / ChequeDepositReturns.tsx /
// ChequeClearingReceivable.tsx / ChequeClearingPayable.tsx) — چون معمولاً چند چک با هم پردازش
// می‌شوند و ممکن است در آینده سند حسابداری بگیرند.
//
// اصلاح یک ردیف چک (فاز ۲.۲): دیگر از این صفحه انجام نمی‌شود — چون هر چک یک شمارنده‌ی نسخه (step)
// دارد، اصلاح شماره/سررسید/مبلغ یک چک اکنون مستقیماً از همان سند مادرِ «تایید»شده (رسید/پرداخت/
// واگذاری/برگشت از واگذاری/نتیجه‌ی وصول‌وبرگشت) و فقط برای همان ردیف انجام می‌شود، بدون این‌که کل
// سند مادر از تایید خارج شود («سند نیمه‌باز»). نگاه کنید به توضیح بالای هرکدام از فایل‌های
// backend/src/routes/receipts.ts, payments.ts, chequeDeposits.ts, chequeDepositReturns.ts,
// chequeClearingReceivable.ts, chequeClearingPayable.ts.

type ChequeDirection = "RECEIVABLE" | "PAYABLE";
type ChequeStatus = "IN_HAND" | "IN_COLLECTION" | "ISSUED" | "CLEARED" | "BOUNCED" | "ENDORSED" | "CANCELLED";

const DIRECTION_FA: Record<ChequeDirection, string> = { RECEIVABLE: "دریافتنی", PAYABLE: "پرداختنی" };
const STATUS_FA: Record<ChequeStatus, string> = {
  IN_HAND: "در دست",
  IN_COLLECTION: "واگذار به وصول",
  ISSUED: "صادرشده",
  CLEARED: "وصول‌شده",
  BOUNCED: "برگشتی",
  ENDORSED: "خرج‌شده (ظهرنویسی)",
  CANCELLED: "ابطال‌شده",
};
// فقط ابطال پیش از واگذاری/وصول از این صفحه مجاز است؛ بقیه‌ی انتقال‌ها از فرم‌های دسته‌ای مربوطه انجام می‌شوند.
const MANUAL_TRANSITIONS: Record<ChequeStatus, ChequeStatus[]> = {
  IN_HAND: ["CANCELLED"],
  ISSUED: ["CANCELLED"],
  IN_COLLECTION: [],
  CLEARED: [],
  BOUNCED: [],
  ENDORSED: [],
  CANCELLED: [],
};

interface ListRow {
  id: number;
  direction: ChequeDirection;
  number: string;
  dueDate: string;
  bankBranchTitle: string | null;
  partyDisplay: string;
  amount: number;
  currencyTitle: string;
  status: ChequeStatus;
  description: string | null;
}
interface RefDoc { id: number; number: number }
interface Detail extends ListRow {
  ownerBankAccountNumber: string | null;
  createdAt: string;
  createdByReceipts: RefDoc[];
  usedInPayments: RefDoc[];
  deposits: RefDoc[];
  depositReturns: RefDoc[];
  clearingReceivables: RefDoc[];
  clearingPayables: RefDoc[];
}

function infoText() {
  return (
    "فهرست چک‌های دریافتنی و پرداختنی سیستم. چک دریافتنی از تایید سند دریافت و چک پرداختنی از تایید سند پرداخت " +
    "ایجاد می‌شود. واگذاری به بانک، برگشت از واگذاری، و ثبت نتیجه‌ی وصول/برگشت هرکدام سند دسته‌ای مستقل خودشان را " +
    "دارند (زیر همین منو). برای اصلاح شماره/سررسید/مبلغ یک چک، همان سند مادرش را باز کنید — اگر آن سند «تایید» " +
    "شده باشد و چک از زمان آن سند تغییر نکرده باشد، همان ردیف بدون برگشت از تایید کل سند قابل اصلاح است. از این " +
    "صفحه فقط می‌توان چک را پیش از واگذاری/وصول ابطال کرد."
  );
}

export default function Cheques() {
  const { id } = useParams();
  if (id) return <ChequeDetail id={Number(id)} />;
  return <ChequeList />;
}

function ChequeList() {
  const cacheKey = "/cheques";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/cheques"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="چک‌ها" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره چک", render: (r) => r.number, filterType: "string", filterValue: (r) => r.number },
          { header: "نوع", render: (r) => DIRECTION_FA[r.direction], filterType: "string", filterValue: (r) => DIRECTION_FA[r.direction] },
          { header: "سررسید", render: (r) => formatJalaliDate(r.dueDate), filterType: "date", filterValue: (r) => r.dueDate.slice(0, 10) },
          { header: "طرف حساب", render: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
          { header: "شعبه بانک", render: (r) => r.bankBranchTitle || "—", filterType: "string", filterValue: (r) => r.bankBranchTitle || "" },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount), filterType: "number", filterValue: (r) => r.amount, decimal: true },
          { header: "ارز", render: (r) => r.currencyTitle, filterType: "string", filterValue: (r) => r.currencyTitle },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/cheques/${r.id}` }}
      />
    </div>
  );
}

function RefBadgeList({ title, docs, basePath, navigate }: { title: string; docs: RefDoc[]; basePath: string; navigate: (p: string) => void }) {
  if (docs.length === 0) return null;
  return (
    <div className="form-field full">
      <label>{title}</label>
      <div>
        {docs.map((d) => (
          <span key={d.id} className="badge" style={{ marginInlineEnd: 6, cursor: "pointer" }} onClick={() => navigate(`${basePath}/${d.id}`)}>
            {toFaDigits(String(d.number))}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChequeDetail({ id }: { id: number }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setDetail(await api.get(`/cheques/${id}`));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function transition(toStatus: ChequeStatus) {
    if (!window.confirm(`چک شماره ${detail?.number} به وضعیت «${STATUS_FA[toStatus]}» تغییر کند؟`)) return;
    try {
      await api.post(`/cheques/${id}/transition`, { toStatus });
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!detail) return null;

  const allowedNext = MANUAL_TRANSITIONS[detail.status] || [];

  return (
    <FormPage
      title={`چک شماره ${detail.number}`}
      closePath="/cheques"
      saveDisabled
      extraActions={allowedNext.map((s) => ({ label: `ابطال چک`, onClick: () => transition(s) }))}
      wide
    >
      <ErrorToast message={error} />
      <div className="je-header-grid" style={{ maxWidth: 900 }}>
        <div className="form-field">
          <label>نوع</label>
          <input value={DIRECTION_FA[detail.direction]} disabled />
        </div>
        <div className="form-field">
          <label>وضعیت</label>
          <div><span className="badge">{STATUS_FA[detail.status]}</span></div>
        </div>
        <div className="form-field">
          <label>سررسید</label>
          <input value={formatJalaliDate(detail.dueDate)} disabled />
        </div>
        <div className="form-field">
          <label>طرف حساب</label>
          <input value={detail.partyDisplay} disabled />
        </div>
        <div className="form-field">
          <label>شعبه بانک</label>
          <input value={detail.bankBranchTitle || "—"} disabled />
        </div>
        <div className="form-field">
          <label>حساب بانکی صادرکننده</label>
          <input value={detail.ownerBankAccountNumber || "—"} disabled />
        </div>
        <div className="form-field">
          <label>مبلغ</label>
          <input value={formatAmountFa(detail.amount)} disabled />
        </div>
        <div className="form-field">
          <label>ارز</label>
          <input value={detail.currencyTitle} disabled />
        </div>
        <div className="form-field full">
          <label>شرح</label>
          <input value={detail.description || "—"} disabled />
        </div>
        <RefBadgeList title="ایجادشده توسط سند دریافت" docs={detail.createdByReceipts} basePath="/receipts" navigate={(p) => navigate(`${p}/edit`)} />
        <RefBadgeList title="استفاده‌شده در سند پرداخت" docs={detail.usedInPayments} basePath="/payments" navigate={(p) => navigate(`${p}/edit`)} />
        <RefBadgeList title="واگذاری به بانک" docs={detail.deposits} basePath="/cheque-deposits" navigate={(p) => navigate(`${p}/edit`)} />
        <RefBadgeList title="برگشت از واگذاری" docs={detail.depositReturns} basePath="/cheque-deposit-returns" navigate={(p) => navigate(`${p}/edit`)} />
        <RefBadgeList title="نتیجه وصول/برگشت (دریافتنی)" docs={detail.clearingReceivables} basePath="/cheque-clearings-receivable" navigate={(p) => navigate(`${p}/edit`)} />
        <RefBadgeList title="نتیجه وصول/برگشت (پرداختنی)" docs={detail.clearingPayables} basePath="/cheque-clearings-payable" navigate={(p) => navigate(`${p}/edit`)} />
      </div>
    </FormPage>
  );
}
