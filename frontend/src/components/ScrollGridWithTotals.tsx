import { ReactNode, useLayoutEffect, useRef, useState } from "react";

// گریدِ جدول ساده (hr-table) با «فوتر جمع» ثابت: ردیف‌ها داخل ناحیه‌ی اسکرول‌شونده می‌مانند و نوار جمع بیرون از آن، ته کادر گرید، با اسکرول عمودی تکان نمی‌خورد؛
// عرض هر ستونِ نوار از روی عرض واقعی ستون‌های <thead> اندازه‌گیری می‌شود تا دقیقاً زیر ستون بنشیند و اسکرول افقی هم‌گام است — همان مکانیزمِ
// SelectableBalanceTable/DataTable (کلاس‌های grid-scroll-area و grid-footer-totals در styles.css)، برای صفحاتی که جدولشان را دستی می‌سازند.
//  • fill=true  : گرید باقیِ ارتفاع صفحه را می‌گیرد (صفحه‌ی عملیاتی مثل «محاسبه حقوق»)؛ ریشه‌ی صفحه باید ستون flex باشد (همه‌ی صفحه‌ها هستند).
//  • fill=false : گرید داخل یک فرم است؛ ارتفاعش به maxHeight محدود می‌شود و بقیه‌ی فرم زیرش می‌آید.

export interface TotalsRow {
  /** یک سلول برای هر ستونِ thead (هم‌ترتیب)؛ null = خالی */
  cells: ReactNode[];
}

export function ScrollGridWithTotals({
  head,
  children,
  totals,
  fill = false,
  maxHeight = "min(58vh, 460px)",
  tableClassName = "hr-table",
}: {
  /** ردیف(های) <tr> داخل thead */
  head: ReactNode;
  /** محتوای <tbody> */
  children: ReactNode;
  totals: TotalsRow[];
  fill?: boolean;
  maxHeight?: string;
  tableClassName?: string;
}) {
  const headRef = useRef<HTMLTableSectionElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>([]);

  // اندازه‌گیری بعد از هر رندر (محتوا/عرض ستون‌ها عوض می‌شود)؛ فقط اگر تغییری بود state عوض می‌شود تا حلقه نشود
  useLayoutEffect(() => {
    function measure() {
      const ths = headRef.current?.querySelectorAll("tr:last-child th");
      if (!ths || ths.length === 0) return;
      const next = Array.from(ths).map((th) => Math.round(th.getBoundingClientRect().width));
      setWidths((prev) => (prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  function syncScroll() {
    if (scrollRef.current && footerScrollRef.current) footerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
  }

  const total = widths.length ? widths.reduce((s, w) => s + w, 0) : undefined;
  const scrollStyle = fill ? { overflowX: "auto" as const, overflowY: "auto" as const } : { overflowX: "auto" as const, overflowY: "auto" as const, maxHeight };

  return (
    <div className={fill ? "grid-wrap-standalone" : undefined} style={fill ? undefined : { marginBottom: 8 }}>
      <div ref={scrollRef} className="card grid-scroll-area" style={scrollStyle} onScroll={syncScroll}>
        <table className={tableClassName} style={{ marginBottom: 0 }}>
          <thead ref={headRef}>{head}</thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <div className="grid-footer-totals grid-footer-totals-standalone">
        <div className="grid-footer-totals-scroll" ref={footerScrollRef}>
          <table style={{ tableLayout: "fixed", width: total }}>
            <tbody>
              {totals.map((r, ri) => (
                <tr key={ri}>
                  {r.cells.map((c, i) => (
                    <td key={i} style={{ width: widths[i] }}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
