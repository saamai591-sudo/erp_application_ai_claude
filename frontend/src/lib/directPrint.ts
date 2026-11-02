import { api } from "./api";

// چاپ مستقیمِ یک سند بدون پیش‌نمایش: قالب پیش‌فرض همان نوع سند را رندر می‌کند و در یک iframe نامرئی چاپ می‌کند.
// اگر مرورگر با سوئیچ --kiosk-printing اجرا شده باشد (میان‌بر ویژه‌ی صندوق، نگاه کنید به Documents/راهنمای چاپ مستقیم)،
// چاپ بی‌صدا و بدون هیچ پنجره‌ای روی چاپگر پیش‌فرض ویندوز می‌رود؛ وگرنه همان پنجره‌ی چاپ معمولی مرورگر باز می‌شود (رفتار امن پیش‌فرض).

export async function directPrint(docType: string, sourceId: number): Promise<void> {
  const templates: { id: number; isDefault: boolean }[] = await api.get(`/print/${docType}/templates`);
  const tpl = templates.find((t) => t.isDefault) ?? templates[0];
  if (!tpl) throw new Error("قالب چاپ فعالی برای این سند تعریف نشده است");
  const r: { html: string } = await api.get(`/print/${docType}/${sourceId}/render?templateId=${tpl.id}`);

  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // نامرئی ولی دارای اندازه (iframe با اندازه‌ی صفر در بعضی مرورگرها چیزی چاپ نمی‌کند)
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:90mm;height:200mm;border:0;visibility:hidden;";
  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  await new Promise<void>((resolve, reject) => {
    frame.onload = () => {
      const w = frame.contentWindow;
      if (!w) return reject(new Error("چاپ مستقیم ممکن نشد"));
      w.addEventListener("afterprint", cleanup);
      try {
        w.focus();
        w.print();
      } catch (e) {
        return reject(e);
      }
      window.setTimeout(cleanup, 120_000); // مرورگرهایی که afterprint نمی‌فرستند
      resolve();
    };
    frame.srcdoc = r.html;
    document.body.appendChild(frame);
  }).catch((e) => {
    frame.remove();
    throw e;
  });
}
