"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFullAccountCode = computeFullAccountCode;
exports.buildAccountByIdMap = buildAccountByIdMap;
/** کد کامل یک حساب را با پیمایش زنجیره‌ی والدها محاسبه می‌کند (کد گروه+کل+معین+... به ترتیب) */
function computeFullAccountCode(accountId, byId) {
    let cur = byId.get(accountId);
    const chain = [];
    while (cur) {
        chain.unshift(cur.code);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return chain.join("") || (byId.get(accountId)?.code ?? "");
}
function buildAccountByIdMap(accounts) {
    return new Map(accounts.map((a) => [a.id, a]));
}
