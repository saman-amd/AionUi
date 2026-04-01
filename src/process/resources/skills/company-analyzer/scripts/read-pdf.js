#!/usr/bin/env node
/**
 * Read a PDF file and output text content.
 * Tries Python pypdf first (best quality), falls back to raw extraction.
 * Usage: node read-pdf.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) { console.log('Usage: node read-pdf.js <file_path>'); process.exit(1); }

const filePath = process.argv[2];
const pyScript = path.join(__dirname, 'read-pdf.py');

// Try Python script (best PDF text extraction)
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: extract readable text from PDF binary
try {
  const buf = fs.readFileSync(filePath);
  const str = buf.toString('latin1');
  const textBlocks = [];
  const regex = /\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const text = match[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
    if (text.trim().length > 2 && /[a-zA-Z]/.test(text)) textBlocks.push(text.trim());
  }
  console.log(textBlocks.length ? textBlocks.join('\n') : '[Could not extract text. Install pypdf: pip install pypdf]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
