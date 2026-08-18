import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
}

interface PurchaseGroupOption {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
}

export interface PurchaseExpert {
  id: number;
  code: number;
  partyId: number;
  party: PartyOption;
  isActive: boolean;
  hasTransactions: boolean;
  groupIds: number[];
  groups: { id: number; code: number; title: string }[];
}

function partyDisplayName(p: PartyOption): string {
  return `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export default function PurchaseExperts() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchaseExpertForm />;
  if (isEdit) return <PurchaseExpertForm editId={Number(id)} />;
  return <PurchaseExpertList />;
}

function PurchaseExpertList() {
  const cacheKey = "/purchase-experts";
  const [items, setItems] = usePersistedState<PurchaseExpert[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/purchase-experts").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PurchaseExpert) {
    try {
      await api.del(`/purchase-experts/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>کارشناس خرید</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف کارشناسان خرید" title="کارشناس خرید" />
          <NewRecordButton path="/purchase-experts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => partyDisplayName(r.party), filterType: "string", filterValue: (r) => partyDisplayName(r.party) },
          { header: "گروه‌های خرید", render: (r) => (r.groups.length ? r.groups.map((g) => g.title).join("، ") : "—") },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/purchase-experts/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface GroupRowState {
  purchaseGroupId: string;
}

const DEFAULT_FORM = { code: "", partyId: "", isActive: true };

function PurchaseExpertForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [allExperts, setAllExperts] = useState<PurchaseExpert[]>([]);
  const [allGroups, setAllGroups] = useState<PurchaseGroupOption[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [groupRows, setGroupRows] = usePersistedState<GroupRowState[]>(`${cacheKey}:groups`, []);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/parties?category=INDIVIDUAL").then((p: PartyOption[]) => setParties(p.filter((x) => x.isActive))).catch(() => {});
    api.get("/purchase-experts").then((e: PurchaseExpert[]) => setAllExperts(e)).catch(() => {});
    api.get("/purchase-groups").then((g: PurchaseGroupOption[]) => setAllGroups(g)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setGroupRows([]);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/purchase-experts").then((items: PurchaseExpert[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({ code: String(found.code), partyId: String(found.partyId), isActive: found.isActive });
        setGroupRows(found.groupIds.map((id) => ({ purchaseGroupId: String(id) })));
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedParty = parties.find((p) => String(p.id) === form.partyId);
  // طرف‌حساب‌هایی که در حال حاضر کارشناس خرید دیگری هستند (به جز خود این رکورد در حالت ویرایش) قابل انتخاب نیستند
  const takenPartyIds = new Set(allExperts.filter((e) => e.id !== editId).map((e) => e.partyId));
  const availableParties = parties.filter((p) => !takenPartyIds.has(p.id));
  const activeGroups = allGroups.filter((g) => g.isActive);

  function addGroupRow() {
    setGroupRows((prev) => [...prev, { purchaseGroupId: "" }]);
  }
  function removeGroupRow(idx: number) {
    setGroupRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateGroupRow(idx: number, purchaseGroupId: string) {
    setGroupRows((prev) => prev.map((r, i) => (i === idx ? { purchaseGroupId } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.partyId) return setError("عنوان (طرف حساب) الزامی است");
    const groupIds = groupRows.filter((r) => r.purchaseGroupId).map((r) => Number(r.purchaseGroupId));
    const body = { code: form.code ? Number(form.code) : undefined, partyId: Number(form.partyId), isActive: form.isActive, groupIds };
    try {
      if (editId) {
        await api.put(`/purchase-experts/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-experts", body);
        flash();
        navigate(`/purchase-experts/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-experts/${editId}`);
      navigate("/purchase-experts");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش کارشناس خرید" : "کارشناس خرید جدید"}
      formId="purchase-expert-form"
      closePath="/purchase-experts"
      newPath="/purchase-experts/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="purchase-expert-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>
              عنوان
              {hasTransactions && <FieldHint label="عنوان" text="این کارشناس خرید گردش دارد و طرف حساب آن قابل تغییر نیست" />}
            </label>
            <RecordPickerField
              title="انتخاب طرف حساب (شخص حقیقی)"
              disabled={hasTransactions}
              displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
              rows={availableParties}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
              ]}
              onSelect={(p) => setForm({ ...form, partyId: String(p.id) })}
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>

        <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
          <span className="je-lines-title">گروه‌های خرید</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addGroupRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>گروه خرید</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((row, idx) => {
                  const group = allGroups.find((g) => String(g.id) === row.purchaseGroupId);
                  const pickerRows = activeGroups.filter(
                    (g) => g.id === group?.id || !groupRows.some((r, i) => i !== idx && r.purchaseGroupId === String(g.id))
                  );
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 220 }}>
                        <RecordPickerField
                          title="انتخاب گروه خرید"
                          displayValue={group ? `${toFaDigits(String(group.code))} — ${group.title}` : ""}
                          rows={pickerRows}
                          columns={[
                            { header: "کد", render: (g) => toFaDigits(String(g.code)), filterValue: (g) => String(g.code), width: "80px" },
                            { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                          ]}
                          onSelect={(g) => updateGroupRow(idx, String(g.id))}
                        />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeGroupRow(idx)}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{groupRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(groupRows.length))} ردیف`}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
