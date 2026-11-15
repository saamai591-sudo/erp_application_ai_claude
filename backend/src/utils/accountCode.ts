/** کد کامل یک حساب را با پیمایش زنجیره‌ی والدها محاسبه می‌کند (کد گروه+کل+معین+... به ترتیب) */
export function computeFullAccountCode(
  accountId: number,
  byId: Map<number, { code: string; parentId: number | null }>
): string {
  let cur = byId.get(accountId);
  const chain: string[] = [];
  while (cur) {
    chain.unshift(cur.code);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.join("") || (byId.get(accountId)?.code ?? "");
}

export function buildAccountByIdMap<T extends { id: number; code: string; parentId: number | null }>(accounts: T[]): Map<number, T> {
  return new Map(accounts.map((a) => [a.id, a]));
}

/** گروه ماهیتِ ریشه‌ی درخت حساب (natureGroup نزدیک‌ترین نیاکانِ بدون والد). منبع واحد برای بستن حساب‌ها و سند اختتامیه/افتتاحیه. */
export async function rootNatureGroup(accountId: number, byId: Map<number, any>): Promise<string | null> {
  let cur = byId.get(accountId);
  while (cur) {
    if (!cur.parentId) return cur.natureGroup || null;
    const parent = byId.get(cur.parentId);
    if (!parent) return cur.natureGroup || null;
    cur = parent;
  }
  return null;
}
