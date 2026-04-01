#!/usr/bin/env node
/**
 * Read a PDF file and output text content.
 * Delegates to read-pdf.py (pdfplumber → pypdf).
 * Falls back to raw binary extraction if Python is unavailable.
 * Usage: node read-pdf.js <file_path> [--pages N-M]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.log('Usage: node read-pdf.js <file_path> [--pages N-M]');
  process.exit(1);
}

const filePath = process.argv[2];
const extraArgs = process.argv.slice(3).join(' ');
const pyScript = path.join(__dirname, 'read-pdf.py');

// Primary: Python script (pdfplumber → pypdf)
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}" ${extraArgs}`, {
      encoding: 'utf-8', timeout: 60000, maxBuffer: 20 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Last resort: extract parenthesised strings from raw PDF binary
// (very unreliable for modern PDFs — only useful as absolute fallback)
try {
  const buf = fs.readFileSync(filePath);
  const str = buf.toString('latin1');
  const textBlocks = [];
  const regex = /\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const text = match[1]
      .replace(/\\n/g, '\n').replace(/\\r/g, '')
      .replace(/\\\(/g, '(').replace(/\\\)/g, ')');
    if (text.trim().length > 2 && /[a-zA-Z]/.test(text)) textBlocks.push(text.trim());
  }
  console.log(textBlocks.length
    ? textBlocks.join('\n')
    : '[Could not extract text. Install pdfplumber: pip install pdfplumber]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
