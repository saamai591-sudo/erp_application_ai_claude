// پل امن بین صفحه‌ی ERP و برنامه‌ی صندوق: صفحه با window.posApp می‌فهمد داخل برنامه است و چاپ مستقیم روی چاپگر ویندوز می‌خواهد.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posApp", {
  isApp: true,
  /** فهرست چاپگرهای ویندوزِ همین کامپیوتر: [{ name, isDefault }] */
  listPrinters: () => ipcRenderer.invoke("pos:list-printers"),
  /** چاپ HTML روی چاپگر با نام مشخص (بی‌دیالوگ). خطا = reject */
  print: (job) => ipcRenderer.invoke("pos:print", job),
  /** اجرای تراکنش کارتخوان مستقیم روی دستگاه (بدون عامل). job = { requestUid, driver, amount, terminalNumber } ⇒ نتیجه‌ی نهایی { status, referenceNumber?, maskedCard?, errorCode?, errorMessage? } */
  cardPay: (job) => ipcRenderer.invoke("pos:card-pay", job),
  /** دستگاه‌های سداد که در شبکه‌ی همین کامپیوتر پخش می‌کنند: [{ ip, port, terminalId, merchantId, model, name }] */
  cardDiscover: () => ipcRenderer.invoke("pos:card-discover"),
  /** نتیجه‌ی تراکنش پایان‌یافته (بعد از بارگذاری مجدد صفحه): نتیجه | { status: "RUNNING" } | null */
  cardResult: (requestUid) => ipcRenderer.invoke("pos:card-result", requestUid),
});
