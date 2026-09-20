import { MODULES, NavItem } from "../navConfig";

function findNavItem(pathname: string): { item: NavItem; kind: "list" | "new" | "edit" } | null {
  for (const mod of MODULES) {
    for (const sub of mod.subModules) {
      for (const item of sub.items) {
        if (pathname === item.list) return { item, kind: "list" };
        if (item.create && pathname === item.create) return { item, kind: "new" };
        if (pathname.startsWith(item.list + "/")) return { item, kind: "edit" };
      }
    }
  }
  return null;
}

/** عنوان مناسب برای نمایش در تب، بر اساس مسیر فعلی */
export function getTitleForPath(pathname: string): string {
  if (pathname === "/") return "خانه";
  const found = findNavItem(pathname);
  if (!found) return "صفحه";
  if (found.kind === "list") return found.item.label;
  // فرم‌هایی که در navConfig مسیر create ندارند (مثل تعریف حسابها) هم مسیر /new دارند؛ آن‌ها نباید «ویرایش» نمایش داده شوند
  if (found.kind === "new" || pathname.endsWith("/new")) return `${found.item.label} جدید`;
  return `ویرایش ${found.item.label}`;
}
