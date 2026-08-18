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
