import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useTabs } from "../lib/TabsContext";
import { closeUsageDialog, subscribeUsageDialog, UsageInfo } from "../lib/usageDialog";
import { toFaDigits } from "../lib/formatAmount";

// دیالوگ سراسریِ «موارد استفاده» (یک‌بار در App): فهرست رکوردهایی که مانع حذف‌اند، گروه‌بندی‌شده با دکمه‌ی «باز کردن» (رکورد در تب تازه باز می‌شود).
export function UsageDialogHost() {
  const [info, setInfo] = useState<UsageInfo | null>(null);
  const { openTab } = useTabs();
  useEffect(() => subscribeUsageDialog(setInfo), []);
  if (!info) return null;
  return (
    <Modal title="موارد استفاده" onClose={closeUsageDialog} wide>
      <p style={{ margin: "0 0 10px" }}>{info.header}</p>
      {info.groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 4px" }}>
            {g.label} <span style={{ opacity: 0.7, fontWeight: 400 }}>({toFaDigits(String(g.total))} مورد)</span>
          </h4>
          <table className="hr-table">
            <tbody>
              {g.refs.map((r) => (
                <tr key={`${r.model}:${r.id}`}>
                  <td>{r.title}</td>
                  <td style={{ width: 90 }}>
                    {r.path ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          closeUsageDialog();
                          openTab(r.path!);
                        }}
                      >
                        باز کردن
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {g.total > g.refs.length && (
                <tr>
                  <td colSpan={2} style={{ opacity: 0.7 }}>و {toFaDigits(String(g.total - g.refs.length))} مورد دیگر</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
      <div className="actions">
        <button type="button" className="btn secondary" onClick={closeUsageDialog}>بستن</button>
      </div>
    </Modal>
  );
}
