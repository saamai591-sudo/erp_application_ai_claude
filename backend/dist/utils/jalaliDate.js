"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDateString = resolveDateString;
exports.toJalaliYearMonth = toJalaliYearMonth;
exports.formatJalaliDateForMessage = formatJalaliDateForMessage;
const react_date_object_1 = __importDefault(require("react-date-object"));
const persian_1 = __importDefault(require("react-date-object/calendars/persian"));
const persian_fa_1 = __importDefault(require("react-date-object/locales/persian_fa"));
const gregorian_1 = __importDefault(require("react-date-object/calendars/gregorian"));
const gregorian_en_1 = __importDefault(require("react-date-object/locales/gregorian_en"));
const digits_1 = require("./digits");
/**
 * تشخیص خودکار و تبدیل یک رشته تاریخ (شمسی با هر جداکننده و ارقام فارسی/انگلیسی، یا میلادی ایزو)
 * به فرمت میلادی YYYY-MM-DD. برای مقادیر نامعتبر، همان مقدار ورودی را برمی‌گرداند (اعتبارسنجی
 * بعدی در ساخت Date مسئول رد کردنش خواهد بود).
 */
function resolveDateString(raw) {
    if (!raw)
        return raw;
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch && Number(isoMatch[1]) >= 1700)
        return raw;
    const normalized = (0, digits_1.toEnglishDigits)(raw).trim();
    const digitsOnlyStr = normalized.replace(/[^\d]/g, "");
    let year, month, day;
    if (digitsOnlyStr.length === 8) {
        year = Number(digitsOnlyStr.slice(0, 4));
        month = Number(digitsOnlyStr.slice(4, 6));
        day = Number(digitsOnlyStr.slice(6, 8));
    }
    else {
        const parts = normalized.split(/[\/\-.]/).map((p) => p.trim()).filter(Boolean);
        if (parts.length !== 3)
            return raw;
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = Number(parts[2]);
    }
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31)
        return raw;
    try {
        const j = new react_date_object_1.default({ year, month, day, calendar: persian_1.default, locale: persian_fa_1.default });
        return j.convert(gregorian_1.default, gregorian_en_1.default).format("YYYY-MM-DD");
    }
    catch {
        return raw;
    }
}
/** تاریخ میلادی ذخیره‌شده در دیتابیس را به سال/ماه شمسی تبدیل می‌کند (برای بازه‌بندی گزارش تحلیلی بر اساس دوره) */
function toJalaliYearMonth(date) {
    const j = new react_date_object_1.default({ date, calendar: gregorian_1.default, locale: gregorian_en_1.default }).convert(persian_1.default, persian_fa_1.default);
    return { year: j.year, month: j.month.number };
}
/**
 * تاریخ میلادی را به رشته‌ی شمسی YYYY/MM/DD (ارقام انگلیسی، هم‌الگوی بقیه‌ی اعداد داخل پیام‌های خطای
 * بک‌اند) تبدیل می‌کند — برای نمایش تاریخ داخل پیام‌های خطای کاربرپسند (کاربر تاریخ میلادی خام را
 * نمی‌فهمد؛ همیشه با تاریخ شمسی کار می‌کند).
 */
function formatJalaliDateForMessage(date) {
    const j = new react_date_object_1.default({ date, calendar: gregorian_1.default, locale: gregorian_en_1.default }).convert(persian_1.default, persian_fa_1.default);
    return `${String(j.year).padStart(4, "0")}/${String(j.month.number).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
}
