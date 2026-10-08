// لایه‌ی ارتباط با سامانه مودیان — API نسخه‌ی قبلی («توسط مودی»، ClientType.SELF_TSP؛ کلید عمومیِ ثبت‌شده در کارپوشه، بدون گواهی مرکز میانی).
//
// پروتکل از روی رفتار SDK رسمی سازمان بازنویسی شده (همان که سیستم سام استفاده می‌کند):
//  • آدرس‌ها: <base>/self-tsp/sync/{GET_SERVER_INFORMATION|GET_TOKEN|INQUIRY_BY_REFERENCE_NUMBER|INQUIRY_BY_UID} و <base>/self-tsp/async/normal-enqueue
//  • هر درخواست در سطح انتقال امضا می‌شود (RSA-SHA256/PKCS1 روی «متن نرمال‌شده»ی بسته + هدرهای Authorization/requestTraceId/timestamp)
//  • بسته‌ی صورتحساب: ابتدا امضای محتوا (dataSignature)، سپس رمزنگاری: JSON ⊕ کلید AES (XOR چرخشی) ← AES-256-GCM (IV ۱۶ بایتی، تگ ۱۲۸ بیت پشت متن رمز)،
//    و کلید AES (به‌صورت رشته‌ی هگز بزرگ) با RSA-OAEP-SHA256 و کلید عمومی سازمان (از GET_SERVER_INFORMATION) رمز و Base64 می‌شود
// تا فلگ TAX_TRANSPORT_ENABLED=true نباشد هیچ ارتباطی برقرار نمی‌شود (ارسال واقعیِ صورتحساب قانونی است).

import crypto from "crypto";
import https from "https";
import http from "http";
import { URL } from "url";
import { normalizeForSignature, stringifyWire, WireInvoice } from "./taxWire";

export class TaxTransportNotReadyError extends Error {
  constructor(reason = "ارتباط با سامانه مودیان فعال نشده است (متغیر محیطی TAX_TRANSPORT_ENABLED=true لازم است)؛ فعلاً فقط پیش‌نمایش و اعتبارسنجی ممکن است") {
    super(reason);
    this.name = "TaxTransportNotReadyError";
  }
}

export class TaxApiError extends Error {
  constructor(message: string, public errorCode?: string, public httpStatus?: number) {
    super(message);
    this.name = "TaxApiError";
  }
}

/** آیا ارسال واقعی روشن شده است؟ */
export const isTaxTransportEnabled = () => process.env.TAX_TRANSPORT_ENABLED === "true";

const DEFAULT_BASE_URL = "https://tp.tax.gov.ir/req/api/";

export interface TaxTransportConfig {
  /** شناسه ۶ کاراکتری حافظه مالیاتی (clientId/fiscalId) */
  fiscalId: string;
  /** کلید خصوصی PKCS#8 PEM */
  privateKeyPem: string;
  baseUrl?: string;
  /** فقط اگر زنجیره‌ی گواهی سایت سازمان در سرور شناخته نیست (مثل SDK رسمی که اعتبارسنجی TLS را خاموش می‌کند) */
  insecureTls?: boolean;
  timeoutMs?: number;
}

export interface PacketResult {
  uid: string;
  referenceNumber: string | null;
  errorCode: string | null;
  errorDetail: string | null;
}
export interface InquiryResult {
  referenceNumber: string;
  uid: string;
  status: string;
  data: any;
  packetType: string | null;
  fiscalId: string | null;
}

/** XOR چرخشی: عنصر کوچک‌تر روی بزرگ‌تر تکرار می‌شود (طول خروجی = طول بزرگ‌تر) */
export function xorCyclic(a: Buffer, b: Buffer): Buffer {
  const [small, big] = a.length < b.length ? [a, b] : [b, a];
  const out = Buffer.alloc(big.length);
  for (let i = 0; i < big.length; i++) out[i] = big[i] ^ small[i % small.length];
  return out;
}

/** رمزنگاری یک JSON برای ارسال: خروجی همه‌ی فیلدهای لازم بسته‌ی رمزشده */
export function encryptJsonForTax(json: string, serverPublicKeyDerBase64: string) {
  const aesKey = crypto.randomBytes(32);
  let iv = crypto.randomBytes(16);
  while (iv.includes(0)) iv = crypto.randomBytes(16); // SDK بایت صفر در IV نمی‌گذارد
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv, { authTagLength: 16 });
  const body = Buffer.concat([cipher.update(xorCyclic(Buffer.from(json, "utf8"), aesKey)), cipher.final()]);
  const data = Buffer.concat([body, cipher.getAuthTag()]).toString("base64");
  const pub = crypto.createPublicKey({ key: Buffer.from(serverPublicKeyDerBase64, "base64"), format: "der", type: "spki" });
  const symmetricKey = crypto
    .publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(aesKey.toString("hex").toUpperCase(), "utf8"))
    .toString("base64");
  return { data, symmetricKey, iv: iv.toString("hex").toUpperCase() };
}

