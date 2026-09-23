import { useEffect } from "react";
import { showError } from "../lib/toast";

/** جایگزین کادر خطای داخل فرم: هر بار که message مقدار بگیرد، آن را به‌صورت toast قرمز شناور نشان می‌دهد و
 * خودش چیزی رندر نمی‌کند (پس چیدمان فرم جابه‌جا نمی‌شود). */
export function ErrorToast({ message }: { message: string | null | undefined }) {
  useEffect(() => {
    if (message) showError(message);
  }, [message]);
  return null;
}
