import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { showToast } from "../lib/toast";
import { FONT_OPTIONS, applyFont, THEME_OPTIONS, applyTheme } from "../lib/userSettings";
import { loadPreferences, savePreferences } from "../lib/preferences";

export function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const [fontKey, setFontKey] = useState("vazirmatn");
  const [themeKey, setThemeKey] = useState("default");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPreferences().then((p) => {
      setFontKey(p.font);
      setThemeKey(p.theme);
    });
  }, []);

  function handleFontChange(key: string) {
    setFontKey(key);
    applyFont(key); // پیش‌نمایش زنده
  }

  function handleThemeChange(key: string) {
    setThemeKey(key);
    applyTheme(key); // پیش‌نمایش زنده
  }

  function save() {
    applyFont(fontKey);
    applyTheme(themeKey);
    savePreferences({ font: fontKey, theme: themeKey });
    setSaved(true);
    setTimeout(() => onClose(), 500);
  }

  return (
    <Modal title="تنظیمات کاربری" onClose={onClose}>
      <div className="form-grid">
        <div className="form-field full">
          <label>فونت برنامه</label>
          <select value={fontKey} onChange={(e) => handleFontChange(e.target.value)}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key} style={{ fontFamily: f.family }}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="form-field full">
          <p style={{ fontFamily: `var(--app-font)`, fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }}>
            متن نمونه با فونت انتخابی: نرم‌افزار حسابداری — ۰۱۲۳۴۵۶۷۸۹
          </p>
        </div>
        <div className="form-field full" style={{ alignItems: "flex-start" }}>
          <label>تم برنامه</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleThemeChange(t.key)}
                className="theme-swatch-btn"
                style={{ borderColor: themeKey === t.key ? "var(--primary)" : "var(--line)" }}
              >
                <span className="theme-swatch-colors">
                  {t.swatch.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ذخیره</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
