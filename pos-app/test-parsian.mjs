// آزمون درایور پارسیان: قالب درخواست با نمونه‌ی ابزار رسمی، و جریان کامل روی دستگاه جعلی TCP (فقط سازگاری درونی؛ نه دستگاه واقعی).
//   node test-parsian.mjs
import assert from "node:assert/strict";
import net from "node:net";
import { buildPurchaseFrame, parseResponse, decide, parsian, maskCard } from "./drivers/parsian.mjs";

assert.equal(buildPurchaseFrame(1000), "0039RQ034PR006000000AM0041000CU003364PD0011");
assert.equal(buildPurchaseFrame(250000), "0041RQ036PR006000000AM006250000CU003364PD0011"); // طول‌ها محاسبه‌ی دستی: بدنه 11+11+8+6=36، کل 41

const tag = (n, v) => `${n}${String(v.length).padStart(3, "0")}${v}`;
const resp = (parts) => { const body = parts.map(([n, v]) => tag(n, v)).join(""); const msg = `RP${String(body.length).padStart(3, "0")}${body}`; return `${String(msg.length).padStart(4, "0")}${msg}`; };

// تجزیه
let t = parseResponse(resp([["RS", "00"], ["RN", "320062616116"], ["TR", "000996"], ["TM", "C0000301"], ["PN", "6219863510313864"], ["AM", "1000"]]));
assert.equal(t.RN, "320062616116"); assert.equal(t.RS, "00"); assert.equal(t.TM, "C0000301");
assert.deepEqual(decide(t), { status: "SUCCESS", referenceNumber: "320062616116", maskedCard: "621986******3864" });
assert.equal(maskCard("6219863510313864"), "621986******3864");
// ناموفق: بدون RN، با کد
assert.equal(decide(parseResponse(resp([["RS", "51"]]))).status, "FAILED");
// ابهام ⇒ نامشخص
assert.equal(decide(parseResponse(resp([["RS", "51"], ["RN", "123"]]))).status, "UNKNOWN");
assert.equal(decide(parseResponse("???")).status, "UNKNOWN");

// جریان کامل روی دستگاه جعلی
async function withDevice(reply, fn, { closeEarly = false } = {}) {
  let got = "";
  const srv = net.createServer((c) => {
    c.on("data", (d) => {
      got += d.toString("latin1");
      if (closeEarly) return c.destroy();
      if (reply) c.write(Buffer.from(reply, "latin1"));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  try { return { r: await fn(port), got }; } finally { srv.close(); }
}
let o = await withDevice(resp([["RS", "00"], ["RN", "320062616116"], ["PN", "6219863510313864"]]), (port) => parsian.send({ amount: 1000, config: { ip: "127.0.0.1", port } }));
assert.equal(o.got, "0039RQ034PR006000000AM0041000CU003364PD0011");
assert.equal(o.r.status, "SUCCESS"); assert.equal(o.r.referenceNumber, "320062616116");
o = await withDevice(resp([["RS", "51"]]), (port) => parsian.send({ amount: 1000, config: { ip: "127.0.0.1", port } }));
assert.equal(o.r.status, "FAILED");
o = await withDevice(null, (port) => parsian.send({ amount: 1000, config: { ip: "127.0.0.1", port } }), { closeEarly: true });
assert.equal(o.r.status, "UNKNOWN");
assert.equal((await parsian.send({ amount: 1000, config: { ip: "127.0.0.1", port: 1 } })).status, "FAILED"); // وصل نشد ⇒ ناموفق قطعی
assert.equal((await parsian.send({ amount: 1000, config: {} })).errorCode, "NO_ADDRESS");
console.log("همه‌ی آزمون‌های پارسیان گذشت (دستگاه جعلی؛ نه دستگاه واقعی)");
