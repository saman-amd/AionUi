#!/usr/bin/env node
/**
 * Read a Word document and output text content including headers/footers.
 * Delegates to read-docx.py (headers, footers, heading markers).
 * Falls back to PowerShell ZIP/XML extraction if Python is unavailable.
 * Usage: node read-docx.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.log('Usage: node read-docx.js <file_path>');
  process.exit(1);
}

const filePath = path.resolve(process.argv[2]);
const pyScript = path.join(__dirname, 'read-docx.py');

// Primary: Python (headers, footers, heading markers, proper .doc fallback)
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 60000, maxBuffer: 20 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: PowerShell ZIP/XML extraction
// Reads document body AND header/footer XML parts
try {
  const escapedPath = filePath.replace(/'/g, "''");
  const cmd = [
    `powershell -Command "`,
    `Add-Type -A 'System.IO.Compression.FileSystem';`,
    `$z = [IO.Compression.ZipFile]::OpenRead('${escapedPath}');`,
    // header and footer parts
    `$hfEntries = $z.Entries | Where-Object { $_.FullName -match 'word/(header|footer)[0-9]*\\.xml$' };`,
    `$hfTexts = @();`,
    `foreach ($hf in $hfEntries) {`,
    `  $r = New-Object IO.StreamReader($hf.Open()); $xml = $r.ReadToEnd(); $r.Close();`,
    `  $m = [regex]::Matches($xml, '<w:t[^>]*>([^<]+)</w:t>');`,
    `  $hfTexts += $m | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ -ne '' };`,
    `};`,
    `if ($hfTexts.Count -gt 0) { Write-Output '[Document Header/Footer]'; Write-Output ($hfTexts -join [char]10); Write-Output '' };`,
    // document body
    `$doc = $z.Entries | Where-Object { $_.FullName -eq 'word/document.xml' } | Select-Object -First 1;`,
    `if ($doc) {`,
    `  $r = New-Object IO.StreamReader($doc.Open()); $xml = $r.ReadToEnd(); $r.Close();`,
    `  $xml = $xml -replace '<w:br[^/]*/>', [char]10;`,
    `  $xml = $xml -replace '</w:p>', [char]10;`,
    `  $xml = $xml -replace '<[^>]+>', '';`,
    `  $xml = $xml -replace '&amp;','&' -replace '&lt;','<' -replace '&gt;','>' -replace '&quot;','\"';`,
    `  Write-Output $xml.Trim()`,
    `} else { Write-Output '[No document content found]' };`,
    `$z.Dispose()"`,
  ].join(' ');
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 20000, maxBuffer: 20 * 1024 * 1024 });
  console.log(result.trim() ? result : '[No text content found]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
