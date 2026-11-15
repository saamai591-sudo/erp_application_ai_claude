/**
 * اجرای داخلیِ یک handlerِ مسیر Express (همان منطق دکمه‌ی دستی، بدون HTTP و بدون نسخه‌ی دومِ قواعد) با req/res ساختگی.
 * قبلاً در payments، receipts و jobs/issuers سه بار نوشته شده بود. خروجی: کد وضعیت و بدنه‌ی JSON پاسخ.
 */
export async function invokeRouteHandler(
  handler: (req: any, res: any) => Promise<unknown>,
  id: number,
  body: Record<string, unknown> = {}
): Promise<{ status: number; body: any }> {
  let status = 200;
  let out: any;
  const res: any = {
    status(code: number) {
      status = code;
      return res;
    },
    json(b: unknown) {
      out = b;
      return res;
    },
    send() {
      return res;
    },
  };
  await handler({ params: { id: String(id) }, body }, res);
  return { status, body: out };
}

/** مثل invokeRouteHandler ولی پاسخ ≥ ۴۰۰ را با همان پیام handler به خطا تبدیل می‌کند. */
export async function runRouteHandler(handler: (req: any, res: any) => Promise<unknown>, id: number, body: Record<string, unknown> = {}): Promise<any> {
  const r = await invokeRouteHandler(handler, id, body);
  if (r.status >= 400) throw new Error(r.body?.error || "خطا");
  return r.body;
}
