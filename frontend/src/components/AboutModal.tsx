import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

interface AboutInfo {
  version: string;
  database: {
    schemaVersion: string | null;
    migration: string | null;
    appliedMigrations: number;
    engine: string | null;
    expectedSchemaVersion: string | null;
    upToDate: boolean | null;
  };
}

/** دیالوگ «درباره»: نسخه‌ی سیستم و نسخه‌ی پایگاه داده (GET /api/about). نسخه‌ها عمداً به‌صورت لاتین (LTR) نشان داده می‌شوند. */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/about").then(setInfo).catch((e) => setError(e.message || "خطا در دریافت اطلاعات"));
  }, []);

  const db = info?.database;
  const clientMismatch = !!info && info.version !== __APP_VERSION__;

  return (
    <Modal title="درباره‌ی سیستم" onClose={onClose}>
      {error && <div className="about-warning">{error}</div>}
      {!info && !error && <div className="empty-state">در حال دریافت…</div>}
      {info && (
        <div className="about-grid">
          <div className="about-label">نسخه</div>
          <div className="about-value" dir="ltr">{info.version}</div>

          <div className="about-label">پایگاه داده</div>
          <div className="about-value" dir="ltr">
            {db?.schemaVersion ? (
              <>
                {db.schemaVersion}
                {db.migration ? <span className="about-sub"> — {db.migration}</span> : null}
              </>
            ) : (
              "نامشخص"
            )}
            <div className="about-sub">
              {[db?.engine, db && db.appliedMigrations ? `${db.appliedMigrations} migrations` : null].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      )}
      {db && db.upToDate === false && (
        <div className="about-warning">
          پایگاه داده از این نسخه‌ی برنامه عقب است (انتظار می‌رود: {toFaDigits(db.expectedSchemaVersion || "")}). مایگریشن‌های جدید هنگام راه‌اندازی مجدد سرور اجرا می‌شوند.
        </div>
      )}
      {clientMismatch && (
        <div className="about-warning">
          نسخه‌ی رابط کاربری ({__APP_VERSION__}) با نسخه‌ی سرور ({info?.version}) یکی نیست؛ صفحه را دوباره بارگذاری کنید (Ctrl+F5) یا ایمیج‌های frontend و backend را هم‌نسخه کنید.
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose} autoFocus>بستن</button>
      </div>
    </Modal>
  );
}
