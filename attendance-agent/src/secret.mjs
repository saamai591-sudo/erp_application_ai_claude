import { spawnSync } from "node:child_process";

// محافظت از رمزها در فایل تنظیمات: در ویندوز با DPAPI در سطح «همین رایانه» (LocalMachine) رمز می‌شوند، پس هم کاربری که تنظیم را انجام داده و هم سرویسی که با حساب دیگر اجرا می‌شود
// می‌تواند بخواند، ولی فایل کپی‌شده روی رایانه‌ی دیگر قابل‌خواندن نیست. این «محافظت در برابر کپی فایل» است نه در برابر کسی که روی همان رایانه مدیر است؛ حفاظت اصلی
// کاربر فقط‌خواندنیِ دیتابیس است. خارج از ویندوز (آزمون توسعه) رمز همان متن ساده می‌ماند.

const PREFIX = "dpapi:";
const isWindows = process.platform === "win32";

function ps(script, secret) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { env: { ...process.env, AGENT_SECRET: secret }, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error(`PowerShell خطا داد: ${(r.stderr || "").trim().slice(0, 200)}`);
  return r.stdout.trim();
}

export function protect(plain) {
  if (!plain || !isWindows || String(plain).startsWith(PREFIX)) return plain;
  const out = ps(
    "Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($env:AGENT_SECRET), $null, 'LocalMachine'))",
    plain,
  );
  return PREFIX + out;
}

export function reveal(value) {
  if (!value || !String(value).startsWith(PREFIX)) return value;
  if (!isWindows) throw new Error("مقدار رمز‌شده با DPAPI فقط در ویندوز خوانده می‌شود");
  return ps(
    "Add-Type -AssemblyName System.Security; [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($env:AGENT_SECRET), $null, 'LocalMachine'))",
    String(value).slice(PREFIX.length),
  );
}
