; «نصب‌کننده‌ی ERP روی سرور» — یک exe تک‌فایلی: فایل‌ها را در پوشه‌ی کاربر باز می‌کند و صفحه‌ی نصب را (بدون پنجره‌ی cmd) اجرا می‌کند.
; با installer/build.mjs ساخته می‌شود (متغیرهای OUTFILE، STAGE، VERSION). بدون نیاز به دسترسی مدیر.
Unicode true
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
Name "ERP Server Installer"
OutFile "${OUTFILE}"
RequestExecutionLevel user
SilentInstall silent
ShowInstDetails nevershow
SetCompressor /SOLID lzma
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "ERP Server Installer"
VIAddVersionKey "FileDescription" "ERP Server Installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Saam"

Section
  SetOutPath "$LOCALAPPDATA\ERP-Server-Installer"
  ; اگر نسخه‌ی قبلی هنوز باز است و فایلی قفل است، بی‌صدا رد می‌شود
  SetOverwrite try
  File "${STAGE}\node.exe"
  File "${STAGE}\installer.mjs"
  File "${STAGE}\install.sh"
  File "${STAGE}\ui.html"
  ExecShell "open" '"$OUTDIR\node.exe"' '"$OUTDIR\installer.mjs"' SW_HIDE
SectionEnd
