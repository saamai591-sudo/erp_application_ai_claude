/** کلاینت API ورود داده‌ی ERP (/api/data-migration/*). همه‌ی عملیات‌ها idempotent‌اند، پس خطای شبکه با تلاش مجدد امن است. */
export class ErpClient {
  constructor(baseUrl) {
    this.base = baseUrl.replace(/\/+$/, "") + "/api";
    this.token = "";
  }

  async #fetch(method, path, body, attempt = 1) {
    let res;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });
    } catch (e) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        return this.#fetch(method, path, body, attempt + 1);
      }
      throw new Error(`اتصال به ERP برقرار نشد (${this.base}): ${e?.cause?.code || e.message}`);
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text.slice(0, 300) };
    }
    if (!res.ok) {
      const err = new Error(json?.error || `خطای ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  async login(mobile, password) {
    const r = await this.#fetch("POST", "/auth/login", { mobile, password });
    if (!r.token) throw new Error("ورود به ERP ناموفق بود");
    this.token = r.token;
  }

  state() {
    return this.#fetch("GET", "/data-migration/state");
  }
  reportingLevels(levels) {
    return this.#fetch("POST", "/data-migration/reporting-levels", { levels });
  }
  fiscalPeriods(items) {
    return this.#fetch("POST", "/data-migration/fiscal-periods", { items });
  }
  documentTypes(items) {
    return this.#fetch("POST", "/data-migration/document-types", { items });
  }
  accounts(items) {
    return this.#fetch("POST", "/data-migration/accounts", { items });
  }
  details(kind, items) {
    return this.#fetch("POST", "/data-migration/details", { kind, items });
  }
  journalEntries(items) {
    return this.#fetch("POST", "/data-migration/journal-entries", { items });
  }
  periodTotals(period, withAccounts) {
    return this.#fetch("GET", `/data-migration/period-totals?period=${encodeURIComponent(period)}&accounts=${withAccounts ? 1 : 0}`);
  }
}
