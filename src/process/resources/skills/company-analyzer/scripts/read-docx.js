#!/usr/bin/env node
/**
 * Read a Word document and output text content.
 * Supports: .docx, .doc
 * Uses PowerShell ZIP/XML extraction (no npm dependencies).
 * Usage: node read-docx.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) { console.log('Usage: node read-docx.js <file_path>'); process.exit(1); }

const filePath = path.resolve(process.argv[2]);

// Try Python first (best quality)
const pyScript = path.join(__dirname, 'read-docx.py');
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: DOCX is a ZIP — extract text from word/document.xml
try {
  const escapedPath = filePath.replace(/'/g, "''");
  const cmd = `powershell -Command "Add-Type -A 'System.IO.Compression.FileSystem'; $z = [IO.Compression.ZipFile]::OpenRead('${escapedPath}'); $doc = $z.Entries | Where-Object { $_.FullName -eq 'word/document.xml' } | Select-Object -First 1; if ($doc) { $r = New-Object IO.StreamReader($doc.Open()); $xml = $r.ReadToEnd(); $r.Close(); $xml = $xml -replace '<w:br[^/]*/>', [char]10; $xml = $xml -replace '</w:p>', ([char]10); $xml = $xml -replace '<[^>]+>', ''; $xml = $xml -replace '&amp;', '&'; $xml = $xml -replace '&lt;', '<'; $xml = $xml -replace '&gt;', '>'; $xml = $xml -replace '&quot;', '\"'; Write-Output $xml.Trim() } else { Write-Output '[No document content found]' }; $z.Dispose()"`;
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 });
  console.log(result.trim() ? result : '[No text content found]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
