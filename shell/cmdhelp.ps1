#requires -Version 7.4
# Dot-source after other prompt plugins. Model output is data, never shell code.
Import-Module PSReadLine -ErrorAction Stop

$cmdhelpCli = Join-Path (Split-Path $PSScriptRoot -Parent) 'src/cli.ts'
Set-Item -Path Function:global:cmdhelp -Value {
  if ($MyInvocation.ExpectingInput) {
    $input | & bun $cmdhelpCli --shell powershell @args
  } else {
    & bun $cmdhelpCli --shell powershell @args
  }
}.GetNewClosure()

Set-Item -Path Function:global:Invoke-CmdhelpPanel -Value {
  param([string]$Mode, [string]$InputFile, [string]$OutputFile)
  # PSReadLine captures handler pipeline output. Start the panel with inherited
  # console handles so Bun sees a terminal, and pass every argument literally.
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = @(Get-Command bun -CommandType Application -ErrorAction Stop)[0].Source
  $start.UseShellExecute = $false
  foreach ($argument in @($cmdhelpCli, '--shell', 'powershell', 'ui', '--mode', $Mode, '--buffer-file', $InputFile, '--output-file', $OutputFile)) {
    $start.ArgumentList.Add($argument)
  }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $start
  try {
    [void]$process.Start()
    $process.WaitForExit()
    return $process.ExitCode
  } finally { $process.Dispose() }
}.GetNewClosure()

function global:Invoke-CmdhelpWidget {
  param([ValidateSet('suggest', 'explain')][string]$Mode)

  $savedBuffer = ''
  $savedCursor = 0
  [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$savedBuffer, [ref]$savedCursor)
  $taskDir = Join-Path ([IO.Path]::GetTempPath()) ('cmdhelp.' + [Guid]::NewGuid().ToString('N'))
  $created = $false
  $nextBuffer = $savedBuffer
  $nextCursor = $savedCursor
  try {
    # Apply privacy at creation, before writing any shell input.
    if ($IsWindows) {
      $security = [Security.AccessControl.DirectorySecurity]::new()
      $security.SetAccessRuleProtection($true, $false)
      $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
      $security.SetOwner($sid)
      $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        $sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
      $security.AddAccessRule($rule)
      [void][IO.FileSystemAclExtensions]::CreateDirectory($security, $taskDir)
    } else {
      [void][IO.Directory]::CreateDirectory($taskDir, [IO.UnixFileMode]::UserRead -bor [IO.UnixFileMode]::UserWrite -bor [IO.UnixFileMode]::UserExecute)
    }
    $created = $true
    $inputFile = Join-Path $taskDir 'input'
    $outputFile = Join-Path $taskDir 'result'
    [IO.File]::WriteAllText($inputFile, $savedBuffer, [Text.UTF8Encoding]::new($false))
    [Console]::WriteLine()
    $exitCode = Invoke-CmdhelpPanel $Mode $inputFile $outputFile
    if ($exitCode -eq 0 -and $Mode -eq 'suggest' -and [IO.File]::Exists($outputFile)) {
      $selected = [IO.File]::ReadAllText($outputFile, [Text.Encoding]::UTF8).Replace("`r`n", "`n")
      if ($selected.Length -gt 0 -and $selected -notmatch '[\x00-\x08\x0b-\x1f\x7f-\x9f]') {
        $nextBuffer = $selected
        $nextCursor = $selected.Length
      }
    }
  } finally {
    try {
      if ($created) { Remove-Item -LiteralPath $taskDir -Recurse -Force -ErrorAction Stop }
    } finally {
      # Replace edits the buffer literally, including multiline commands. Never AcceptLine.
      [Microsoft.PowerShell.PSConsoleReadLine]::Replace(0, $savedBuffer.Length, $nextBuffer)
      [Microsoft.PowerShell.PSConsoleReadLine]::SetCursorPosition($nextCursor)
      [Microsoft.PowerShell.PSConsoleReadLine]::InvokePrompt()
    }
  }
}

Set-PSReadLineKeyHandler -Chord 'Ctrl+x,Ctrl+g' -BriefDescription CmdhelpSuggest -ScriptBlock { Invoke-CmdhelpWidget suggest }
Set-PSReadLineKeyHandler -Chord 'Ctrl+x,Ctrl+e' -BriefDescription CmdhelpExplain -ScriptBlock { Invoke-CmdhelpWidget explain }
