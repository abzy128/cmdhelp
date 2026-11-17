# Exercise the actual handlers with a PSReadLine buffer double; no credentials or requests.
$ErrorActionPreference = 'Stop'
Add-Type @'
namespace Microsoft.PowerShell {
  public static class PSConsoleReadLine {
    public static string Buffer = "";
    public static int Cursor;
    public static int Prompts;
    public static void GetBufferState(ref string buffer, ref int cursor) { buffer = Buffer; cursor = Cursor; }
    public static void Replace(int start, int length, string text) { Buffer = Buffer.Remove(start, length).Insert(start, text); }
    public static void SetCursorPosition(int cursor) { Cursor = cursor; }
    public static void InvokePrompt() { Prompts++; }
  }
}
'@
function Import-Module { param($Name, $ErrorAction) }
$handlers = @{}
function Set-PSReadLineKeyHandler {
  param($Chord, $BriefDescription, $ScriptBlock)
  $handlers[$Chord] = $ScriptBlock
}
. (Join-Path $PSScriptRoot '../shell/cmdhelp.ps1')
function Assert-Equal($Actual, $Expected) {
  if ($Actual -cne $Expected) { throw "Expected <$Expected>, got <$Actual>" }
}
Assert-Equal $handlers.Count 2
$original = "Get-Item 'café'; `$x = '你好'"
$suggestion = "Write-Output '`$(throw ''must never execute'')'`nWrite-Output '你好'"
function global:Invoke-CmdhelpPanel {
  param($Mode, $InputFile, $OutputFile)
  Assert-Equal $Mode $(if ($script:scenario -eq 'explain') { 'explain' } else { 'suggest' })
  Assert-Equal ([IO.File]::ReadAllText($InputFile)) $original
  $script:lastDir = Split-Path $InputFile
  if ($IsWindows) {
    $acl = Get-Acl -LiteralPath $script:lastDir
    Assert-Equal $acl.AreAccessRulesProtected $true
    Assert-Equal $acl.Access.Count 1
    Assert-Equal ($acl.Access[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value) ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
  } else {
    Assert-Equal ([int][IO.File]::GetUnixFileMode($script:lastDir)) 448
  }
  switch ($script:scenario) {
    'cancel' { return 0 }
    'empty' { [IO.File]::WriteAllText($OutputFile, ''); return 0 }
    'throw' { throw 'fixture launch failure' }
    'controls' { [IO.File]::WriteAllText($OutputFile, "bad`e[31m"); return 0 }
    default { [IO.File]::WriteAllText($OutputFile, $suggestion.Replace("`n", "`r`n")) }
  }
  if ($script:scenario -eq 'failure') { return 1 }
  return 0
}
foreach ($scenario in 'insert', 'cancel', 'empty', 'failure', 'throw', 'controls', 'explain') {
  [Microsoft.PowerShell.PSConsoleReadLine]::Buffer = $original
  [Microsoft.PowerShell.PSConsoleReadLine]::Cursor = 4
  $before = [Microsoft.PowerShell.PSConsoleReadLine]::Prompts
  try {
    if ($scenario -eq 'explain') { & $handlers['Ctrl+x,Ctrl+e'] }
    else { & $handlers['Ctrl+x,Ctrl+g'] }
    if ($scenario -eq 'throw') { throw 'Expected fixture exception' }
  } catch {
    if ($scenario -ne 'throw' -or $_ -notmatch 'fixture launch failure') { throw }
  }
  $expected = if ($scenario -eq 'insert') { $suggestion } else { $original }
  $cursor = if ($scenario -eq 'insert') { $suggestion.Length } else { 4 }
  Assert-Equal ([Microsoft.PowerShell.PSConsoleReadLine]::Buffer) $expected
  Assert-Equal ([Microsoft.PowerShell.PSConsoleReadLine]::Cursor) $cursor
  Assert-Equal ([Microsoft.PowerShell.PSConsoleReadLine]::Prompts) ($before + 1)
  Assert-Equal (Test-Path -LiteralPath $lastDir) $false
}
Write-Output 'PowerShell widget checks passed'
