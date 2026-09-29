"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const detailSelector_1 = require("../services/detailSelector");
const router = (0, express_1.Router)();
const VALID_KINDS = ["SUPPLIER_PARTY"];
// اندپوینت عمومی «انتخابگر تفصیل پایه» — طبق تصمیم صریح کاربر، هر فرمی که نیاز به فهرست فیلترشده‌ی
// تفصیل دارد (به‌جای فچ مستقیم /parties یا /suppliers و فیلتر محلی) از همین یک اندپوینت با پارامتر
// kind استفاده می‌کند؛ نگاه کنید به services/detailSelector.ts برای اینکه چرا همین شرط بعداً در لحظه‌ی
// ذخیره هم دوباره چک می‌شود.
router.get("/detail-selector-options", async (req, res) => {
    const kind = req.query.kind;
    if (!VALID_KINDS.includes(kind)) {
        return res.status(400).json({ error: "شرط انتخابگر نامعتبر است" });
    }
    const condition = { kind };
    res.json(await (0, detailSelector_1.getDetailSelectorOptions)(condition));
});
exports.default = router;
