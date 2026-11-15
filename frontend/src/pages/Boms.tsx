import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { GoodsItemPicker, isProducedGoods, useGoodsOptions } from "../components/GoodsItemPicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { DescriptionField } from "../components/DescriptionField";
import { DocLinesGrid } from "../components/DocLinesGrid";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// کالا و خدمت › فرمول ساخت › «فرمول ساخت (BOM)»: نسخه‌ی تاریخ‌دار فرمول یک کالای نیمه‌ساخته/محصول؛ اجزا برای «مقدار خروجی» با درصد ضایعات.
// نسخه‌ای که دستور تولید به آن وصل است قفل است (فقط شرح و فعال/غیرفعال). قواعد: backend/src/services/bomService.ts

const INFO_TEXT =
  "فرمول ساخت: اجزای لازم برای ساخت «مقدار خروجی» از یک نیمه‌ساخته/محصول. برای تغییر فرمول، نسخه‌ی جدید با تاریخ شروع جدید ثبت کنید؛ نسخه‌ی مؤثر هر تاریخ، آخرین نسخه‌ی فعال با تاریخ شروع کمتر یا مساوی آن است. نسخه‌ای که در دستور تولید استفاده شده قفل می‌شود.";

interface BomRow { id: number; number: number; outputItemCode: string; outputItemTitle: string; effectiveDate: string; lineCount: number; isActive: boolean; locked: boolean; usedCount: number }
interface LineRow { componentItemId: string; quantity: string; scrapPercent: string; note: string; costNodeId: string }
interface CostLeaf { id: number; root: string; rootTitle: string; path: string }
interface FormState { outputItemId: string; outputQuantity: string; effectiveDate: string; description: string; isActive: boolean; lines: LineRow[] }

const EMPTY: FormState = { outputItemId: "", outputQuantity: "1", effectiveDate: "", description: "", isActive: true, lines: [{ componentItemId: "", quantity: "", scrapPercent: "0", note: "", costNodeId: "" }] };

export default function Boms() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <BomForm />;
  if (location.pathname.endsWith("/edit")) return <BomForm editId={Number(id)} />;
  return <BomList />;
}

