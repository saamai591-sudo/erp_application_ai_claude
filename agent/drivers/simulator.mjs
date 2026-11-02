// شبیه‌ساز دستگاه (آزمایشی): پس از ۴ ثانیه موفق می‌شود. مبلغ تمام‌شده به 111 = رد بانک، تمام‌شده به 222 = پاسخ نرسید (نامشخص).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

export const simulator = {
  async send({ amount }) {
    await sleep(4000);
    const tail = Math.round(Number(amount)) % 1000;
    if (tail === 111) return { status: "FAILED", errorCode: "SIM_DECLINED", errorMessage: "تراکنش توسط بانک رد شد (شبیه‌ساز)" };
    if (tail === 222) return { status: "UNKNOWN", errorCode: "SIM_TIMEOUT", errorMessage: "پاسخ دستگاه دریافت نشد (شبیه‌ساز)" };
    return { status: "SUCCESS", referenceNumber: `SIM${rnd(10_000_000, 99_999_999)}`, maskedCard: `6037-****-****-${rnd(1000, 9999)}` };
  },
};
