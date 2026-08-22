import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

export interface PricingCandidate {
  id: number;
  code: string;
  fullCode: string;
  title: string;
  accountingGroupTitle: string;
  priced: boolean;
  lastPricedPeriodTitle: string | null;
}

interface AccountingGroupOption { id: number; title: string }

const PAGE_SIZE = 100;

// طبق مستند «قیمت‌گذاری اسناد انبار» بند ۵: Dialog باید Server Side عمل کند و کل کالاهای سیستم را
// یکجا به کلاینت ارسال نکند — برخلاف سایر پیکرهای چندانتخابی این پروژه (MultiRecordPickerField) که
// کل rows را از قبل در کلاینت دارند، این کامپوننت خودش صفحه‌به‌صفحه از سرور واکشی می‌کند.
export function GoodsPricingItemPicker({
  open,
  onClose,
  reportingPeriodId,
  operation,
  initialSelected,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  reportingPeriodId: number;
  operation: "PRICE" | "REVERT";
  initialSelected: PricingCandidate[];
  onConfirm: (rows: PricingCandidate[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [accountingGroupId, setAccountingGroupId] = useState("");
  const [onlyWithFlow, setOnlyWithFlow] = useState(false);
  const [groups, setGroups] = useState<AccountingGroupOption[]>([]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PricingCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Map<number, PricingCandidate>>(new Map());

  useEffect(() => {
    if (!open) return;
    setSelectedMap(new Map(initialSelected.map((r) => [r.id, r])));
    setSearch("");
    setAccountingGroupId("");
    setOnlyWithFlow(false);
    setPage(1);
    api.get("/accounting-groups").then(setGroups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams({
      reportingPeriodId: String(reportingPeriodId),
      operation,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search.trim()) params.set("search", search.trim());
    if (accountingGroupId) params.set("accountingGroupId", accountingGroupId);
    if (onlyWithFlow) params.set("onlyWithFlow", "1");
    api
      .get(`/goods-pricing/candidates?${params.toString()}`)
      .then((d: { items: PricingCandidate[]; total: number }) => {
        setRows(d.items);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  }, [open, reportingPeriodId, operation, search, accountingGroupId, onlyWithFlow, page]);

  if (!open) return null;

  function toggleRow(row: PricingCandidate) {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.has(row.id) ? next.delete(row.id) : next.set(row.id, row);
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal title={operation === "PRICE" ? "انتخاب کالا برای قیمت‌گذاری" : "انتخاب کالا برای برگشت از قیمت‌گذاری"} onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="picker-filter-input"
          style={{ flex: 1 }}
          placeholder="جست‌وجوی کالا (عنوان یا کد کامل)..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          value={accountingGroupId}
          onChange={(e) => {
            setPage(1);
            setAccountingGroupId(e.target.value);
          }}
        >
          <option value="">همه گروه‌های حساب</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={onlyWithFlow}
            onChange={(e) => {
              setPage(1);
              setOnlyWithFlow(e.target.checked);
            }}
          />
          فقط کالاهای دارای گردش از ابتدای سال مالی
        </label>
      </div>
      <div className="picker-table-wrap">
        <table className="picker-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>کد</th>
              <th>عنوان</th>
              <th>گروه حساب</th>
              <th>آخرین دوره قیمت‌گذاری</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="empty-state" style={{ border: "none" }}>در حال بارگذاری...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state" style={{ border: "none" }}>موردی یافت نشد</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className={selectedMap.has(row.id) ? "active-list" : ""} onClick={() => toggleRow(row)} style={{ cursor: "pointer" }}>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={selectedMap.has(row.id)} onChange={() => toggleRow(row)} />
                  </td>
                  <td>{toFaDigits(row.fullCode)}</td>
                  <td>{row.title}</td>
                  <td>{row.accountingGroupTitle}</td>
                  <td>{row.lastPricedPeriodTitle || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="grid-footer">
        <span className="grid-footer-info">
          {total === 0 ? "بدون رکورد" : `نمایش صفحه ${toFaDigits(String(page))} از ${toFaDigits(String(totalPages))} — ${toFaDigits(String(total))} رکورد`}
        </span>
        <div className="grid-page-nav">
          <button type="button" className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</button>
          <button type="button" className="btn secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>بعدی</button>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={() => { onConfirm([...selectedMap.values()]); onClose(); }}>
          افزودن ({toFaDigits(String(selectedMap.size))})
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
