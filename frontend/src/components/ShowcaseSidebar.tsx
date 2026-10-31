import { ReactNode, useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";

// سایدبار «ویترین کالا» برای فرم فروش / برگشت فروش (بدون مبنا) فروشگاهی: به سمت راست فرم می‌چسبد، باز و بسته می‌شود، هر ویترین یک تب است
// و هر کاشی با «عنوان نمایشی» و فی؛ کلیک = یک عدد به فاکتور (همان addItem فرم). فی و قابل‌فروش بودن از «اقلام قابل‌فروشِ» ایستگاه می‌آید؛
// کالای بدون فی در اعلامیه‌ی قیمت ایستگاه کم‌رنگ و غیرقابل‌کلیک است.

export interface ShowcaseSellable {
  id: number;
  basePrice: number;
}
interface ShowcaseDef {
  id: number;
  title: string;
  items: { goodsItemId: number; displayTitle: string }[];
}

const OPEN_KEY = "store-showcase-open";

export function ShowcaseLayout<T extends ShowcaseSellable>({
  stationId,
  sellable,
  onPick,
  disabled,
  visible,
  children,
}: {
  stationId: string;
  sellable: Map<number, T>;
  onPick: (item: T) => void;
  disabled?: boolean;
  /** false = فقط children (مثلاً فرم قفل است یا ایستگاه/اعلامیه هنوز مشخص نیست) */
  visible: boolean;
  children: ReactNode;
}) {
  const [showcases, setShowcases] = useState<ShowcaseDef[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    setShowcases([]);
    if (!stationId || !visible) return;
    let dead = false;
    api.get(`/store-showcases/for-station?stationId=${stationId}`)
      .then((r: ShowcaseDef[]) => {
        if (dead) return;
        setShowcases(r);
        setActive((cur) => (cur && r.some((x) => x.id === cur) ? cur : r[0]?.id ?? null));
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [stationId, visible]);

  function toggle() {
    setOpen((o) => {
      try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* فقط یک راحتی کاربر است */ }
      return !o;
    });
  }

  if (!visible || showcases.length === 0) return <>{children}</>;
  const cur = showcases.find((x) => x.id === active) ?? showcases[0];

  return (
    <div className="showcase-layout">
      <aside className={`showcase-sidebar${open ? "" : " collapsed"}`} aria-label="ویترین کالا">
        <button type="button" className="showcase-toggle" onClick={toggle} title={open ? "بستن ویترین" : "باز کردن ویترین"}>
          <span aria-hidden>{open ? "›" : "‹"}</span>
          {!open && <span className="showcase-toggle-label">ویترین</span>}
        </button>
        {open && (
          <div className="showcase-body">
            {showcases.length > 1 && (
              <div className="showcase-tabs" role="tablist">
                {showcases.map((x) => (
                  <button key={x.id} type="button" role="tab" aria-selected={x.id === cur.id} className={`showcase-tab${x.id === cur.id ? " active" : ""}`} onClick={() => setActive(x.id)}>
                    {x.title}
                  </button>
                ))}
              </div>
            )}
            {showcases.length === 1 && <div className="showcase-title">{cur.title}</div>}
            <div className="showcase-grid">
              {cur.items.length === 0 && <div style={{ opacity: 0.6, fontSize: 12, gridColumn: "1 / -1" }}>این ویترین کالایی ندارد</div>}
              {cur.items.map((it) => {
                const g = sellable.get(it.goodsItemId);
                const off = disabled || !g;
                return (
                  <button
                    key={it.goodsItemId}
                    type="button"
                    className="showcase-tile"
                    disabled={off}
                    title={g ? undefined : "این کالا در اعلامیه‌ی قیمت ایستگاه فی ندارد"}
                    onClick={() => g && onPick(g)}
                  >
                    <span className="showcase-tile-title">{it.displayTitle}</span>
                    <span className="showcase-tile-price">{g ? formatAmountFa(g.basePrice) : toFaDigits("—")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>
      <div className="showcase-main">{children}</div>
    </div>
  );
}
