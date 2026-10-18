import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { RecordPickerField } from "./RecordPicker";
import { toFaDigits } from "../lib/formatAmount";

// بخش‌های فرزندِ شخص (نشانی / تلفن / حساب بانکی) به‌صورت کارت‌های زیر هم؛ همراه خودِ شخص با یک دکمه‌ی «ذخیره» ثبت می‌شوند
// (آرایه‌ی هر بخش = مجموعه‌ی کامل آن بخش؛ ردیف دارای id ویرایش، بدون id جدید، حذف‌شده از آرایه پاک می‌شود).
// «هر بخش یک اصلی»: در هر بخش فقط یک ردیف «اصلی» است؛ اگر هیچ‌کدام علامت نخورده باشد سرور ردیف اول را اصلی می‌کند.

export const ADDRESS_TYPE_FA: Record<string, string> = { HEAD_OFFICE: "دفتر مرکزی", FACTORY: "کارخانه", WAREHOUSE: "انبار", HOME: "منزل" };
export const PHONE_TYPE_FA: Record<string, string> = { MOBILE: "موبایل", HEAD_OFFICE: "دفتر مرکزی", FACTORY: "کارخانه", WAREHOUSE: "انبار", HOME: "منزل" };

export interface AddressRow {
  k: string;
  id?: number;
  type: string;
  cityId: string;
  address: string;
  postalCode: string;
  isPrimary: boolean;
}
export interface PhoneRow {
  k: string;
  id?: number;
  type: string;
  number: string;
  isPrimary: boolean;
}
export interface ContactRow {
  k: string;
  id?: number;
  name: string;
  position: string;
  mobile: string;
  phone: string;
  email: string;
  description: string;
}
export interface BankRow {
  k: string;
  id?: number;
  bankPartyId: string;
  accountNumber: string;
  iban: string;
  cardNumber: string;
}
export interface PartyChildren {
  addresses: AddressRow[];
  phones: PhoneRow[];
  /** افراد مرتبط؛ در state ذخیره‌شده‌ی قدیمی نیست (undefined = بخش دست‌نخورده) */
  contacts?: ContactRow[];
  bankAccounts: BankRow[];
}

export const EMPTY_CHILDREN: PartyChildren = { addresses: [], phones: [], contacts: [], bankAccounts: [] };

let seq = 0;
const nk = () => `n${Date.now()}_${seq++}`;

/** تبدیل پاسخ GET /parties/:id به ردیف‌های فرم */
export function childrenFromDetail(p: any): PartyChildren {
  return {
    addresses: (p.addresses || []).map((a: any) => ({ k: `a${a.id}`, id: a.id, type: a.type, cityId: String(a.cityId), address: a.address || "", postalCode: a.postalCode || "", isPrimary: !!a.isPrimary })),
    phones: (p.phones || []).map((a: any) => ({ k: `p${a.id}`, id: a.id, type: a.type, number: a.number || "", isPrimary: !!a.isPrimary })),
    contacts: (p.contacts || []).map((a: any) => ({ k: `c${a.id}`, id: a.id, name: a.name || "", position: a.position || "", mobile: a.mobile || "", phone: a.phone || "", email: a.email || "", description: a.description || "" })),
    bankAccounts: (p.bankAccounts || []).map((a: any) => ({ k: `b${a.id}`, id: a.id, bankPartyId: a.bankPartyId ? String(a.bankPartyId) : "", accountNumber: a.accountNumber || "", iban: a.iban || "", cardNumber: a.cardNumber || "" })),
  };
}

/** بدنه‌ی ارسال به سرور (فیلد کمکی k حذف می‌شود) */
export function childrenPayload(c: PartyChildren) {
  return {
    addresses: c.addresses.map(({ k, cityId, ...r }) => ({ ...r, cityId: cityId ? Number(cityId) : 0 })),
    phones: c.phones.map(({ k, ...r }) => r),
    contacts: c.contacts?.map(({ k, ...r }) => r),
    bankAccounts: c.bankAccounts.map(({ k, bankPartyId, ...r }) => ({ ...r, bankPartyId: bankPartyId ? Number(bankPartyId) : null })),
  };
}

/** اعتبارسنجی سمت کاربر (سرور مرجع است) */
export function validateChildren(c: PartyChildren): string | null {
  for (const [i, a] of c.addresses.entries()) if (!a.cityId) return `نشانی ردیف ${toFaDigits(String(i + 1))}: انتخاب شهر الزامی است`;
  for (const [i, p] of c.phones.entries()) if (!p.number.trim()) return `تلفن ردیف ${toFaDigits(String(i + 1))}: شماره الزامی است`;
  for (const [i, x] of (c.contacts ?? []).entries()) {
    if (!x.name.trim()) return `فرد مرتبط ردیف ${toFaDigits(String(i + 1))}: نام الزامی است`;
    if (x.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email.trim())) return `فرد مرتبط ردیف ${toFaDigits(String(i + 1))}: ایمیل نامعتبر است`;
  }
  for (const [i, b] of c.bankAccounts.entries()) if (!b.accountNumber.trim() && !b.iban.trim() && !b.cardNumber.trim()) return `حساب بانکی ردیف ${toFaDigits(String(i + 1))}: حداقل یکی از شماره حساب، شبا یا شماره کارت لازم است`;
  return null;
}

