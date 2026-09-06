import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, ApiError } from "./api";
import { usePersistedState, hasPersistedState } from "./usePersistedState";
import { useSavedFlash } from "./useSavedFlash";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, validateDocumentDate } from "./fiscalYearDefaultDate";

/**
 * وضعیت مشترکِ همه‌ی فرم‌های سند انبار (header/rows/meta/error/loaded + چرخه‌ی init/submit/
 * delete/finalize/revert) که قبل از این، در هر یک از ~۱۵ فرم سند انبار («رسید انبار خرید»، «مصرف
 * مرکز هزینه»، «انتقال بین انبارها» و…) جدا و با کپی/تغییر جزئی از یک الگوی مشترک نوشته می‌شد.
 * این هوک همان اسکلت را یک‌بار پیاده می‌کند؛ هر فرم فقط تفاوت‌های خودش (فیلدهای هدر/ردیف، پیکرهای
 * مبنا/تفصیل، ستون‌های گرید) را اضافه می‌کند. طبق تصمیم صریح کاربر: «هرچه مشترک است باید در پایه باشد،
 * هر سند مشترکات را از پایه به ارث ببرد».
 *
 * مسئولیت‌هایی که عمداً اینجا نیستند (چون بین فرم‌ها واقعاً متفاوت‌اند، نه فقط شکلی): واکشی داده‌های
 * کمکی مثل انبارها/کالاها/طرف‌حساب‌ها (هر فرم Endpoint و فیلتر متفاوتی دارد)، ستون‌های گرید ردیف‌ها،
 * و اعتبارسنجی‌های اختصاصی هر نوع سند — این‌ها همچنان در خودِ صفحه می‌مانند.
 */

export interface DocumentMeta {
  number: number;
  status: "REGISTERED" | "FINALIZED";
  fiscalPeriodTitle: string;
  // فیلدهای اضافه‌ی مخصوص برخی اسناد (مثلاً usedBy در انتقال بین انبارها، creationType در موجودی اول دوره)
  [extra: string]: any;
}

export interface DocumentFormConfig<Header extends Record<string, any>, Row, Detail> {
  /** بخش مسیر API، بدون اسلش ابتدایی — مثلاً "warehouse-receipts" */
  endpoint: string;
  editId?: number;
  /** نام فیلد تاریخ در Header (پیش‌فرض "date") — برای اعتبارسنجی تاریخ در بازه‌ی دوره مالی انتخاب‌شده */
  dateField?: keyof Header;
  emptyHeader: (fiscalPeriod: FiscalPeriodRange | null) => Header;
  emptyRows: () => Row[];
  mapDetailToHeader: (d: Detail) => Header;
  mapDetailToRows: (d: Detail) => Row[];
  mapDetailToMeta: (d: Detail) => DocumentMeta;
  /** واکشی‌های کمکی مخصوص همین فرم (انبارها/کالاها/طرف‌حساب‌ها و...)؛ همزمان با دوره مالی اجرا می‌شود */
  loadExtra?: () => Promise<void>;
}

export function useDocumentForm<Header extends Record<string, any>, Row, Detail = any>(
  config: DocumentFormConfig<Header, Row, Detail>
) {
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { endpoint, editId } = config;
  const dateField = (config.dateField ?? "date") as keyof Header;

  const [header, setHeader] = usePersistedState<Header>(`${cacheKey}:header`, () => config.emptyHeader(null));
  const [rows, setRows] = usePersistedState<Row[]>(`${cacheKey}:rows`, config.emptyRows);
  const [meta, setMeta] = usePersistedState<DocumentMeta | null>(`${cacheKey}:meta`, null);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [fp] = await Promise.all([fetchSelectedFiscalPeriod(), config.loadExtra ? config.loadExtra() : Promise.resolve()]);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/${endpoint}/${editId}`);
        setMeta(config.mapDetailToMeta(d));
        setHeader(config.mapDetailToHeader(d));
        setRows(config.mapDetailToRows(d));
      } else {
        setHeader(config.emptyHeader(fp));
        setRows(config.emptyRows());
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  /** بررسی الزامی‌بودن + بازه‌ی دوره مالی برای فیلد تاریخ — قبل از اعتبارسنجی‌های اختصاصی هر فرم */
  function checkDate(): string | null {
    const value = header[dateField] as any as string;
    if (!value) return "تاریخ الزامی است";
    return validateDocumentDate(value, fiscalPeriod);
  }

  /**
   * چرخه‌ی معمول ثبت/ویرایش سند: preventDefault → بررسی تاریخ (الزامی + بازه دوره مالی) → ساخت بدنه
   * (buildBody) → اعتبارسنجی اختصاصی فرم روی همان بدنه (validateBody، چون بیشتر کنترل‌های سطح ردیف
   * روی body.lines انجام می‌شوند نه rows خام) → POST یا PUT. فرم‌هایی که چرخه‌ی متفاوتی دارند (مثل نمای
   * «حسابداری انبار» در موجودی اول دوره) می‌توانند این تابع را کنار بگذارند و مستقیم از
   * header/rows/fiscalPeriod/setError خودشان استفاده کنند.
   */
  async function submit(
    e: FormEvent,
    opts: { buildBody: () => any; validateBody?: (body: any) => string | null; afterCreate?: (created: any) => void }
  ) {
    e.preventDefault();
    setError(null);
    const dateErr = checkDate();
    if (dateErr) return setError(dateErr);
    const body = opts.buildBody();
    if (opts.validateBody) {
      const err = opts.validateBody(body);
      if (err) return setError(err);
    }
    try {
      if (editId) {
        await api.put(`/${endpoint}/${editId}`, body);
        flash();
      } else {
        const created = await api.post(`/${endpoint}`, body);
        flash();
        opts.afterCreate?.(created);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  /**
   * حذف سند — طبق تصمیم کاربر، دیگر مرحله‌ی جداگانه‌ی «قطعی‌کردن»/«برگشت از قطعی» وجود ندارد؛ حذف یک
   * سند (که از لحظه‌ی ثبت اثر واقعی دارد) به‌جای نیاز به برگشت از قطعی دستیِ قبلی، مستقیماً همان
   * کنترل‌های ایمنی (موجودی منفی، آخرین‌رویداد سریال) را در بک‌اند اجرا می‌کند و یا موفق می‌شود یا با
   * پیام خطای روشن رد می‌شود — به همین دلیل مثل submit، خطا را به‌صورت درون‌خطی (error state) نشان
   * می‌دهد، نه alert() (که در مرورگرهای خودکار/تست، تب را کاملاً قفل می‌کند).
   */
  async function remove(onDone: () => void) {
    if (!editId) return;
    setError(null);
    try {
      await api.del(`/${endpoint}/${editId}`);
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return {
    cacheKey,
    header,
    setHeader,
    rows,
    setRows,
    meta,
    setMeta,
    fiscalPeriod,
    error,
    setError,
    loaded,
    saved,
    flash,
    checkDate,
    submit,
    remove,
  };
}
