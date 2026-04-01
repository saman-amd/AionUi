#!/usr/bin/env node
/**
 * Read a PowerPoint file and output text content.
 * Tries Python first, falls back to PowerShell XML extraction.
 * Usage: node read-pptx.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) { console.log('Usage: node read-pptx.js <file_path>'); process.exit(1); }

const filePath = process.argv[2];
const pyScript = path.join(__dirname, 'read-pptx.py');

// Try Python script (best quality)
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: PowerShell ZIP/XML extraction (PPTX is a ZIP with XML slides)
try {
  const escapedPath = filePath.replace(/'/g, "''");
  const cmd = `powershell -Command "Add-Type -A 'System.IO.Compression.FileSystem'; $z = [IO.Compression.ZipFile]::OpenRead('${escapedPath}'); $slides = $z.Entries | Where-Object { $_.FullName -match 'ppt/slides/slide[0-9]+\\.xml$' } | Sort-Object FullName; foreach ($s in $slides) { $r = New-Object IO.StreamReader($s.Open()); $xml = $r.ReadToEnd(); $r.Close(); $matches = [regex]::Matches($xml, '<a:t>([^<]+)</a:t>'); $texts = $matches | ForEach-Object { $_.Groups[1].Value }; if ($texts.Count -gt 0) { Write-Output ('--- ' + $s.Name + ' ---'); Write-Output ($texts -join [char]10); Write-Output '' } }; $z.Dispose()"`;
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 });
  console.log(result.trim() ? result : '[No text content found in presentation]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
