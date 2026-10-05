# clip-post.ps1 - put a Telegram post into the Windows clipboard as rich text
#
# Usage (from repo root):
#   powershell -NoProfile -STA -ExecutionPolicy Bypass -File tools/clip-post.ps1 -Path post.txt
#
# post.txt - the post exactly as it goes to the channel, UTF-8:
# line breaks and blank lines are kept, [text](url) becomes a hidden link.
# After that the operator presses Ctrl+V in Telegram.
#
# Why not Set-Clipboard -AsHtml: in Windows PowerShell 5.1 it breaks Cyrillic
# (Telegram shows black diamonds). CF_HTML is assembled by hand from UTF-8 bytes.
# Why not text in chat: chat markdown loses blank lines on copy.
# This file must stay ASCII-only: PS 5.1 reads a BOM-less script as ANSI.
param([Parameter(Mandatory = $true)][string]$Path)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Web

$utf8 = New-Object System.Text.UTF8Encoding($false)
$text = [IO.File]::ReadAllText((Resolve-Path $Path), $utf8).Trim() -replace "`r`n", "`n"
if (-not $text) { throw "post is empty: $Path" }

# plain text: links shown as their anchor text
$linkRe = '\[([^\]]+)\]\((https?://[^)\s]+)\)'
$plain = ([regex]::Replace($text, $linkRe, '$1')) -replace "`n", "`r`n"

# html fragment: escape, then links, then line breaks
$frag = [System.Web.HttpUtility]::HtmlEncode($text)
$frag = [regex]::Replace($frag, $linkRe, '<a href="$2">$1</a>')
$frag = $frag -replace "`n", '<br>'

$pre  = '<html><head><meta charset="utf-8"></head><body><!--StartFragment-->'
$post = '<!--EndFragment--></body></html>'
$tmpl = "Version:0.9`r`nStartHTML:{0:D10}`r`nEndHTML:{1:D10}`r`nStartFragment:{2:D10}`r`nEndFragment:{3:D10}`r`n"
$startHtml = $utf8.GetByteCount(($tmpl -f 0, 0, 0, 0))
$startFrag = $startHtml + $utf8.GetByteCount($pre)
$endFrag   = $startFrag + $utf8.GetByteCount($frag)
$endHtml   = $endFrag + $utf8.GetByteCount($post)
$full  = ($tmpl -f $startHtml, $endHtml, $startFrag, $endFrag) + $pre + $frag + $post
$bytes = $utf8.GetBytes($full + [char]0)

$data = New-Object System.Windows.Forms.DataObject
$data.SetData('HTML Format', (New-Object IO.MemoryStream(, $bytes)))
$data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $plain)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)

if ([System.Windows.Forms.Clipboard]::GetText() -ne $plain) { throw 'clipboard text mismatch after write' }
$links = [regex]::Matches($text, $linkRe).Count
"OK: post in clipboard, $($plain.Length) chars, $links links"
