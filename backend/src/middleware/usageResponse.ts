import type { NextFunction, Request, Response } from "express";
import { getRequestContext } from "../lib/requestContext";

// فهرست ساختاریافته‌ی «موارد استفاده» (lib/deleteUsage.ts) را به هر پاسخ خطایی اضافه می‌کند که پیامش همان پیام حذف‌ممنوع است — حتی وقتی route خطا را
// خودش گرفته و فقط { error: e.message } فرستاده؛ فرانت‌اند (lib/api.ts) با «usageGroups» دیالوگ «موارد استفاده» را باز می‌کند.
export function usageResponse(_req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = (body?: any) => {
    const d = getRequestContext()?.shared?.deleteBlocked;
    if (d && body && typeof body === "object" && !Array.isArray(body) && typeof body.error === "string" && body.error.includes(d.header)) {
      body = { ...body, header: d.header, usageGroups: d.groups };
    }
    return original(body);
  };
  next();
}
