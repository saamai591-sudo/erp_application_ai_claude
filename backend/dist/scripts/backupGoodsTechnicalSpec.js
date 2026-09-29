"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const prisma_1 = require("../lib/prisma");
// اسکریپت موقتِ مهاجرت «موجودی اول دوره» از سیستم قبلی: قبل از این‌که backfillOldGoodsCode مقدار
// technicalSpec کالاها را موقتاً با کد قدیم پر کند، این اسکریپت مقدار فعلی technicalSpec همه‌ی کالاها
// را در یک فایل JSON پشتیبان می‌گیرد تا بعد از اتمام Import با restoreGoodsTechnicalSpec قابل بازگردانی
// باشد (نه صرفاً خالی‌کردن فیلد، چون ممکن است از قبل مقدار واقعی داشته باشد).
async function main() {
    const outPath = process.argv[2];
    if (!outPath) {
        console.error("استفاده: tsx src/scripts/backupGoodsTechnicalSpec.ts <output-path.json>");
        process.exit(1);
    }
    const items = await prisma_1.prisma.goodsItem.findMany({ select: { id: true, fullCode: true, technicalSpec: true } });
    fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf8");
    console.log(`پشتیبان ${items.length} کالا در «${outPath}» ذخیره شد.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => process.exit(0));