export const PARTY_SECTION_IDS = { main: "party-sec-main", address: "party-sec-address", phone: "party-sec-phone", contact: "party-sec-contact", bank: "party-sec-bank" };

/** چیپ‌های پرش به بخش‌ها (بالای فرم) */
export function PartySectionNav({ counts }: { counts: { address: number; phone: number; contact: number; bank: number } }) {
  const items: [string, string, number | null][] = [
    [PARTY_SECTION_IDS.main, "اطلاعات اصلی", null],
    [PARTY_SECTION_IDS.address, "نشانی‌ها", counts.address],
    [PARTY_SECTION_IDS.phone, "تلفن‌ها", counts.phone],
    [PARTY_SECTION_IDS.contact, "افراد مرتبط", counts.contact],
    [PARTY_SECTION_IDS.bank, "حساب‌های بانکی", counts.bank],
  ];
  return (
    <div className="party-nav-chips">
      {items.map(([id, label, n]) => (
        <button key={id} type="button" className="party-nav-chip" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          {label}
          {n ? <span className="party-nav-count">{toFaDigits(String(n))}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** کارت یک بخش */
export function PartySectionCard({ id, title, onAdd, addLabel, children }: { id: string; title: string; onAdd?: () => void; addLabel?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="party-section-card">
      <div className="party-section-head">
        <h3>{title}</h3>
        {onAdd && (
          <button type="button" className="btn secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={onAdd}>
            + {addLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function RowShell({ index, onRemove, children }: { index: number; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="party-row">
      <div className="party-row-head">
        <span className="badge">{toFaDigits(String(index + 1))}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn danger" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={onRemove}>
          حذف
        </button>
      </div>
      <div className="form-grid">{children}</div>
    </div>
  );
}

/** تنها یک ردیف اصلی: انتخاب یکی بقیه را برمی‌دارد */
function setPrimary<T extends { k: string; isPrimary: boolean }>(rows: T[], k: string, on: boolean): T[] {
  return rows.map((r) => ({ ...r, isPrimary: on ? r.k === k : r.k === k ? false : r.isPrimary }));
}

export function PartySections({ value, onChange }: { value: PartyChildren; onChange: (v: PartyChildren) => void }) {
  const [cities, setCities] = useState<{ id: number; title: string }[]>([]);
  const [banks, setBanks] = useState<{ id: number; detailCode: string; name: string }[]>([]);

  useEffect(() => {
    api.get("/geo-regions").then((all: any[]) => setCities(all.filter((r) => r.level === "CITY"))).catch(() => {});
    api.get("/parties?category=LEGAL").then((p: any[]) => setBanks(p.filter((x) => x.legalType === "BANK"))).catch(() => {});
  }, []);

  const { addresses, phones, bankAccounts } = value;
  const contacts = value.contacts ?? [];
  const upd = (patch: Partial<PartyChildren>) => onChange({ ...value, ...patch });

  return (
    <>
      <PartySectionCard
        id={PARTY_SECTION_IDS.address}
        title="نشانی‌ها"
        addLabel="نشانی جدید"
        onAdd={() => upd({ addresses: [...addresses, { k: nk(), type: "HEAD_OFFICE", cityId: "", address: "", postalCode: "", isPrimary: addresses.length === 0 }] })}
      >
        {addresses.length === 0 && <div className="party-empty">نشانی ثبت نشده است.</div>}
        {addresses.map((a, i) => {
          const set = (patch: Partial<AddressRow>) => upd({ addresses: addresses.map((x) => (x.k === a.k ? { ...x, ...patch } : x)) });
          return (
            <RowShell key={a.k} index={i} onRemove={() => upd({ addresses: addresses.filter((x) => x.k !== a.k) })}>
              <div className="form-field">
                <label>نوع نشانی</label>
                <select value={a.type} onChange={(e) => set({ type: e.target.value })}>
                  {Object.entries(ADDRESS_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>شهر</label>
                <select value={a.cityId} onChange={(e) => set({ cityId: e.target.value })}>
                  <option value="">انتخاب کنید</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>کد پستی</label>
                <input dir="ltr" value={a.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="checkbox-row">
                  <input type="checkbox" checked={a.isPrimary} onChange={(e) => upd({ addresses: setPrimary(addresses, a.k, e.target.checked) })} />
                  نشانی اصلی
                </label>
              </div>
              <div className="form-field full">
                <label>نشانی</label>
                <input value={a.address} onChange={(e) => set({ address: e.target.value })} />
              </div>
            </RowShell>
          );
        })}
      </PartySectionCard>

      <PartySectionCard
        id={PARTY_SECTION_IDS.phone}
        title="تلفن‌ها"
        addLabel="تلفن جدید"
        onAdd={() => upd({ phones: [...phones, { k: nk(), type: "MOBILE", number: "", isPrimary: phones.length === 0 }] })}
      >
        {phones.length === 0 && <div className="party-empty">تلفنی ثبت نشده است.</div>}
        {phones.map((p, i) => {
          const set = (patch: Partial<PhoneRow>) => upd({ phones: phones.map((x) => (x.k === p.k ? { ...x, ...patch } : x)) });
          return (
            <RowShell key={p.k} index={i} onRemove={() => upd({ phones: phones.filter((x) => x.k !== p.k) })}>
              <div className="form-field">
                <label>نوع تلفن</label>
                <select value={p.type} onChange={(e) => set({ type: e.target.value })}>
                  {Object.entries(PHONE_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>شماره تلفن</label>
                <input dir="ltr" value={p.number} onChange={(e) => set({ number: e.target.value })} />
              </div>
              <div className="form-field">
                <label className="checkbox-row">
                  <input type="checkbox" checked={p.isPrimary} onChange={(e) => upd({ phones: setPrimary(phones, p.k, e.target.checked) })} />
                  تلفن اصلی
                </label>
              </div>
            </RowShell>
          );
        })}
      </PartySectionCard>

      <PartySectionCard
        id={PARTY_SECTION_IDS.contact}
        title="افراد مرتبط"
        addLabel="فرد مرتبط جدید"
        onAdd={() => upd({ contacts: [...contacts, { k: nk(), name: "", position: "", mobile: "", phone: "", email: "", description: "" }] })}
      >
        {contacts.length === 0 && <div className="party-empty">فرد مرتبطی ثبت نشده است.</div>}
        {contacts.map((c, i) => {
          const set = (patch: Partial<ContactRow>) => upd({ contacts: contacts.map((x) => (x.k === c.k ? { ...x, ...patch } : x)) });
          return (
            <RowShell key={c.k} index={i} onRemove={() => upd({ contacts: contacts.filter((x) => x.k !== c.k) })}>
              <div className="form-field">
                <label>نام</label>
                <input value={c.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>سمت</label>
                <input value={c.position} onChange={(e) => set({ position: e.target.value })} />
              </div>
              <div className="form-field">
                <label>موبایل</label>
                <input dir="ltr" value={c.mobile} onChange={(e) => set({ mobile: e.target.value })} />
              </div>
              <div className="form-field">
                <label>تلفن</label>
                <input dir="ltr" value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="form-field">
                <label>ایمیل</label>
                <input dir="ltr" value={c.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="form-field full">
                <label>توضیحات (برای پیگیری)</label>
                <input value={c.description} onChange={(e) => set({ description: e.target.value })} />
              </div>
            </RowShell>
          );
        })}
      </PartySectionCard>

      <PartySectionCard
        id={PARTY_SECTION_IDS.bank}
        title="حساب‌های بانکی"
        addLabel="حساب بانکی جدید"
        onAdd={() => upd({ bankAccounts: [...bankAccounts, { k: nk(), bankPartyId: "", accountNumber: "", iban: "", cardNumber: "" }] })}
      >
        {bankAccounts.length === 0 && <div className="party-empty">حساب بانکی ثبت نشده است.</div>}
        {bankAccounts.map((b, i) => {
          const set = (patch: Partial<BankRow>) => upd({ bankAccounts: bankAccounts.map((x) => (x.k === b.k ? { ...x, ...patch } : x)) });
          const bank = banks.find((x) => String(x.id) === b.bankPartyId);
          return (
            <RowShell key={b.k} index={i} onRemove={() => upd({ bankAccounts: bankAccounts.filter((x) => x.k !== b.k) })}>
              <div className="form-field">
                <label>بانک</label>
                <RecordPickerField
                  title="انتخاب بانک"
                  displayValue={bank ? `${toFaDigits(bank.detailCode)} — ${bank.name}` : ""}
                  rows={banks}
                  columns={[
                    { header: "کد", render: (x) => toFaDigits(x.detailCode), filterValue: (x) => x.detailCode, width: "90px" },
                    { header: "نام", render: (x) => x.name, filterValue: (x) => x.name },
                  ]}
                  onSelect={(x) => set({ bankPartyId: String(x.id) })}
                  onClear={() => set({ bankPartyId: "" })}
                />
              </div>
              <div className="form-field">
                <label>شماره حساب</label>
                <input dir="ltr" value={b.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} />
              </div>
              <div className="form-field">
                <label>شبا (IBAN)</label>
                <input dir="ltr" value={b.iban} onChange={(e) => set({ iban: e.target.value })} />
              </div>
              <div className="form-field">
                <label>شماره کارت</label>
                <input dir="ltr" value={b.cardNumber} onChange={(e) => set({ cardNumber: e.target.value })} />
              </div>
            </RowShell>
          );
        })}
      </PartySectionCard>
    </>
  );
}
