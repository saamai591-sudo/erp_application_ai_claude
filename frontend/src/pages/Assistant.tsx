import { FormEvent, useEffect, useRef, useState } from "react";
import { InfoHint } from "../components/InfoHint";
import { api, ApiError } from "../lib/api";
import { stageFormPrefill } from "../lib/formPrefill";
import { useTabs } from "../lib/TabsContext";

// «دستیار» (گفتگوی دستوری): کاربر آزاد می‌نویسد، سرور (backend/src/assistant) با قواعد از پیش‌تعریف‌شده می‌فهمد، اگر چیزی مبهم بود با دکمه می‌پرسد و در پایان
// برای کارهای ثبتی فرم را با اطلاعات کامل پیش‌پر باز می‌کند؛ ذخیره با خود کاربر است. وضعیت گفتگو سمت کلاینت نگه‌داشته و با هر پیام فرستاده می‌شود.

type Block =
  | { type: "text"; text: string }
  | { type: "choices"; slot: string; index?: number; items: { id: number; label: string }[] }
  | { type: "suggestions"; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "prefill"; label: string; path: string; payload: unknown; preview?: { columns: string[]; rows: string[][] } }
  | { type: "confirm"; label: string; summary: { label: string; value: string }[] };

interface Msg {
  from: "user" | "bot";
  text?: string;
  blocks?: Block[];
}

// بین جابه‌جایی تب‌ها (و بازگشت) گفتگو حفظ شود؛ بیرون از کامپوننت نگه‌داشته می‌شود (حافظه‌ی همین نشست مرورگر)
const cache: { msgs: Msg[]; state: unknown } = { msgs: [], state: undefined };

// رایانه (ماوس/صفحه‌کلید): فوکوس هرگز از کادر پیام خارج نمی‌شود تا کاربر بعد از Enter بدون کلیک دستور بعدی را بنویسد؛ موبایل (لمسی/باریک) رفتار قبلی را دارد (کادر هنگام پردازش غیرفعال و کیبورد بسته نمی‌شود/باز نمی‌شود)
const isDesktop = () => typeof window !== "undefined" && !window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;

function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="assistant-table-wrap">
      <table className="assistant-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Assistant() {
  const { openTab } = useTabs();
  const [msgs, setMsgs] = useState<Msg[]>(cache.msgs);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cache.msgs = msgs;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  // پیام خوشامد و راهنمای اولیه
  const started = useRef(false);
  useEffect(() => {
    if (msgs.length || started.current) return; // StrictMode دو بار اجرا می‌کند
    started.current = true;
    send({ text: "" }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(payload: { text?: string; choice?: { slot: string; index?: number; id: number }; confirm?: boolean }, echo = true, shown?: string) {
    setError(null);
    if (echo) setMsgs((m) => [...m, { from: "user", text: shown ?? payload.text ?? "" }]);
    setBusy(true);
    try {
      const r: { blocks: Block[]; state: unknown } = await api.post("/assistant/message", { ...payload, state: cache.state }, { silent: true });
      cache.state = r.state;
      setMsgs((m) => [...m, { from: "bot", blocks: r.blocks }]);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
      if (isDesktop()) setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    send({ text: t });
  }

  function openPrefill(b: Extract<Block, { type: "prefill" }>) {
    stageFormPrefill(b.path, b.payload);
    openTab(b.path);
  }

  return (
    <div className="assistant-page">
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <strong style={{ marginInlineEnd: 8 }}>دستیار</strong>
          <InfoHint title="دستیار" text="دستورتان را به فارسی بنویسید (مثلاً «پیش‌فاکتور برای شرکت X، ۱۰ تا کالای Y»). هر جا چیزی مبهم باشد می‌پرسم؛ برای ثبت، فرم با اطلاعات کامل باز می‌شود و ذخیره با خود شماست." />
          <button type="button" className="btn secondary" style={{ marginInlineStart: "auto", padding: "2px 10px", fontSize: 11.5 }} onClick={() => { cache.msgs = []; cache.state = undefined; setMsgs([]); send({ text: "" }, false); }}>
            گفتگوی جدید
          </button>
        </div>
      </div>

      <div className="assistant-chat">
        {msgs.map((m, i) => (
          <div key={i} className={`assistant-msg ${m.from}`}>
            {m.text && <div className="assistant-bubble">{m.text}</div>}
            {m.blocks?.map((b, j) => {
              if (b.type === "text") return <div key={j} className="assistant-bubble" style={{ whiteSpace: "pre-wrap" }}>{b.text}</div>;
              if (b.type === "table") return <Table key={j} columns={b.columns} rows={b.rows} />;
              if (b.type === "suggestions")
                return (
                  <div key={j} className="assistant-chips">
                    {b.items.map((s) => (
                      <button key={s} type="button" className="assistant-chip" disabled={busy} onClick={() => send({ text: s })}>{s}</button>
                    ))}
                  </div>
                );
              if (b.type === "choices")
                return (
                  <div key={j} className="assistant-chips">
                    {b.items.map((it) => (
                      <button key={it.id} type="button" className="assistant-chip" disabled={busy || i !== msgs.length - 1} onClick={() => send({ choice: { slot: b.slot, index: b.index, id: it.id } }, true, it.label)}>
                        {it.label}
                      </button>
                    ))}
                  </div>
                );
              if (b.type === "confirm")
                return (
                  <div key={j} className="assistant-prefill">
                    <Table columns={["مورد", "مقدار"]} rows={b.summary.map((x) => [x.label, x.value])} />
                    <button type="button" className="btn" disabled={busy || i !== msgs.length - 1} onClick={() => send({ confirm: true }, true, b.label)}>{b.label}</button>
                  </div>
                );
              // prefill
              return (
                <div key={j} className="assistant-prefill">
                  {b.preview && <Table columns={b.preview.columns} rows={b.preview.rows} />}
                  <button type="button" className="btn" onClick={() => openPrefill(b)}>{b.label}</button>
                </div>
              );
            })}
          </div>
        ))}
        {busy && <div className="assistant-msg bot"><div className="assistant-bubble" style={{ opacity: 0.6 }}>…</div></div>}
        {error && <div className="assistant-msg bot"><div className="assistant-bubble error">{error}</div></div>}
        <div ref={endRef} />
      </div>

      <form className="assistant-input" onSubmit={onSubmit}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="دستورتان را بنویسید…" autoFocus disabled={busy && !isDesktop()} />
        <button type="submit" className="btn" disabled={busy || !text.trim()}>ارسال</button>
      </form>
    </div>
  );
}
