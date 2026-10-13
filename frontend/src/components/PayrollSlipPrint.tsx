import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { PrintFrame, printFrame } from "./PrintButton";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

// پیش‌نمایش و چاپ فیش حقوقی یک یا چند کارمند (سند HTML را سرور از فیش‌های ذخیره‌شده می‌سازد: POST /payroll-calculations/print).

export function PayrollSlipPrintDialog({ year, month, employeeIds, onClose }: { year: number; month: number; employeeIds: number[]; onClose: () => void }) {
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [count, setCount] = useState(0);
  const [missing, setMissing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(true);
    api
      .post("/payroll-calculations/print", { year, month, employeeIds }, { silent: true } as any)
      .then((r: { html: string; fileName: string; count: number; missing: number[] }) => {
        setHtml(r.html);
        setFileName(r.fileName);
        setCount(r.count);
        setMissing(r.missing.length);
      })
      .catch((e) => setError((e as ApiError).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="چاپ فیش حقوقی" onClose={onClose} wide>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={!html || loading} onClick={() => printFrame(frameRef.current, fileName)}>چاپ</button>
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
        {!loading && !error && (
          <span style={{ opacity: 0.8 }}>
            {toFaDigits(String(count))} فیش{missing > 0 ? ` — ${toFaDigits(String(missing))} نفر فیش محاسبه‌شده نداشتند و چاپ نشدند` : ""}
          </span>
        )}
      </div>
      {error && <div className="alert error" style={{ marginBottom: 8 }}>{error}</div>}
      {loading && !error && <div style={{ padding: 12 }}>در حال آماده‌سازی…</div>}
      {html && !error && <PrintFrame html={html} frameRef={frameRef} />}
    </Modal>
  );
}
