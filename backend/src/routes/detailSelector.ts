import { Router } from "express";
import { getDetailSelectorOptions, DetailSelectorCondition } from "../services/detailSelector";

const router = Router();

const VALID_KINDS: DetailSelectorCondition["kind"][] = ["SUPPLIER_PARTY"];

// اندپوینت عمومی «انتخابگر تفصیل پایه» — طبق تصمیم صریح کاربر، هر فرمی که نیاز به فهرست فیلترشده‌ی
// تفصیل دارد (به‌جای فچ مستقیم /parties یا /suppliers و فیلتر محلی) از همین یک اندپوینت با پارامتر
// kind استفاده می‌کند؛ نگاه کنید به services/detailSelector.ts برای اینکه چرا همین شرط بعداً در لحظه‌ی
// ذخیره هم دوباره چک می‌شود.
router.get("/detail-selector-options", async (req, res) => {
  const kind = req.query.kind as string;
  if (!VALID_KINDS.includes(kind as DetailSelectorCondition["kind"])) {
    return res.status(400).json({ error: "شرط انتخابگر نامعتبر است" });
  }
  const condition = { kind } as DetailSelectorCondition;
  res.json(await getDetailSelectorOptions(condition));
});

export default router;
