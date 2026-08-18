export interface ChainedTab {
  key: string;
  label: string;
  count?: number;
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function ChainedTabsBar({
  tabs,
  activeIndex,
  onChange,
}: {
  tabs: ChainedTab[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="ar-tabs">
      {tabs.map((tab, idx) => (
        <button key={tab.key} type="button" className={`ar-tab ${activeIndex === idx ? "active" : ""}`} onClick={() => onChange(idx)}>
          {tab.label}
          {tab.count ? <span className="badge">{toFaDigits(String(tab.count))}</span> : null}
        </button>
      ))}
    </div>
  );
}
