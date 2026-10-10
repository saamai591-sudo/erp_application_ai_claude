// چاپ سند حسابداری — بخش خالص (بدون پایگاه داده): گروه‌بندی ردیف‌های سند بر اساس حساب کل و تقسیم به صفحه‌های چاپی.
// فرمت از نمونه‌ی «Documents/سند حسابداری.pdf» گرفته شده: سربرگ (شماره سند/تاریخ، نام شرکت/وضعیت، شماره عطف/شماره صفحه)، جدول
// «ردیف | شماره حساب | شرح | مبلغ جزء | بدهکار | بستانکار»، هر حساب کل یک بلوک (کل ← معین ← تفصیلی‌ها ← شرح و مبلغ جزء)، جمع و امضاها.
// صفحه‌بندی سمت سرور است (شماره صفحه و جمع هر صفحه باید دقیق باشد)؛ ظرفیت هر صفحه از ارتفاع کاغذ و «رزرو» سربرگ/پاورقی قالب
// پیش‌فرض برآورد می‌شود. اگر شرح‌ها بلندتر از برآورد باشند چیزی بریده نمی‌شود: صفحه‌ی قالب min-height دارد و محتوا به ورق بعد می‌رود.

export interface JeAccountNode {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  /** ترتیب سطح گزارش‌دهی: ۱ گروه، ۲ کل، ۳ معین، … */
  levelOrder: number;
}

export interface JeLineInput {
  accountId: number;
  details: { code: string; title: string }[];
  description: string;
  /** مبالغ به ارز پایه */
  baseDebit: number;
  baseCredit: number;
  /** توضیح ارزی (مثلاً «۱۰۰ دلار — نرخ ۴۲۰٬۰۰۰») برای ردیف‌های غیر ارز پایه؛ خالی = ریالی */
  fxNote: string;
}

export interface JePrintRow {
  /** kol = حساب کل، mid = سطح میانی بین کل و آخرین سطح، leaf = آخرین سطح (معین)، detail = تفصیلی، desc = شرح + مبلغ جزء */
  kind: "kol" | "mid" | "leaf" | "detail" | "desc";
  no: string;
  code: string;
  text: string;
  part: string;
  debit: string;
  credit: string;
}

export interface JePrintPage {
  pageNo: number;
  pageCount: number;
  isFirst: boolean;
  isLast: boolean;
  multiPage: boolean;
  rows: JePrintRow[];
  /** جمع کل‌های همین صفحه (برای «جمع این صفحه») */
  debit: string;
  credit: string;
}

export interface JePrintResult {
  pages: JePrintPage[];
  totals: { debit: string; credit: string; debitValue: number; creditValue: number };
  lines: {
    row: number;
    accountCode: string;
    accountTitle: string;
    detail1Code: string;
    detail1Title: string;
    detail2Code: string;
    detail2Title: string;
    detail3Code: string;
    detail3Title: string;
    description: string;
    debit: string;
    credit: string;
  }[];
}

// ارتفاع‌های اندازه‌گیری‌شده‌ی قالب پیش‌فرض (میلی‌متر): یک خط متنِ ۸٫۵ پوینتی، هر خطِ اضافه‌ی ناشی از شکستن شرح، فاصله‌ی بالای سطر کل و
// پایین سطر شرح، و سطر معین (درشت‌تر). RESERVED = سربرگ + سرستون + جمع + امضا + حاشیه‌ی اطمینان؛ برآورد عمداً کمی بدبینانه است
// تا صفحه‌ی پر هرگز از ورق بیرون نزند (اگر زد، فقط امضا/جمع به ورق بعد می‌رود و داده‌ای گم نمی‌شود).
export const JE_LINE_MM = 5.4;
export const JE_WRAP_MM = 4.7;
export const JE_PAD_MM = 1.7;
export const JE_LEAF_MM = 6.0;
export const JE_RESERVED_MM = 78;
/** تعداد نویسه‌ی تقریبی هر خط ستون «شرح» برای برآورد شکستن خط */
const WRAP_CHARS = 34;

