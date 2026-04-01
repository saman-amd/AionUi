#!/usr/bin/env node
/**
 * Read a PowerPoint file and output text content including speaker notes.
 * Delegates to read-pptx.py (speaker notes, groups, charts).
 * Falls back to PowerShell XML extraction if Python is unavailable.
 * Usage: node read-pptx.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.log('Usage: node read-pptx.js <file_path>');
  process.exit(1);
}

const filePath = process.argv[2];
const pyScript = path.join(__dirname, 'read-pptx.py');

// Primary: Python (speaker notes, grouped shapes, charts, LibreOffice .ppt fallback)
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 60000, maxBuffer: 20 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: PowerShell ZIP/XML extraction
// Extracts slide text AND notes (ppt/notesSlides/notesSlideN.xml)
try {
  const escapedPath = filePath.replace(/'/g, "''");
  const cmd = [
    `powershell -Command "`,
    `Add-Type -A 'System.IO.Compression.FileSystem';`,
    `$z = [IO.Compression.ZipFile]::OpenRead('${escapedPath}');`,
    // slide bodies
    `$slides = $z.Entries | Where-Object { $_.FullName -match 'ppt/slides/slide[0-9]+\\.xml$' } | Sort-Object FullName;`,
    // notes files
    `$notes = $z.Entries | Where-Object { $_.FullName -match 'ppt/notesSlides/notesSlide[0-9]+\\.xml$' } | Sort-Object FullName;`,
    `$slideIdx = 0;`,
    `foreach ($s in $slides) {`,
    `  $slideIdx++;`,
    `  $r = New-Object IO.StreamReader($s.Open()); $xml = $r.ReadToEnd(); $r.Close();`,
    `  $m = [regex]::Matches($xml, '<a:t>([^<]+)</a:t>');`,
    `  $texts = $m | ForEach-Object { $_.Groups[1].Value };`,
    `  $noteEntry = $notes | Where-Object { $_.Name -eq ('notesSlide' + $slideIdx + '.xml') } | Select-Object -First 1;`,
    `  $noteText = '';`,
    `  if ($noteEntry) {`,
    `    $nr = New-Object IO.StreamReader($noteEntry.Open()); $nxml = $nr.ReadToEnd(); $nr.Close();`,
    `    $nm = [regex]::Matches($nxml, '<a:t>([^<]+)</a:t>');`,
    `    $noteText = ($nm | ForEach-Object { $_.Groups[1].Value }) -join ' ';`,
    `  };`,
    `  if ($texts.Count -gt 0 -or $noteText) {`,
    `    Write-Output ('--- Slide ' + $slideIdx + ' ---');`,
    `    if ($texts.Count -gt 0) { Write-Output ($texts -join [char]10) };`,
    `    if ($noteText) { Write-Output ('[Speaker Notes]'); Write-Output $noteText };`,
    `    Write-Output ''`,
    `  }`,
    `};`,
    `$z.Dispose()"`,
  ].join(' ');
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 20000, maxBuffer: 20 * 1024 * 1024 });
  console.log(result.trim() ? result : '[No text content found in presentation]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
