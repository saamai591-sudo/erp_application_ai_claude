// پل امن بین صفحه‌ی ERP و برنامه‌ی صندوق: صفحه با window.posApp می‌فهمد داخل برنامه است و چاپ مستقیم روی چاپگر ویندوز می‌خواهد.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posApp", {
  isApp: true,
  /** فهرست چاپگرهای ویندوزِ همین کامپیوتر: [{ name, isDefault }] */
  listPrinters: () => ipcRenderer.invoke("pos:list-printers"),
  /** چاپ HTML روی چاپگر با نام مشخص (بی‌دیالوگ). خطا = reject */
  print: (job) => ipcRenderer.invoke("pos:print", job),
});
