export function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 4v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15a8 8 0 1 0 2-8.5L4 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RefreshButton({ onClick, title = "رفرش" }: { onClick: () => void; title?: string }) {
  return (
    <button type="button" className="toolbar-icon-btn" onClick={onClick} title={title}>
      <RefreshIcon />
    </button>
  );
}
