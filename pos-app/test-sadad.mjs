// آزمون درایور سداد. استفاده:
//   node test-sadad.mjs unit                     ← آزمون واحد با بایت‌های نمونه‌ی سند (بدون شبکه)
//   node test-sadad.mjs discover [شماره‌ی پایانه] ← پیدا کردن دستگاه از روی پخش UDP
//   node test-sadad.mjs info <ip> [port]         ← دست‌دهی INM و دریافت مشخصات دستگاه (بدون هیچ تراکنش مالی)
//   node test-sadad.mjs sale <ip> <مبلغ ریال> [port] ← خرید واقعی! کاربر باید کارت را در دستگاه بزند
import assert from "node:assert/strict";
import { buildFrame, buildSaleData, parseSaleResponse, maskCard, orderIdOf, discover, deviceInfo, sadad, lrc } from "./drivers/sadad.mjs";

const [mode, a, b, c] = process.argv.slice(2);

if (mode === "unit") {
  // INM و ACK — بایت‌های سند
  assert.deepEqual([...buildFrame("000", 0xf1)], [2, 48, 48, 54, 48, 48, 48, 241, 3, 244]);
  assert.deepEqual([...buildFrame("000", 0x06)], [2, 48, 48, 54, 48, 48, 48, 6, 3, 3]);
  assert.deepEqual([...buildFrame("000", 0x04)], [2, 48, 48, 54, 48, 48, 48, 4, 3, 1]);
  // درخواست اطلاعات دستگاه (FunctionCode 0005)
  assert.deepEqual([...buildFrame("002", 0x19, Buffer.from("0005000"))], [2, 48, 49, 51, 48, 48, 50, 25, 48, 48, 48, 53, 48, 48, 48, 3, 47]);
  // خرید ۱۰۰۰ ریال با شناسه‌ی درخواست 321654 (نمونه‌ی سند: طول 077)
  const sale = [2, 48, 54, 56, 48, 48, 48, 25, 49, 48, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 48, 50, 48, 48, 48, 48, 48, 48, 48, 48, 0x90, 48, 48, 54, 51, 50, 49, 54, 53, 52, 48, 49, 50, 53, 46, 51, 46, 49, 56, 53, 46, 49, 51, 51, 54, 3, 0x96];
  assert.deepEqual([...buildFrame("000", 0x19, buildSaleData(1000, "321654"))], sale);
  // پاسخ خرید نمونه‌ی سند
  // پاسخ خرید نمونه در سند (284 بایت) به‌صورت base64
  const buf = Buffer.from("AjI4MDAwMBowADAAAAAAADEAMAAwADAAAAAAAAAAAAAAAAAAAAAAAAAANgAyADEAOQA4ADYAMwA1ADEAMAAzADEAMwA4ADYANAAAADAAMAAwADAAMAAwAAAAMAAwADAAOQA5ADYAAAAAAAAAAAAAAAAAAACNBSIAAAAhACcAPwAgAAAAMwAyADAAMAA2ADIANgAxADYAMQAxADYAAAAwADAAMQA0ACAAIAAAAEMAMAAwADAAMAAzADAAMQAAADAAMAAwADAAMAAwADAAMAAwADAAMAAwADEANQAyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+k=", "base64");
  assert.equal(buf.length, 284, "طول فریم پاسخ");
  const body = buf.subarray(1, buf.length - 2);
  assert.equal(buf[buf.length - 1], lrc(body), "LRC پاسخ");
  const r = parseSaleResponse(buf.subarray(8, buf.length - 2));
  assert.equal(r.posResponse, "00");
  assert.equal(r.amount, "1000");
  assert.equal(r.transactionNo, "000996");
  assert.equal(r.rrn, "320062616116");
  assert.equal(r.approvalCode, "0014");
  assert.equal(r.terminalId, "C0000301");
  assert.equal(maskCard(r.cardNo), "621986******3864");
  assert.equal(orderIdOf("123e4567-e89b-12d3-a456-426614174000").length, 15);
  console.log("همه‌ی آزمون‌های واحد گذشت");
} else if (mode === "discover") {
  console.log(await discover(a));
} else if (mode === "info") {
  console.log(await deviceInfo(a, Number(b) || 8888));
} else if (mode === "sale") {
  const uid = (await import("node:crypto")).randomUUID();
  console.log("requestUid:", uid, "orderId:", orderIdOf(uid));
  console.log(await sadad.send({ requestUid: uid, amount: Number(b), reader: { terminalNumber: "" }, config: { ip: a, port: Number(c) || 8888 } }));
} else {
  console.log("حالت نامعتبر؛ بالای فایل را ببینید");
}
