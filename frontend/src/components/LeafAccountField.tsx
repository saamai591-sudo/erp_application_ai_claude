import { useEffect, useMemo, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگر «حساب معین» (آخرین سطح: سطح ۳ به بعد و بدون زیرحساب) — همان فیلتر سند حسابداری؛ کد کامل = زنجیره‌ی کد والدها.

interface AccountRow { id: number; parentId: number | null; code: string; title: string; level?: { order: number } | null; detailType1?: { code: number } | null; detailType2?: { code: number } | null; detailType3?: { code: number } | null }

/** requireDetailTypeCode: فقط معین‌هایی که در یکی از سه سطح تفصیلشان این نوع تفصیل (کد نوع) را دارند، مثلاً ۲ = مرکز هزینه */
export function LeafAccountField({ value, onChange, disabled, requireDetailTypeCode }: { value: string; onChange: (id: string) => void; disabled?: boolean; requireDetailTypeCode?: number }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  useEffect(() => {
    api.get("/accounts").then(setAccounts).catch(() => setAccounts([]));
  }, []);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const leaves = useMemo(() => {
    const parentIds = new Set(accounts.map((a) => a.parentId).filter((x): x is number => x !== null));
    return accounts.filter((a) => (a.level?.order ?? 0) >= 3 && !parentIds.has(a.id) && (requireDetailTypeCode === undefined || [a.detailType1, a.detailType2, a.detailType3].some((d) => d?.code === requireDetailTypeCode)));
  }, [accounts, requireDetailTypeCode]);
  const fullCode = (a: AccountRow) => {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = byId.get(cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  };
  const selected = byId.get(Number(value));
  return (
    <RecordPickerField<AccountRow>
      title="انتخاب حساب معین"
      disabled={disabled}
      displayValue={selected ? `${toFaDigits(fullCode(selected))} - ${selected.title}` : ""}
      rows={leaves}
      columns={[
        { header: "کد", render: (a) => toFaDigits(fullCode(a)), filterValue: (a) => fullCode(a), width: "110px" },
        { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
      ]}
      onSelect={(a) => onChange(String(a.id))}
    />
  );
}
