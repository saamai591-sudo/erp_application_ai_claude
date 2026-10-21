// دانلود یک فایل از محتوای base64 (فایل‌های تولیدشده‌ی سرور: ساختار فایل، ایجاد فایل از آماده‌سازی پرداخت)
export function downloadBase64(name: string, base64: string, mime = "application/octet-stream") {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** نوع MIME بر اساس پسوند فایل */
export const mimeOfFile = (name: string) =>
  /\.xlsx$/i.test(name) ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : /\.xls$/i.test(name) ? "application/vnd.ms-excel" : /\.zip$/i.test(name) ? "application/zip" : "text/plain";