function BomList() {
  const cacheKey = "/boms";
  const [items, setItems] = usePersistedState<BomRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/boms").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: BomRow) {
    try {
      await api.del(`/boms/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="فرمول ساخت" />
          <NewRecordButton path="/boms/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: BomRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: BomRow) => r.number },
          { header: "کد کالا", render: (r: BomRow) => toFaDigits(r.outputItemCode), width: "110px", filterType: "string", filterValue: (r: BomRow) => r.outputItemCode },
          { header: "کالای خروجی", render: (r: BomRow) => r.outputItemTitle, filterType: "string", filterValue: (r: BomRow) => r.outputItemTitle },
          { header: "تاریخ شروع", render: (r: BomRow) => formatJalaliDate(r.effectiveDate), width: "120px", filterType: "string", filterValue: (r: BomRow) => formatJalaliDate(r.effectiveDate) },
          { header: "تعداد جزء", render: (r: BomRow) => toFaDigits(String(r.lineCount)), width: "90px", filterType: "number", filterValue: (r: BomRow) => r.lineCount },
          { header: "وضعیت", render: (r: BomRow) => (r.isActive ? "فعال" : "غیرفعال"), width: "90px", filterType: "string", filterValue: (r: BomRow) => (r.isActive ? "فعال" : "غیرفعال") },
          { header: "استفاده در دستور", render: (r: BomRow) => (r.usedCount ? toFaDigits(String(r.usedCount)) : "—"), width: "120px", filterType: "number", filterValue: (r: BomRow) => r.usedCount },
        ]}
        rows={items}
        edit={{ path: (r: BomRow) => `/boms/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function BomForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  // کالاهای ردیف‌ها (واحد، نوع ردیابی/کالا) از روی شناسه و دسته‌ای از سرور خوانده می‌شوند؛ فهرست کامل کالا دیگر گرفته نمی‌شود
  const goods = useGoodsOptions([form.outputItemId, ...form.lines.map((l) => l.componentItemId)]);
  const [meta, setMeta] = useState<{ number: number | null; locked: boolean; usedCount: number; updatedAt: string | null }>({ number: null, locked: false, usedCount: 0, updatedAt: null });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [leaves, setLeaves] = useState<CostLeaf[]>([]);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/boms/cost-leaves").then(setLeaves).catch(() => setLeaves([]));
  }, []);

  useEffect(() => {
    if (!editId) return;
    api.get(`/boms/${editId}`).then((b: any) => {
      setMeta({ number: b.number, locked: b.locked, usedCount: b.usedCount, updatedAt: b.updatedAt });
      if (!hasPersistedState(cacheKey)) {
        setForm({
          outputItemId: String(b.outputItemId),
          outputQuantity: String(b.outputQuantity),
          effectiveDate: b.effectiveDate,
          description: b.description,
          isActive: b.isActive,
          lines: b.lines.map((l: any) => ({ componentItemId: String(l.componentItemId), quantity: String(l.quantity), scrapPercent: String(l.scrapPercent), note: l.note, costNodeId: String(l.costNodeId) })),
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const locked = meta.locked;
  const setLine = (i: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      outputItemId: Number(form.outputItemId),
      outputQuantity: form.outputQuantity,
      effectiveDate: form.effectiveDate,
      description: form.description,
      isActive: form.isActive,
      lines: form.lines.map((l) => ({ componentItemId: Number(l.componentItemId), quantity: l.quantity, scrapPercent: l.scrapPercent === "" ? 0 : l.scrapPercent, note: l.note, costNodeId: Number(l.costNodeId) })),
      updatedAt: meta.updatedAt,
    };
    try {
      if (editId) {
        const saved = await api.put(`/boms/${editId}`, payload);
        setMeta((m) => ({ ...m, updatedAt: saved.updatedAt }));
        flash();
      } else {
        const created = await api.post("/boms", payload);
        flash();
        navigate(`/boms/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/boms/${editId}`);
      navigate("/boms");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const unitOf = (id: string) => goods.find((g) => g.id === Number(id))?.unit ?? "";
  // برگ ساختار: نیمه‌ساخته/محصول زیر «انتقالی»، ماده‌ی اولیه زیر «مواد»
  const rootFor = (isProduced: boolean) => (isProduced ? "TRANSFERRED" : "MATERIAL");
  const rootOfItem = (id: string) => {
    const g = goods.find((x) => x.id === Number(id));
    return g ? rootFor(isProducedGoods(g)) : null;
  };

  return (
    <FormPage title={editId ? `ویرایش فرمول ساخت ${meta.number ? toFaDigits(String(meta.number)) : ""}` : "فرمول ساخت جدید"} formId="bom-form" closePath="/boms" newPath="/boms/new" onDelete={editId && !locked ? handleDelete : undefined}>
      <form id="bom-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="card" style={{ padding: 8, marginBottom: 8 }}>این نسخه در {toFaDigits(String(meta.usedCount))} دستور تولید استفاده شده و قفل است؛ فقط شرح و فعال/غیرفعال تغییر می‌کند. برای تغییر فرمول نسخه‌ی جدید با تاریخ شروع جدید ثبت کنید.</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کالای خروجی (نیمه‌ساخته / محصول)<RequiredMark /></label>
            <GoodsItemPicker value={form.outputItemId} produced disabled={locked} onChange={(g) => setForm({ ...form, outputItemId: String(g.id) })} />
          </div>
          <div className="form-field">
            <label>مقدار خروجی {unitOf(form.outputItemId) && `(${unitOf(form.outputItemId)})`}<RequiredMark /></label>
            <AmountInput value={form.outputQuantity} onChange={(v) => setForm({ ...form, outputQuantity: v })} allowDecimal disabled={locked} />
          </div>
          <div className="form-field">
            <label>تاریخ شروع اعتبار<RequiredMark /></label>
            <JalaliDatePicker value={form.effectiveDate} onChange={(v) => setForm({ ...form, effectiveDate: v })} disabled={locked} />
          </div>
          <div className="form-field full">
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          </div>
          <div className="form-field">
            <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
        </div>

        <DocLinesGrid
          title="اجزا"
          count={form.lines.length}
          onAdd={!locked ? () => setForm((f) => ({ ...f, lines: [...f.lines, { componentItemId: "", quantity: "", scrapPercent: "0", note: "", costNodeId: "" }] })) : undefined}
          addTitle="جزء جدید"
        >
          <thead><tr><th style={{ width: 50 }}>#</th><th>کالا</th><th style={{ width: 80 }}>واحد</th><th style={{ width: 160 }}>مقدار</th><th style={{ width: 130 }}>ضایعات (٪)</th><th style={{ width: 220 }}>عامل بهای تمام‌شده</th><th>توضیح</th><th style={{ width: 70 }} /></tr></thead>
          <tbody>
            {form.lines.map((l, i) => (
              <tr key={i}>
                <td>{toFaDigits(String(i + 1))}</td>
                <td>
                  <GoodsItemPicker
                   
                    value={l.componentItemId}
                    disabled={locked}
                    onChange={(g) => {
                      const root = rootFor(isProducedGoods(g));
                      const cur = leaves.find((x) => x.id === Number(l.costNodeId));
                      const opts = leaves.filter((x) => x.root === root);
                      setLine(i, { componentItemId: String(g.id), costNodeId: cur && cur.root === root ? l.costNodeId : opts.length === 1 ? String(opts[0].id) : "" });
                    }}
                  />
                </td>
                <td>{unitOf(l.componentItemId)}</td>
                <td><AmountInput value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} allowDecimal disabled={locked} /></td>
                <td><AmountInput value={l.scrapPercent} onChange={(v) => setLine(i, { scrapPercent: v })} allowDecimal disabled={locked} /></td>
                <td>
                  <RecordPickerField<CostLeaf>
                    title="انتخاب عامل بهای تمام‌شده"
                    disabled={locked || !l.componentItemId}
                    displayValue={leaves.find((x) => x.id === Number(l.costNodeId))?.path ?? ""}
                    rows={leaves.filter((x) => x.root === rootOfItem(l.componentItemId))}
                    columns={[{ header: "شاخه", render: (x) => x.path, filterValue: (x) => x.path }]}
                    onSelect={(x) => setLine(i, { costNodeId: String(x.id) })}
                  />
                </td>
                <td><input value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} /></td>
                <td>{!locked && form.lines.length > 1 && <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}>حذف</button>}</td>
              </tr>
            ))}
          </tbody>
        </DocLinesGrid>
      </form>
    </FormPage>
  );
}
