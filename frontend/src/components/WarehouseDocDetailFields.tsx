import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DetailValues, DocDetailConfig } from "../lib/warehouseDocDetails";
import { RecordPickerField } from "./RecordPicker";
import { toFaDigits } from "../lib/formatAmount";

// اجزای مشترک «تفصیل‌های سند انبار» برای فرم‌های سند انبار (ببینید lib/warehouseDocDetails.ts):
//  - <DocDetailHeaderFields/>: یک فیلد هدر به‌ازای هر تفصیل اضافه (داخل form-grid)
//  - <DocDetailItemHeadCells/> و <DocDetailItemCells/>: ستون‌های ردیف برای تفصیل‌های «نمایش در آیتم»

interface Option { id: string; code: string; title: string }

const optionsCache = new Map<number, Promise<Option[]>>();
function loadOptions(detailTypeId: number): Promise<Option[]> {
  let p = optionsCache.get(detailTypeId);
  if (!p) {
    p = api.get(`/detail-types/${detailTypeId}/options`).then((rows: { code: string; title: string }[]) => rows.map((r) => ({ id: r.code, code: r.code, title: r.title })));
    optionsCache.set(detailTypeId, p);
    p.catch(() => optionsCache.delete(detailTypeId));
  }
  return p;
}

function useOptions(detailTypeId: number): Option[] {
  const [rows, setRows] = useState<Option[]>([]);
  useEffect(() => {
    let alive = true;
    loadOptions(detailTypeId).then((r) => alive && setRows(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [detailTypeId]);
  return rows;
}

export function DetailPicker({ detailTypeId, title, value, onChange, disabled }: { detailTypeId: number; title: string; value: string | undefined; onChange: (code: string) => void; disabled?: boolean }) {
  const options = useOptions(detailTypeId);
  const selected = options.find((o) => o.code === value);
  return (
    <RecordPickerField<Option>
      title={`انتخاب ${title}`}
      displayValue={value ? (selected ? `${toFaDigits(selected.code)} — ${selected.title}` : toFaDigits(value)) : ""}
      rows={options}
      disabled={disabled}
      columns={[
        { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "110px" },
        { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
      ]}
      onSelect={(o) => onChange(o.code)}
      onClear={value ? () => onChange("") : undefined}
    />
  );
}

export function DocDetailHeaderFields({ config, values, onChange, disabled }: { config: DocDetailConfig | null; values: DetailValues | undefined; onChange: (detailTypeId: number, code: string) => void; disabled?: boolean }) {
  if (!config || config.items.length === 0) return null;
  return (
    <>
      {config.items.map((i) => (
        <div className="form-field" key={i.detailTypeId}>
          <label>{i.detailTypeTitle}</label>
          <DetailPicker detailTypeId={i.detailTypeId} title={i.detailTypeTitle} value={values?.[i.detailTypeId]} onChange={(c) => onChange(i.detailTypeId, c)} disabled={disabled} />
        </div>
      ))}
    </>
  );
}

export function DocDetailItemHeadCells({ config }: { config: DocDetailConfig | null }) {
  const items = (config?.items ?? []).filter((i) => i.showInItem);
  return (
    <>
      {items.map((i) => (
        <th key={i.detailTypeId}>{i.detailTypeTitle}</th>
      ))}
    </>
  );
}

export function DocDetailItemCells({ config, values, onChange, disabled }: { config: DocDetailConfig | null; values: DetailValues | undefined; onChange: (detailTypeId: number, code: string) => void; disabled?: boolean }) {
  const items = (config?.items ?? []).filter((i) => i.showInItem);
  return (
    <>
      {items.map((i) => (
        <td key={i.detailTypeId}>
          <DetailPicker detailTypeId={i.detailTypeId} title={i.detailTypeTitle} value={values?.[i.detailTypeId]} onChange={(c) => onChange(i.detailTypeId, c)} disabled={disabled} />
        </td>
      ))}
    </>
  );
}
