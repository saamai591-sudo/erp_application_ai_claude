// آدرس پایه‌ی API — تنها نقطه‌ی تعیین آن (api.ts، Management.tsx و ManagementBackup.tsx از همین‌جا می‌خوانند).
// ترتیب: ۱) config.js در زمان اجرا (ایمیج release: از متغیر محیطی VITE_API_URL کانتینر ساخته می‌شود، public/config.js)
// ۲) VITE_API_URL زمان build/dev-server  ۳) همان hostname مرورگر با پورت ۴۰۰۰ — توضیح کامل‌تر در lib/api.ts.
const runtimeUrl: string | undefined = (window as unknown as { __ERP_CONFIG__?: { apiUrl?: string } }).__ERP_CONFIG__?.apiUrl;

export const API_URL: string = runtimeUrl || import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`;
