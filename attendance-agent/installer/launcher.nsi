; راه‌انداز «پنل عامل تردد»: یک exe کوچک که صفحه‌ی «وضعیت و رکوردها / تنظیمات» را (بدون پنجره‌ی cmd) باز می‌کند. با installer/build.mjs ساخته می‌شود (متغیر OUTFILE).
Unicode true
!ifndef OUTFILE
  !define OUTFILE "ERP-Attendance-Agent.exe"
!endif
Name "ERP Attendance Agent"
OutFile "${OUTFILE}"
RequestExecutionLevel admin
SilentInstall silent
ShowInstDetails nevershow
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "ERP Attendance Agent"
VIAddVersionKey "FileDescription" "ERP Attendance Agent panel"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "Saam"

Section
  SetShellVarContext all
  SetOutPath "$EXEDIR"
  ; همان پوشه‌ی داده‌ی نصب‌شده (ProgramData) که سرویس خودکار هم از آن می‌خواند
  System::Call 'Kernel32::SetEnvironmentVariable(t "AGENT_DATA_DIR", t "$APPDATA\ERP Attendance Agent")'
  ExecShell "open" '"$EXEDIR\node.exe"' '"$EXEDIR\agent.mjs" setup' SW_HIDE
SectionEnd
