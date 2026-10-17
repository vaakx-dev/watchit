!define FIREWALL_RULE "Watchit"

!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToStack 'netsh advfirewall firewall show rule name="${FIREWALL_RULE}"'
  Pop $0
  ${If} $0 != 0
    ExecShell "runas" "netsh.exe" 'advfirewall firewall add rule name="${FIREWALL_RULE}" dir=in action=allow protocol=TCP program="$INSTDIR\watchit.exe" profile=private enable=yes' SW_HIDE
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode != 1
    ExecShell "runas" "netsh.exe" 'advfirewall firewall delete rule name="${FIREWALL_RULE}"' SW_HIDE
  ${EndIf}
!macroend