interface RawResponse {
  status: number;
  json: any;
}

export class TaxTransport {
  private readonly baseUrl: string;
  private readonly key: crypto.KeyObject;
  private serverKey: { id: string; key: string } | null = null;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly cfg: TaxTransportConfig) {
    this.baseUrl = (cfg.baseUrl || process.env.TAX_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/*$/, "/");
    this.key = crypto.createPrivateKey(cfg.privateKeyPem);
  }

  private sign(text: string): string {
    return crypto.sign("sha256", Buffer.from(text, "utf8"), { key: this.key, padding: crypto.constants.RSA_PKCS1_PADDING }).toString("base64");
  }

  private post(path: string, body: string, headers: Record<string, string>): Promise<RawResponse> {
    const url = new URL(path, this.baseUrl);
    const lib = url.protocol === "http:" ? http : https;
    const payload = Buffer.from(body, "utf8");
    return new Promise((resolve, reject) => {
      const req = lib.request(
        url,
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json", "Content-Length": payload.length, ...headers },
          timeout: this.cfg.timeoutMs ?? 60_000,
          ...(url.protocol === "https:" ? { agent: new https.Agent({ rejectUnauthorized: !(this.cfg.insecureTls ?? process.env.TAX_API_INSECURE_TLS === "true") }) } : {}),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let json: any = null;
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              /* پاسخ غیر JSON */
            }
            resolve({ status: res.statusCode ?? 0, json });
          });
        }
      );
      req.on("timeout", () => req.destroy(new TaxApiError("پاسخی از سامانه مودیان دریافت نشد (تایم‌اوت)")));
      req.on("error", (e) => reject(e instanceof TaxApiError ? e : new TaxApiError(`خطا در ارتباط با سامانه مودیان: ${e.message}`)));
      req.write(payload);
      req.end();
    });
  }

  private essentialHeaders(withToken: boolean): Record<string, string> {
    const h: Record<string, string> = { requestTraceId: crypto.randomUUID(), timestamp: String(Date.now()) };
    if (withToken) {
      if (!this.token) throw new TaxApiError("توکن دریافت نشده است");
      h.Authorization = `Bearer ${this.token.value}`;
    }
    return h;
  }

  /** هدرهایی که در متن امضا می‌آیند (Authorization بدون «Bearer ») */
  private signingHeaders(h: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) out[k] = k === "Authorization" ? v.slice(7) : v;
    return out;
  }

  private throwIfErrors(res: RawResponse) {
    const errors = res.json?.errors;
    if (Array.isArray(errors) && errors.length) throw new TaxApiError(errors[0].detail || "خطای سامانه مودیان", errors[0].errorCode, res.status);
    if (res.status < 200 || res.status >= 300 || !res.json) throw new TaxApiError(`پاسخ نامعتبر از سامانه مودیان (HTTP ${res.status})`, undefined, res.status);
  }

  /** درخواست همگام (sync): بسته بدون رمزنگاری و بدون امضای محتوا؛ امضا فقط در سطح انتقال */
  private async sync<T = any>(packetType: string, data: any, withToken: boolean): Promise<T> {
    const headers = this.essentialHeaders(withToken);
    const packet = {
      uid: crypto.randomUUID(),
      packetType,
      retry: false,
      data,
      encryptionKeyId: null,
      symmetricKey: null,
      iv: null,
      fiscalId: this.cfg.fiscalId,
      dataSignature: null,
    };
    const signature = this.sign(normalizeForSignature(packet, this.signingHeaders(headers)));
    const body = stringifyWire({ packet: { ...packet, signatureKeyId: null }, signature, signatureKeyId: null });
    const res = await this.post(`self-tsp/sync/${packetType}`, body, headers);
    this.throwIfErrors(res);
    return res.json?.result?.data as T;
  }

  async getServerInformation(): Promise<{ serverTime: number; publicKeys: { key: string; id: string; algorithm: string; purpose: number }[] }> {
    const info = await this.sync("GET_SERVER_INFORMATION", null, false);
    const k = info?.publicKeys?.[0];
    if (!k?.key || !k?.id) throw new TaxApiError("کلید عمومی سازمان در پاسخ GET_SERVER_INFORMATION نیست");
    this.serverKey = { id: k.id, key: k.key };
    return info;
  }

  async requestToken(): Promise<string> {
    const t = await this.sync<{ token: string; expiresIn: number }>("GET_TOKEN", { username: this.cfg.fiscalId }, false);
    if (!t?.token) throw new TaxApiError("توکن دریافت نشد");
    // expiresIn واحدش در مستندات نیست؛ احتیاطاً هر عملیات (ارسال/استعلام) توکن تازه می‌گیرد و فقط تا ۵۰ ثانیه بازاستفاده می‌شود
    this.token = { value: t.token, expiresAt: Date.now() + 50_000 };
    return t.token;
  }

  private async ensureReady(needServerKey: boolean) {
    if (needServerKey && !this.serverKey) await this.getServerInformation();
    if (!this.token || this.token.expiresAt < Date.now()) await this.requestToken();
  }

  /** آماده‌سازی ارتباط (کلید سازمان + توکن) — پیش از رزرو سریال صدا زده می‌شود تا آدرس/احراز هویت اشتباه هیچ سریالی را نسوزاند و فاکتوری را قفل نکند */
  async prepare(): Promise<void> {
    await this.ensureReady(true);
  }

  /** ارسال صورتحساب‌ها (غیرهمگام). نتیجه: شماره پیگیری هر uid */
  async sendInvoices(items: { uid: string; invoice: WireInvoice }[]): Promise<PacketResult[]> {
    if (!items.length) return [];
    await this.ensureReady(true);
    const server = this.serverKey!;
    const headers = this.essentialHeaders(true);

    const aesPackets = items.map((it) => {
      const dataSignature = this.sign(normalizeForSignature(it.invoice));
      const enc = encryptJsonForTax(stringifyWire(it.invoice), server.key);
      return {
        uid: it.uid,
        packetType: "INVOICE.V01",
        retry: false,
        data: enc.data,
        encryptionKeyId: server.id,
        symmetricKey: enc.symmetricKey,
        iv: enc.iv,
        fiscalId: this.cfg.fiscalId,
        dataSignature,
      };
    });
    const signature = this.sign(normalizeForSignature({ packets: aesPackets }, this.signingHeaders(headers)));
    const body = stringifyWire({ packets: aesPackets.map((p) => ({ ...p, signatureKeyId: null })), signature, signatureKeyId: null });
    const res = await this.post("self-tsp/async/normal-enqueue", body, headers);
    this.throwIfErrors(res);
    const result: any[] = Array.isArray(res.json?.result) ? res.json.result : [];
    return result.map((r) => ({ uid: r.uid, referenceNumber: r.referenceNumber ?? null, errorCode: r.errorCode ?? null, errorDetail: r.errorDetail ?? null }));
  }

  private mapInquiry(list: any): InquiryResult[] {
    return (Array.isArray(list) ? list : []).map((r) => ({
      referenceNumber: r.referenceNumber,
      uid: r.uid,
      status: String(r.status ?? ""),
      data: r.data ?? null,
      packetType: r.packetType ?? null,
      fiscalId: r.fiscalId ?? null,
    }));
  }

  async inquiryByReferenceNumbers(referenceNumbers: string[]): Promise<InquiryResult[]> {
    if (!referenceNumbers.length) return [];
    await this.ensureReady(false);
    return this.mapInquiry(await this.sync("INQUIRY_BY_REFERENCE_NUMBER", { referenceNumber: referenceNumbers }, true));
  }

  async inquiryByUids(items: { uid: string; fiscalId?: string }[]): Promise<InquiryResult[]> {
    if (!items.length) return [];
    await this.ensureReady(false);
    return this.mapInquiry(await this.sync("INQUIRY_BY_UID", items.map((i) => ({ uid: i.uid, fiscalId: i.fiscalId ?? this.cfg.fiscalId })), true));
  }
}

/** ترانسپورت یک حافظه مالیاتی؛ اگر ارسال روشن نباشد خطای «آماده نیست» می‌دهد */
export function createTaxTransport(cfg: TaxTransportConfig): TaxTransport {
  if (!isTaxTransportEnabled()) throw new TaxTransportNotReadyError();
  return new TaxTransport(cfg);
}
