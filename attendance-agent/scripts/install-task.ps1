# نصب «عامل تردد» به‌صورت Scheduled Task ویندوز: با روشن‌شدن رایانه (بدون نیاز به ورود کاربر) اجرا می‌شود و در صورت خطا خودکار دوباره بالا می‌آید.
# اجرا با PowerShell «Run as administrator». نسخه‌ی نصب‌شده با نصب‌کننده، پارامترها را از صفحه‌ی تنظیم می‌گیرد؛ در حالت توسعه (از پوشه‌ی عامل): .\scripts\install-task.ps1
param(
  [string]$Node,
  [string]$Entry,
  [string]$Config
)

$ErrorActionPreference = "Stop"
$name = "ERP Attendance Agent"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Node) { $Node = (Get-Command node -ErrorAction Stop).Source }
if (-not $Entry) { $Entry = Join-Path $root "src\agent.mjs" }
if (-not $Config) { $Config = Join-Path $root "agent.config.json" }
if (-not (Test-Path $Config)) { throw "فایل تنظیمات پیدا نشد: $Config (ابتدا تنظیم را انجام دهید)." }

$workDir = Split-Path -Parent $Entry
$action = New-ScheduledTaskAction -Execute $Node -Argument ('"{0}" run --config "{1}"' -f $Entry, $Config) -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
}
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "نصب شد و شروع به کار کرد. لاگ: $(Split-Path -Parent $Config)\agent.log" -ForegroundColor Green
