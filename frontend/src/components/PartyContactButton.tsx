import { useState } from "react";
import { Modal } from "./Modal";
import { PHONE_TYPE_FA } from "./PartySections";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";

// دکمه‌ی مشترک «اطلاعات تماس طرف‌حساب» برای نوار ابزار فرم‌های سندی (پیش‌فاکتور، سفارش، فاکتور، …): پنجره‌ی فقط‌خواندنی با تلفن‌ها، افراد مرتبط (نام/سمت/موبایل/تلفن/ایمیل)
// و نشانی اصلی؛ هر شماره لینک tel: و دکمه‌ی «کپی» دارد (روی گوشی با یک لمس تماس). داده همان Party است (یک منبع)، چیزی در سند ذخیره نمی‌شود.
// استفاده: <PartyContactButton partyId={customer?.partyId} /> داخل toolbarExtra فرم؛ بدون partyId غیرفعال است.

interface PartyData {
  category?: "INDIVIDUAL" | "LEGAL";
  detailTitle?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phones: { id: number; type: string; number: string; isPrimary: boolean }[];
  contacts: { id: number; name: string; position?: string | null; mobile?: string | null; phone?: string | null; email?: string | null; description?: string | null }[];
  addresses: { id: number; address?: string | null; postalCode?: string | null; isPrimary: boolean; city?: { title?: string | null } | null }[];
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn secondary"
      style={{ padding: "2px 8px", fontSize: 11 }}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? "کپی شد" : "کپی"}
    </button>
  );
}

function PhoneLine({ label, number }: { label?: string; number: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
      {label && <span style={{ opacity: 0.7, minWidth: 70 }}>{label}</span>}
      <a href={`tel:${number}`} dir="ltr" style={{ color: "var(--primary)" }}>{toFaDigits(number)}</a>
      <CopyButton text={number} />
    </div>
  );
}

export function PartyContactButton({ partyId, title = "اطلاعات تماس" }: { partyId?: number | null; title?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PartyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();

  async function show() {
    if (!partyId) return;
    setOpen(true);
    setData(null);
    setError(null);
    try {
      setData(await api.get(`/parties/${partyId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const name = data ? data.detailTitle || data.name || [data.firstName, data.lastName].filter(Boolean).join(" ") : "";
  const addr = data?.addresses.find((a) => a.isPrimary) ?? data?.addresses[0];
  const phones = data ? [...data.phones].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)) : [];

  return (
    <>
      <button type="button" className="toolbar-icon-btn" disabled={!partyId} onClick={show} title={partyId ? `${title} مشتری/طرف‌حساب` : "ابتدا مشتری را انتخاب کنید"}>
        <PhoneIcon />
      </button>
      {open && (
        <Modal title={`${title}${name ? ` — ${name}` : ""}`} onClose={() => setOpen(false)}>
          {error && <div className="alert warn">{error}</div>}
          {!data && !error && <p style={{ opacity: 0.7 }}>در حال بارگذاری…</p>}
          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 340 }}>
              <section>
                <b>تلفن‌ها</b>
                {phones.length === 0 && <div style={{ opacity: 0.7 }}>تلفنی ثبت نشده است</div>}
                {phones.map((p) => (
                  <PhoneLine key={p.id} label={`${PHONE_TYPE_FA[p.type] ?? p.type}${p.isPrimary ? " (اصلی)" : ""}`} number={p.number} />
                ))}
              </section>
              <section>
                <b>افراد مرتبط</b>
                {data.contacts.length === 0 && <div style={{ opacity: 0.7 }}>فردی ثبت نشده است</div>}
                {data.contacts.map((c) => (
                  <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                    <div>
                      {c.name}
                      {c.position ? <span style={{ opacity: 0.7 }}> — {c.position}</span> : null}
                    </div>
                    {c.mobile && <PhoneLine label="موبایل" number={c.mobile} />}
                    {c.phone && <PhoneLine label="تلفن" number={c.phone} />}
                    {c.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                        <span style={{ opacity: 0.7, minWidth: 70 }}>ایمیل</span>
                        <a href={`mailto:${c.email}`} dir="ltr" style={{ color: "var(--primary)" }}>{c.email}</a>
                        <CopyButton text={c.email} />
                      </div>
                    )}
                    {c.description && <div style={{ opacity: 0.7, fontSize: 12 }}>{c.description}</div>}
                  </div>
                ))}
              </section>
              {addr && (
                <section>
                  <b>نشانی اصلی</b>
                  <div>{[addr.city?.title, addr.address].filter(Boolean).join("، ")}</div>
                </section>
              )}
              {hasPermission("master-data.operations.parties.view") && (
                <div>
                  <button type="button" className="btn secondary" onClick={() => { setOpen(false); openTab(`/parties/${data.category === "LEGAL" ? "legal" : "individual"}/${partyId}/edit`); }}>
                    باز کردن کارت طرف‌حساب
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
