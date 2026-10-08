// خودآزمون لایه‌ی ارتباط با سامانه مودیان (services/taxTransport.ts + taxWire.ts) با یک سرور ساختگیِ محلی که همان پروتکل SDK رسمی را از سمت سرور پیاده می‌کند:
// امضای انتقال، رمزگشایی بسته، امضای محتوا. فقط «درون‌سازگاری» را می‌سنجد؛ پذیرش نهایی را فقط خود سامانه نشان می‌دهد.
// اجرا: npx tsx src/scripts/selftest-tax-transport.ts

import crypto from "crypto";
import http from "http";
import { AddressInfo } from "net";
import { normalizeForSignature, stringifyWire, toWireInvoice } from "../services/taxWire";
import { TaxTransport, xorCyclic } from "../services/taxTransport";

let failed = 0;
function check(name: string, ok: boolean, extra?: any) {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : ` ${JSON.stringify(extra)}`}`);
  if (!ok) failed++;
}

// ── بردارهای ثابت (از آزمون‌های SDK رسمی)
check("xor", JSON.stringify([...xorCyclic(Buffer.from([0, 1, 0]), Buffer.from([1, 0, 1]))]) === "[1,1,1]");
check("normalize Field#0#Value", normalizeForSignature({ field: "Field", operator: 0, value: "Value" }) === "Field#0#Value");
{
  // کلیدها: a, b, c, d, e.E0, e.E1 ← مقدارها: x##y | # | # | false | 1 | # (null و خالی ← «#»، «#» داخل مقدار ← «##»)
  const n = normalizeForSignature({ a: "x#y", b: null, c: "", d: false, e: [1, null] });
  check("normalize escape/null/bool", n === "x##y#####false#1##", n);
}
check("numbers without exponent", stringifyWire({ f: 0.00000001, i: 1600000000, d: 33.33333334 }) === '{"f":0.00000001,"i":1600000000,"d":33.33333334}', stringifyWire({ f: 0.00000001 }));

// ── سرور ساختگی
const org = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const orgSpki = org.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const taxpayer = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const taxpayerPem = taxpayer.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

const FISCAL_ID = "A11216";
const seen: { decrypted: any[]; contentSigOk: boolean[]; transferSigOk: boolean[] } = { decrypted: [], contentSigOk: [], transferSigOk: [] };

function verify(text: string, sig: string): boolean {
  return crypto.verify("sha256", Buffer.from(text, "utf8"), { key: taxpayer.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(sig, "base64"));
}
function signingHeaders(req: http.IncomingMessage): Record<string, string> {
  const h: Record<string, string> = {};
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.length > 7) h.Authorization = auth.slice(7);
  h.requestTraceId = String(req.headers["requesttraceid"]);
  h.timestamp = String(req.headers["timestamp"]);
  return h;
}

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const send = (obj: any) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(obj));
    };
    const url = req.url || "";
    if (url.includes("/sync/")) {
      const { signatureKeyId: _k, ...packetNoKeyId } = body.packet;
      seen.transferSigOk.push(verify(normalizeForSignature(packetNoKeyId, signingHeaders(req)), body.signature));
      const type = url.split("/").pop();
      if (type === "GET_SERVER_INFORMATION") return send({ timestamp: Date.now(), result: { uid: body.packet.uid, packetType: type, data: { serverTime: Date.now(), publicKeys: [{ key: orgSpki, id: "key-1", algorithm: "RSA", purpose: 1 }] } }, errors: null });
      if (type === "GET_TOKEN") return send({ timestamp: Date.now(), result: { uid: body.packet.uid, packetType: type, data: { token: "tok.en.value", expiresIn: 3600 } }, errors: null });
      if (type === "INQUIRY_BY_REFERENCE_NUMBER")
        return send({ timestamp: Date.now(), result: { uid: body.packet.uid, packetType: type, data: body.packet.data.referenceNumber.map((r: string) => ({ referenceNumber: r, uid: "u", status: "SUCCESS", data: { error: [], warning: [], success: true }, packetType: "receive_invoice_confirm", fiscalId: FISCAL_ID })) }, errors: null });
      return send({ errors: [{ detail: "unknown", errorCode: "X" }] });
    }
    if (url.endsWith("/async/normal-enqueue")) {
      const { signatureKeyId: _k, ...rest } = body;
      const packetsNoKeyId = body.packets.map((p: any) => {
        const { signatureKeyId: _s, ...r } = p;
        return r;
      });
      seen.transferSigOk.push(verify(normalizeForSignature({ packets: packetsNoKeyId }, signingHeaders(req)), body.signature));
      const result = body.packets.map((p: any, i: number) => {
        const hex = crypto.privateDecrypt({ key: org.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(p.symmetricKey, "base64")).toString("utf8");
        const key = Buffer.from(hex, "hex");
        const raw = Buffer.from(p.data, "base64");
        const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(p.iv, "hex"), { authTagLength: 16 });
        d.setAuthTag(raw.subarray(raw.length - 16));
        const xored = Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]);
        const invoice = JSON.parse(xorCyclic(xored, key).toString("utf8"));
        seen.decrypted.push(invoice);
        seen.contentSigOk.push(verify(normalizeForSignature(invoice), p.dataSignature));
        return { uid: p.uid, referenceNumber: `ref-${i + 1}`, errorCode: null, errorDetail: null };
      });
      return send({ timestamp: Date.now(), result, errors: null });
    }
    send({ errors: [{ detail: "not found", errorCode: "404" }] });
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const t = new TaxTransport({ fiscalId: FISCAL_ID, privateKeyPem: taxpayerPem, baseUrl: `http://127.0.0.1:${port}/` });

  const payload = {
    header: { taxid: "A11216050FC00000000403", indatim: 1791291600000, inty: 1, inno: "0000000040", inp: 1, ins: 1, tins: "14009653331", tob: 2, bid: "10103015113", tinb: "10103015113", tprdis: 1600000000, tdis: 0, tadis: 1600000000, tvam: 160000000, todam: 0, tbill: 1760000000, setm: 1 },
    body: [{ sstid: "2901074100024", sstt: "گونی چتایی # درجه 2", mu: "165", am: 400, fee: 4000000, prdis: 1600000000, dis: 0, adis: 1600000000, vra: 10, vam: 160000000, tsstam: 1760000000 }],
    payments: [],
  };
  const wire = toWireInvoice(payload);

  const info = await t.getServerInformation();
  check("server info", info.publicKeys[0].id === "key-1");
  const token = await t.requestToken();
  check("token", token === "tok.en.value");
  const results = await t.sendInvoices([
    { uid: crypto.randomUUID(), invoice: wire },
    { uid: crypto.randomUUID(), invoice: wire },
  ]);
  check("send → reference numbers", results.length === 2 && results[0].referenceNumber === "ref-1" && results[1].referenceNumber === "ref-2", results);
  check("transfer signatures verified by server", seen.transferSigOk.length >= 3 && seen.transferSigOk.every(Boolean), seen.transferSigOk);
  check("content signatures verified by server", seen.contentSigOk.length === 2 && seen.contentSigOk.every(Boolean), seen.contentSigOk);
  check("decrypted invoice equals sent", JSON.stringify(seen.decrypted[0]) === stringifyWire(wire), seen.decrypted[0]);
  const inq = await t.inquiryByReferenceNumbers(["ref-1", "ref-2"]);
  check("inquiry", inq.length === 2 && inq[0].status === "SUCCESS", inq);
  check("all transfer signatures (incl. inquiry)", seen.transferSigOk.every(Boolean), seen.transferSigOk);

  server.close();
  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
