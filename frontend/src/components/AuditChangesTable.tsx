import { auditActionTitle, auditFieldTitle, auditValueText, AuditEventView } from "../lib/auditLabels";

// جدول «فیلد / قبل / بعد» یک رویداد لاگ تغییرات؛ مشترک بین مرور لاگ و تاریخچه‌ی رکورد.
export function AuditChangesTable({ event }: { event: AuditEventView }) {
  const entries = event.changes ? Object.entries(event.changes) : [];
  if (!entries.length) {
    return <div className="mg-muted">{event.summary || (event.kind === "CHANGE" ? "مقدار فیلدها ثبت نشده است (سطح «سبک»)." : auditActionTitle(event.action))}</div>;
  }
  return (
    <table className="audit-changes">
      <thead>
        <tr>
          <th>فیلد</th>
          <th>قبل</th>
          <th>بعد</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td>{auditFieldTitle(k)}</td>
            <td>{auditValueText(v?.[0])}</td>
            <td>{auditValueText(v?.[1])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
