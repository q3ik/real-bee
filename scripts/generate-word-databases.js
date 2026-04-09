/**
 * generate-word-databases.js
 *
 * Splits a master word JSON file into grade-level JSON files
 * in public/data/words/. Run after adding new words to the master source.
 *
 * Usage: node scripts/generate-word-databases.js [master-file]
 * Default master file: src/data/words.json
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "../src/data/words.json");
const OUTPUT_DIR = path.join(__dirname, "../public/data/words");

/** Grade ranges: gradeLevel string → target grade number */
const GRADE_LEVEL_MAP = {
  "K-2": 1,
  "3-5": 3,
  "6-8": 6,
  "9-12": 9,
};

/**
 * Group words by grade level and write individual JSON files.
 */
async function generateWordDatabases() {
  console.log(`📖 Reading master word file: ${MASTER_FILE}`);

  let masterData;
  try {
    const raw = await fs.readFile(MASTER_FILE, "utf-8");
    masterData = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Failed to read master file: ${err.message}`);
    console.log("💡 Create src/data/words.json with an array of word objects.");
    console.log(
      "   Or run with a specific file: node scripts/generate-word-databases.js path/to/words.json",
    );
    process.exit(1);
  }

  const words = masterData.words ?? masterData;
  if (!Array.isArray(words)) {
    console.error(
      "❌ Master file must contain a 'words' array or be an array.",
    );
    process.exit(1);
  }

  console.log(`📊 Found ${words.length} words in master file.`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Group by grade level
  const byGrade = {};
  for (const word of words) {
    const gradeLevel = word.gradeLevel ?? "unknown";
    if (!byGrade[gradeLevel]) byGrade[gradeLevel] = [];
    byGrade[gradeLevel].push(word);
  }

  // Write grade-level files
  for (const [gradeLevel, gradeWords] of Object.entries(byGrade)) {
    const gradeNum = GRADE_LEVEL_MAP[gradeLevel] ?? 0;
    const fileName =
      gradeNum === 0
        ? `other-${gradeLevel.replace(/\s+/g, "-").toLowerCase()}`
        : `grade-${gradeNum}`;

    const outputFile = path.join(OUTPUT_DIR, `${fileName}.json`);
    const gradeFile = {
      grade: gradeNum,
      language: "en-US",
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      wordCount: gradeWords.length,
      words: gradeWords,
    };

    await fs.writeFile(
      outputFile,
      JSON.stringify(gradeFile, null, 2) + "\n",
      "utf-8",
    );
    console.log(`  ✅ ${outputFile}: ${gradeWords.length} words`);
  }

  console.log(
    `\n✨ Done! Generated ${Object.keys(byGrade).length} grade-level files.`,
  );
}

generateWordDatabases();
