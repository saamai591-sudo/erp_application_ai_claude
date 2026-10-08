// «راهبری» بین اسناد (مثلاً صدور حواله از پیش‌فاکتور): دیالوگ مبدأ، داده‌ی پیش‌پر را در حافظه می‌گذارد (stageFormPrefill) و سپس تبِ «جدید» فرم مقصد را باز
// می‌کند؛ فرم مقصد بعد از بارگذاری اولیه‌اش آن را برمی‌دارد (takeFormPrefill) و **با handlerهای خودش** هدر/ردیف‌ها را پر می‌کند — دقیقاً مثل اینکه
// کاربر مبنا را انتخاب و ردیف‌ها را تیک بزند؛ پس منطق ردیف‌سازی هیچ‌جا کپی نمی‌شود. کلید = مسیر فرم مقصد بدون query (مثلاً /sales-deliveries/new)؛
// یک‌بارمصرف است و بعد از ۳۰ ثانیه منقضی می‌شود تا داده‌ی مانده‌ی قدیمی روی یک «جدید» معمولی نشیند.

interface Entry {
  payload: unknown;
  at: number;
}

const staged = new Map<string, Entry>();
const TTL_MS = 30_000;

export function stageFormPrefill(newFormPath: string, payload: unknown) {
  staged.set(newFormPath, { payload, at: Date.now() });
}

export function takeFormPrefill<T>(newFormPath: string): T | null {
  const e = staged.get(newFormPath);
  staged.delete(newFormPath);
  return e && Date.now() - e.at < TTL_MS ? (e.payload as T) : null;
}
