; نصب‌کننده‌ی ویندوز «عامل تردد» (ERP Attendance Agent). با installer/build.mjs ساخته می‌شود (متغیرها: VERSION, STAGE, OUTFILE).
; متن نصب‌کننده عمداً انگلیسی است (NSIS راست‌به‌چپ را درست نشان نمی‌دهد)؛ صفحه‌ی تنظیم خود برنامه فارسی است.
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define APPNAME "ERP Attendance Agent"
!define TASKNAME "ERP Attendance Agent"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ERPAttendanceAgent"

Name "${APPNAME}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\${APPNAME}"
InstallDirRegKey HKLM "Software\${APPNAME}" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
BrandingText "${APPNAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileDescription" "${APPNAME} installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "Saam"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "This installs the ERP Attendance Agent: a small background program that reads the punch records of your time-clock database (read-only) and sends them to the ERP.$\r$\n$\r$\nAfter installation a settings page opens in your browser where you enter the ERP address, the connection token and the time-clock database details."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open the settings page now"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchSetup
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function LaunchSetup
  Exec '"$INSTDIR\ERP-Attendance-Agent.exe"'
FunctionEnd

Section "Install"
  SetShellVarContext all
  SetOverwrite on

  ; اگر کار زمان‌بندی‌شده از قبل نصب است (به‌روزرسانی)، قبل از جایگزینی فایل‌ها متوقف و بعد دوباره شروع می‌شود
  StrCpy $9 "0"
  nsExec::ExecToStack `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Get-ScheduledTask -TaskName '${TASKNAME}' -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName '${TASKNAME}' -ErrorAction SilentlyContinue; exit 0 } else { exit 1 }"`
  Pop $0
  ${If} $0 == "0"
    StrCpy $9 "1"
    Sleep 1500
  ${EndIf}

  SetOutPath "$INSTDIR"
  File "${STAGE}\node.exe"
  File "${STAGE}\agent.mjs"
  File "${STAGE}\ERP-Attendance-Agent.exe"
  File "${STAGE}\setup.cmd"
  File "${STAGE}\test.cmd"
  File "${STAGE}\preview.cmd"
  File "${STAGE}\once.cmd"
  File "${STAGE}\open-log.cmd"
  SetOutPath "$INSTDIR\scripts"
  File "${STAGE}\scripts\install-task.ps1"
  File "${STAGE}\scripts\uninstall-task.ps1"

  ; پوشه‌ی تنظیمات/وضعیت/لاگ (ProgramData) فقط برای مدیران و SYSTEM
  CreateDirectory "$APPDATA\${APPNAME}"
  nsExec::ExecToLog `icacls "$APPDATA\${APPNAME}" /inheritance:r /grant:r *S-1-5-32-544:(OI)(CI)F *S-1-5-18:(OI)(CI)F`
  Pop $0

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\ERP Attendance Agent (status and settings).lnk" "$INSTDIR\ERP-Attendance-Agent.exe"
  CreateShortcut "$DESKTOP\ERP Attendance Agent.lnk" "$INSTDIR\ERP-Attendance-Agent.exe"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Test connections.lnk" "$INSTDIR\test.cmd"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Preview data.lnk" "$INSTDIR\preview.cmd"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Send now (one round).lnk" "$INSTDIR\once.cmd"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Open log.lnk" "$INSTDIR\open-log.cmd"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"

  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "${UNKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNKEY}" "Publisher" "Saam"
  WriteRegStr HKLM "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKLM "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNKEY}" "NoRepair" 1

  ${If} $9 == "1"
    nsExec::ExecToLog `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-ScheduledTask -TaskName '${TASKNAME}'"`
    Pop $0
  ${EndIf}
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  nsExec::ExecToLog `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\uninstall-task.ps1"`
  Pop $0
  Sleep 1000

  Delete "$INSTDIR\node.exe"
  Delete "$INSTDIR\agent.mjs"
  Delete "$INSTDIR\ERP-Attendance-Agent.exe"
  Delete "$INSTDIR\setup.cmd"
  Delete "$INSTDIR\test.cmd"
  Delete "$INSTDIR\preview.cmd"
  Delete "$INSTDIR\once.cmd"
  Delete "$INSTDIR\open-log.cmd"
  Delete "$INSTDIR\scripts\install-task.ps1"
  Delete "$INSTDIR\scripts\uninstall-task.ps1"
  RMDir "$INSTDIR\scripts"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$DESKTOP\ERP Attendance Agent.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\*.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKLM "${UNKEY}"
  DeleteRegKey HKLM "Software\${APPNAME}"

  IfSilent +3
  MessageBox MB_YESNO|MB_DEFBUTTON2 "Also delete the settings, saved progress and log folder?$\r$\n$APPDATA\${APPNAME}$\r$\n$\r$\n(Choose No to keep them for a later re-install.)" IDNO +2
  RMDir /r "$APPDATA\${APPNAME}"
SectionEnd
