#!/usr/bin/env node

/*
 Test Type R sales regex across PDFs.
 Usage:
   node scripts/test-type-r-regex.js [pdfDir]
 Default pdfDir: assets/test-pdfs
*/

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfDir = process.argv[2] || path.resolve(__dirname, '..', 'assets', 'test-pdfs');

// Candidate patterns to try (ordered by specificity)
const regexes = [
  // e.g. "Type R Sales : R 1,234.56"
  /(Type\s*-?\s*R\s*(?:Sales?)?)\s*[:\-]?\s*(?:R\s*)?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/i,
  // e.g. "Type-R: 1234.56" (no currency)
  /(Type\s*-?\s*R)\s*[:\-]?\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/i,
  // e.g. "R-Type Sales - R1 234,56"
  /(R\s*-?\s*Type\s*(?:Sales?)?)\s*[:\-]?\s*(?:R\s*)?([0-9]{1,3}(?:[\s,][0-9]{3})*(?:[\.,][0-9]{1,2})|[0-9]+(?:[\.,][0-9]{1,2})?)/i,
];

function parseNumber(str) {
  if (!str) return 0;
  // Normalize common ZA/EU formats: "1 234,56" => "1234.56"; "1,234.56" => "1234.56"
  const normalized = str.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const num = Number(normalized.replace(/[^0-9.\-]/g, ''));
  return isNaN(num) ? 0 : num;
}

async function extractTypeRSales(text) {
  for (const rx of regexes) {
    const m = text.match(rx);
    if (m && m[2]) {
      return { label: m[1], valueRaw: m[2], value: parseNumber(m[2]), regex: rx.toString() };
    }
  }
  return null;
}

async function processPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const { text } = await pdf(dataBuffer);
    const result = await extractTypeRSales(text);
    return { ok: true, filePath, result, textSample: text.slice(0, 500) };
  } catch (err) {
    return { ok: false, filePath, error: err.message };
  }
}

(async function main() {
  if (!fs.existsSync(pdfDir)) {
    console.error(`PDF directory not found: ${pdfDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(pdfDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => path.join(pdfDir, f));

  if (files.length === 0) {
    console.log(`No PDFs found in ${pdfDir}. Add test PDFs and re-run.`);
    process.exit(0);
  }

  console.log(`Testing Type R regex on ${files.length} PDF(s) in ${pdfDir}\n`);

  let totalFound = 0;
  let totalValue = 0;

  for (const file of files) {
    const res = await processPdf(file);
    if (!res.ok) {
      console.log(`✖ ${path.basename(file)} — Error: ${res.error}`);
      continue;
    }
    if (res.result) {
      totalFound += 1;
      totalValue += res.result.value;
      console.log(
        `✔ ${path.basename(file)} — Match: label="${res.result.label}" valueRaw="${res.result.valueRaw}" value=${res.result.value} regex=${res.result.regex}`
      );
    } else {
      console.log(`• ${path.basename(file)} — No match`);
    }
  }

  console.log(`\nSummary: matched ${totalFound}/${files.length} file(s), total extracted value = ${totalValue.toFixed(2)}`);
})(); 