/** ظرفیت ردیف‌های هر صفحه (میلی‌متر) از ارتفاع کاربردی صفحه */
export function journalCapacityMm(contentHeightMm: number): number {
  return Math.max(60, contentHeightMm - JE_RESERVED_MM);
}

function extraWraps(text: string): number {
  return Math.max(0, Math.ceil((text || "").length / WRAP_CHARS) - 1);
}

function rowCost(r: JePrintRow): number {
  const base = r.kind === "leaf" ? JE_LEAF_MM : JE_LINE_MM;
  const pad = r.kind === "kol" || r.kind === "desc" ? JE_PAD_MM : 0;
  return base + pad + extraWraps(r.text) * JE_WRAP_MM;
}

interface Chunk {
  groupKey: string;
  leafKey: string;
  rows: JePrintRow[];
  descIndex: number;
  cost: number;
}

interface Group {
  key: string;
  side: "D" | "C";
  kolRow: JePrintRow;
  total: number;
  leaves: Map<number, { headRows: JePrintRow[]; chunks: Chunk[] }>;
}

export function buildJournalPrint(args: {
  lines: JeLineInput[];
  accounts: Map<number, JeAccountNode>;
  decimals: number;
  /** ظرفیت هر صفحه بر حسب میلی‌متر (journalCapacityMm) */
  capacity: number;
  fmt: (n: number, decimals: number) => string;
}): JePrintResult {
  const { lines, accounts, decimals, capacity, fmt } = args;

  const chainOf = (id: number): JeAccountNode[] => {
    const chain: JeAccountNode[] = [];
    for (let n = accounts.get(id); n; n = n.parentId ? accounts.get(n.parentId) : undefined) chain.unshift(n);
    return chain;
  };
  const fullCode = (chain: JeAccountNode[], upTo: number) => chain.slice(0, upTo + 1).map((n) => n.code).join("");

  // ۱) گروه‌بندی: هر (حساب کل، سمت بدهکار/بستانکار) یک بلوک؛ ترتیب بلوک‌ها = ترتیب اولین ردیفِ آن در سند
  const groups: Group[] = [];
  const groupByKey = new Map<string, Group>();
  const flat: JePrintResult["lines"] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach((l, idx) => {
    const chain = chainOf(l.accountId);
    const leafIdx = Math.max(0, chain.length - 1);
    const firstKol = chain.findIndex((n) => n.levelOrder >= 2);
    const kolIdx = Math.min(firstKol < 0 ? leafIdx : firstKol, leafIdx);
    const kol = chain[kolIdx];
    const leaf = chain[leafIdx];
    const side: "D" | "C" = l.baseDebit > 0 || l.baseCredit <= 0 ? "D" : "C";
    const amount = side === "D" ? l.baseDebit : l.baseCredit;
    totalDebit += l.baseDebit;
    totalCredit += l.baseCredit;

    const d = (i: number) => l.details[i] ?? { code: "", title: "" };
    flat.push({
      row: idx + 1,
      accountCode: leaf ? fullCode(chain, leafIdx) : "",
      accountTitle: leaf?.title ?? "",
      detail1Code: d(0).code,
      detail1Title: d(0).title,
      detail2Code: d(1).code,
      detail2Title: d(1).title,
      detail3Code: d(2).code,
      detail3Title: d(2).title,
      description: l.description,
      debit: l.baseDebit ? fmt(l.baseDebit, decimals) : "",
      credit: l.baseCredit ? fmt(l.baseCredit, decimals) : "",
    });

    if (!kol) return;
    const key = `${kol.id}:${side}`;
    let g = groupByKey.get(key);
    if (!g) {
      g = { key, side, kolRow: { kind: "kol", no: "", code: fullCode(chain, kolIdx), text: kol.title, part: "", debit: "", credit: "" }, total: 0, leaves: new Map() };
      groupByKey.set(key, g);
      groups.push(g);
    }
    g.total += amount;

    let leafBlock = g.leaves.get(leaf.id);
    if (!leafBlock) {
      const headRows: JePrintRow[] = [];
      for (let i = kolIdx + 1; i <= leafIdx; i += 1) {
        headRows.push({ kind: i === leafIdx ? "leaf" : "mid", no: "", code: fullCode(chain, i), text: chain[i].title, part: "", debit: "", credit: "" });
      }
      leafBlock = { headRows, chunks: [] };
      g.leaves.set(leaf.id, leafBlock);
    }

    const rows: JePrintRow[] = [];
    for (const dt of l.details) rows.push({ kind: "detail", no: "", code: dt.code, text: dt.title, part: "", debit: "", credit: "" });
    const descText = [l.description, l.fxNote].filter(Boolean).join(" — ");
    rows.push({ kind: "desc", no: "", code: "", text: descText, part: fmt(amount, decimals), debit: "", credit: "" });
    const cost = rows.reduce((sum, r) => sum + rowCost(r), 0);
    leafBlock.chunks.push({ groupKey: key, leafKey: `${key}:${leaf.id}`, rows, descIndex: rows.length - 1, cost });
  });

  // ۲) صفحه‌بندی: واحد تقسیم = «ردیف سند» (جزئیات + شرح)؛ سطرهای کل/معین در آغاز هر صفحه‌ی ادامه دوباره (بدون مبلغ) می‌آیند
  interface PageAcc {
    rows: JePrintRow[];
    used: number;
    debit: number;
    credit: number;
  }
  const pages: PageAcc[] = [];
  let cur: PageAcc = { rows: [], used: 0, debit: 0, credit: 0 };
  let pageGroup: string | null = null;
  let pageLeaf: string | null = null;
  const groupNo = new Map<string, number>();
  const groupPrinted = new Set<string>();

  const newPage = () => {
    pages.push(cur);
    cur = { rows: [], used: 0, debit: 0, credit: 0 };
    pageGroup = null;
    pageLeaf = null;
  };

  for (const g of groups) {
    groupNo.set(g.key, groupNo.size + 1);
    let firstChunkOfGroup = true;
    for (const leafBlock of g.leaves.values()) {
      for (const chunk of leafBlock.chunks) {
        let needGroup = pageGroup !== chunk.groupKey;
        let needLeaf = needGroup || pageLeaf !== chunk.leafKey;
        const kolCost = rowCost(g.kolRow);
        const leafCost = leafBlock.headRows.reduce((sum, r) => sum + rowCost(r), 0);
        let cost = (needGroup ? kolCost : 0) + (needLeaf ? leafCost : 0) + chunk.cost;
        if (cur.used > 0 && cur.used + cost > capacity) {
          newPage();
          needGroup = true;
          needLeaf = true;
          cost = kolCost + leafCost + chunk.cost;
        }
        if (needGroup) {
          const first = !groupPrinted.has(g.key);
          groupPrinted.add(g.key);
          const row: JePrintRow = { ...g.kolRow };
          if (first) {
            if (g.side === "D") row.debit = fmt(g.total, decimals);
            else row.credit = fmt(g.total, decimals);
            if (g.side === "D") cur.debit += g.total;
            else cur.credit += g.total;
          } else {
            row.text = `${row.text} (ادامه)`;
          }
          cur.rows.push(row);
          pageGroup = chunk.groupKey;
        }
        if (needLeaf) {
          for (const r of leafBlock.headRows) cur.rows.push({ ...r });
          pageLeaf = chunk.leafKey;
        }
        chunk.rows.forEach((r, i) => {
          const row = { ...r };
          if (i === chunk.descIndex && firstChunkOfGroup) row.no = String(groupNo.get(g.key));
          cur.rows.push(row);
        });
        firstChunkOfGroup = false;
        cur.used += cost;
      }
    }
  }
  if (cur.rows.length > 0 || pages.length === 0) pages.push(cur);

  const pageCount = pages.length;
  return {
    pages: pages.map((p, i) => ({
      pageNo: i + 1,
      pageCount,
      isFirst: i === 0,
      isLast: i === pageCount - 1,
      multiPage: pageCount > 1,
      rows: p.rows,
      debit: fmt(p.debit, decimals),
      credit: fmt(p.credit, decimals),
    })),
    totals: { debit: fmt(totalDebit, decimals), credit: fmt(totalCredit, decimals), debitValue: totalDebit, creditValue: totalCredit },
    lines: flat,
  };
}
