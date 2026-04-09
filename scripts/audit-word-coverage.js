/**
 * audit-word-coverage.js
 *
 * Audits word data quality across all grade-level JSON files.
 * Checks for:
 * - Missing required fields (word, definition, example)
 * - Duplicate words across files
 * - Empty syllables or missing phonetic data
 * - Inconsistent difficulty values
 *
 * Usage: node scripts/audit-word-coverage.js
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORDS_DIR = path.join(__dirname, "../public/data/words");

const REQUIRED_FIELDS = ["word", "definition", "example"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

const issues = [];
const allWords = new Map(); // word text → file it appeared in

/**
 * Audit a single grade-level JSON file.
 */
async function auditFile(filePath) {
  const fileName = path.basename(filePath);
  let data;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    data = JSON.parse(raw);
  } catch (err) {
    issues.push({ file: fileName, issue: `Invalid JSON: ${err.message}` });
    return;
  }

  const words = data.words ?? data;
  if (!Array.isArray(words)) {
    issues.push({ file: fileName, issue: "No 'words' array found" });
    return;
  }

  console.log(`📄 ${fileName}: ${words.length} words`);

  for (const word of words) {
    const wordText = word.word?.toLowerCase();
    if (!wordText) {
      issues.push({ file: fileName, word: wordText, issue: "Missing 'word' field" });
      continue;
    }

    // Check for duplicates
    if (allWords.has(wordText)) {
      issues.push({ file: fileName, word: wordText, issue: `Duplicate word (also in ${allWords.get(wordText)})` });
    } else {
      allWords.set(wordText, fileName);
    }

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!word[field] || word[field].trim() === "") {
        issues.push({ file: fileName, word: wordText, issue: `Missing required field: '${field}'` });
      }
    }

    // Check difficulty
    if (word.difficulty && !VALID_DIFFICULTIES.includes(word.difficulty.toLowerCase())) {
      issues.push({ file: fileName, word: wordText, issue: `Invalid difficulty: '${word.difficulty}'` });
    }

    // Check syllables
    if (!word.syllables) {
      issues.push({ file: fileName, word: wordText, issue: "Missing 'syllables' field" });
    }
  }
}

/**
 * Main audit function.
 */
async function audit() {
  console.log("🔍 Auditing word data coverage...\n");

  let files;
  try {
    files = (await fs.readdir(WORDS_DIR)).filter(f => f.endsWith(".json"));
  } catch (err) {
    console.error(`❌ Cannot read words directory: ${err.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("⚠️  No word files found in public/data/words/");
    return;
  }

  // Audit each file
  for (const file of files.sort()) {
    await auditFile(path.join(WORDS_DIR, file));
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Summary`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total files:    ${files.length}`);
  console.log(`Total words:    ${allWords.size}`);
  console.log(`Total issues:   ${issues.length}`);

  if (issues.length > 0) {
    console.log(`\n📋 Issues:`);
    for (const issue of issues) {
      const wordStr = issue.word ? ` (${issue.word})` : "";
      console.log(`  ⚠️  [${issue.file}]${wordStr} ${issue.issue}`);
    }
  } else {
    console.log("\n✅ No issues found — word data is clean!");
  }
}

audit();
