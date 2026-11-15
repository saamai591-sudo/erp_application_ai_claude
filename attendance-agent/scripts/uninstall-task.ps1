# حذف Scheduled Task «عامل تردد» (فایل‌های برنامه و وضعیت دست‌نخورده می‌مانند). با PowerShell «Run as administrator» اجرا شود.
$ErrorActionPreference = "Stop"
$name = "ERP Attendance Agent"
if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Host "حذف شد." -ForegroundColor Green
} else {
  Write-Host "چنین کاری نصب نیست."
}
