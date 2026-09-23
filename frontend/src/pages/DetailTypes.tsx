import { useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { useCrud } from "../lib/useCrud";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";

interface DetailType {
  id: number;
  code: number;
  title: string;
  codeLength: number;
  startNumber: number;
  endNumber: number;
}

export default function DetailTypes() {
  const { items, loading, error, reload } = useCrud<DetailType>("/detail-types");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<DetailType>>({});
  const [rowError, setRowError] = useState<string | null>(null);

  function startEdit(row: DetailType) {
    setEditing(row.id);
    setDraft({ codeLength: row.codeLength, startNumber: row.startNumber, endNumber: row.endNumber });
    setRowError(null);
  }

  async function save(id: number) {
    try {
      await api.put(`/detail-types/${id}`, draft);
      setEditing(null);
      await reload();
    } catch (e: any) {
      setRowError(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`انواع پایه سیستم برای کدگذاری خودکار تفصیلی‌ها — پس از ثبت اولین رکورد از هر نوع، طول کد و شماره شروع دیگر قابل تغییر نیست`} title="نوع تفصیل" />
          <RefreshButton onClick={reload} />
        </div>
      </div>

      <ErrorToast message={error} />
      <ErrorToast message={rowError} />

      {!loading && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>کد</th>
                <th>عنوان</th>
                <th>طول کد</th>
                <th>شماره شروع</th>
                <th>شماره پایان</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{toFaDigits(String(r.code))}</td>
                  <td>{r.title}</td>
                  <td>
                    {editing === r.id ? (
                      <input
                        style={{ width: 70 }}
                        type="number"
                        value={draft.codeLength}
                        onChange={(e) => setDraft({ ...draft, codeLength: Number(e.target.value) })}
                      />
                    ) : (
                      toFaDigits(String(r.codeLength))
                    )}
                  </td>
                  <td>
                    {editing === r.id ? (
                      <input
                        style={{ width: 90 }}
                        type="number"
                        value={draft.startNumber}
                        onChange={(e) => setDraft({ ...draft, startNumber: Number(e.target.value) })}
                      />
                    ) : (
                      toFaDigits(String(r.startNumber))
                    )}
                  </td>
                  <td>
                    {editing === r.id ? (
                      <input
                        style={{ width: 90 }}
                        type="number"
                        value={draft.endNumber}
                        onChange={(e) => setDraft({ ...draft, endNumber: Number(e.target.value) })}
                      />
                    ) : (
                      toFaDigits(String(r.endNumber))
                    )}
                  </td>
                  <td>
                    {editing === r.id ? (
                      <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => save(r.id)}>ذخیره</button>
                    ) : (
                      <button className="btn secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(r)}>ویرایش</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
