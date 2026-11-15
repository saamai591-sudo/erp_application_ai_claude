-- حذف ترکیب بهای تولید (بردار ترکیب لایه‌ها، دفتر ترکیب کالا) و اجزای ردیف افتتاحیه‌ی پای کار؛
-- نیمه‌ساخته فقط یک مبلغ («هزینه‌ی انتقالی») است. «WipCountLine.bomId» می‌ماند.
DROP TABLE IF EXISTS "ProductionItemComposition";
DROP TABLE IF EXISTS "ProductionCostComposition";
DROP TABLE IF EXISTS "WipCountLineComponent";
DROP TYPE IF EXISTS "ProductionCompositionScope";
