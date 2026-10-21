// ابزارهای خروجی فایل برای «ساختار فایل»: نویسنده‌ی DBF (dBase III)، zip بدون فشرده‌سازی (store) و محاسبه‌گر فرمول ساده‌ی ستون‌ها.

// ── CRC32 + ZIP (store) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** zip بدون فشرده‌سازی؛ نام فایل‌ها UTF-8 */
export function buildZip(files: { name: string; data: Buffer }[], now: Date = new Date()): Buffer {
  const { time, date } = dosDateTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, f.data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(f.data.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + f.data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ── DBF (dBase III، بدون memo؛ مثل نمونه‌ی تامین اجتماعی بدون نشانه‌ی پایان 0x1A) ──
export interface DbfFieldDef {
  name: string;
  type: "C" | "N";
  length: number;
  decimals: number;
}

/** cells[ردیف][فیلد] = بایت‌های آماده‌ی سلول (دقیقاً به طول فیلد) */
export function buildDbf(fields: DbfFieldDef[], cells: Buffer[][], now: Date = new Date()): Buffer {
  const headerLen = 32 + 32 * fields.length + 1;
  const recLen = 1 + fields.reduce((a, f) => a + f.length, 0);
  const head = Buffer.alloc(headerLen);
  head[0] = 0x03;
  head[1] = now.getFullYear() - 1900;
  head[2] = now.getMonth() + 1;
  head[3] = now.getDate();
  head.writeUInt32LE(cells.length, 4);
  head.writeUInt16LE(headerLen, 8);
  head.writeUInt16LE(recLen, 10);
  fields.forEach((f, i) => {
    const o = 32 + i * 32;
    head.write(f.name.slice(0, 10), o, "latin1");
    head[o + 11] = f.type.charCodeAt(0);
    head[o + 16] = f.length;
    head[o + 17] = f.decimals;
  });
  head[32 + 32 * fields.length] = 0x0d;
  const rows = cells.map((row) => Buffer.concat([Buffer.from([0x20]), ...row]));
  return Buffer.concat([head, ...rows]);
}

// ── فرمول ساده‌ی ستون‌ها: + - * / پرانتز، عدد و نام فیلدِ همان ردیف ──
export type Expr = { t: "num"; v: number } | { t: "name"; v: string } | { t: "neg"; a: Expr } | { t: "bin"; op: string; a: Expr; b: Expr };

export function parseExpr(src: string): Expr {
  const tokens = src.match(/\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[-+*/()])/g);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== src.replace(/\s/g, "")) throw new Error("فرمول نامعتبر است");
  const toks = tokens.map((t) => t.trim());
  let i = 0;
  const peek = () => toks[i];
  function primary(): Expr {
    const t = toks[i++];
    if (t === undefined) throw new Error("فرمول ناقص است");
    if (t === "(") {
      const e = additive();
      if (toks[i++] !== ")") throw new Error("پرانتز بسته نشده است");
      return e;
    }
    if (t === "-") return { t: "neg", a: primary() };
    if (/^\d/.test(t)) return { t: "num", v: Number(t) };
    if (/^[A-Za-z_]/.test(t)) return { t: "name", v: t };
    throw new Error(`نویسه‌ی نامعتبر «${t}» در فرمول`);
  }
  function multiplicative(): Expr {
    let a = primary();
    while (peek() === "*" || peek() === "/") a = { t: "bin", op: toks[i++], a, b: primary() };
    return a;
  }
  function additive(): Expr {
    let a = multiplicative();
    while (peek() === "+" || peek() === "-") a = { t: "bin", op: toks[i++], a, b: multiplicative() };
    return a;
  }
  const e = additive();
  if (i !== toks.length) throw new Error("فرمول نامعتبر است");
  return e;
}

export function exprNames(e: Expr, out: Set<string> = new Set()): Set<string> {
  if (e.t === "name") out.add(e.v);
  else if (e.t === "neg") exprNames(e.a, out);
  else if (e.t === "bin") { exprNames(e.a, out); exprNames(e.b, out); }
  return out;
}

export function evalExpr(e: Expr, get: (name: string) => number): number {
  switch (e.t) {
    case "num": return e.v;
    case "name": return get(e.v);
    case "neg": return -evalExpr(e.a, get);
    case "bin": {
      const a = evalExpr(e.a, get), b = evalExpr(e.b, get);
      if (e.op === "+") return a + b;
      if (e.op === "-") return a - b;
      if (e.op === "*") return a * b;
      return b === 0 ? 0 : a / b; // تقسیم بر صفر = ۰
    }
  }
}
