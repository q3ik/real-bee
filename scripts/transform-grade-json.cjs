/**
 * Transform grade JSON files from metadata wrapper format to flat Word[] array.
 *
 * Before: { grade, language, version, lastUpdated, wordCount, words: [...] }
 * After:  [ { word, definition, sentence, grade, difficulty, ... }, ... ]
 */

const fs = require('fs');
const path = require('path');

const wordsDir = path.join(__dirname, '..', 'public', 'data', 'words');

// Map gradeLevel strings to numeric grade
function parseGrade(gradeLevel) {
  const normalized = gradeLevel.trim().toLowerCase();
  if (normalized === 'all' || normalized === 'k-12') return 0;
  if (normalized === 'k-2' || normalized === 'k-3') return 1;
  if (normalized.startsWith('3') || normalized.startsWith('4') || normalized.startsWith('5')) return 3;
  if (normalized.startsWith('6') || normalized.startsWith('7') || normalized.startsWith('8')) return 6;
  if (normalized.startsWith('9') || normalized.startsWith('10') || normalized.startsWith('11') || normalized.startsWith('12')) return 9;

  const match = normalized.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 2) return 1;
    if (num >= 3 && num <= 5) return 3;
    if (num >= 6 && num <= 8) return 6;
    if (num >= 9) return 9;
  }
  return 0;
}

function normalizeDifficulty(diff) {
  const normalized = diff.toLowerCase().trim();
  if (['easy', 'medium', 'hard', 'all'].includes(normalized)) {
    return normalized;
  }
  return 'medium';
}

// Process all grade files
const files = fs.readdirSync(wordsDir).filter(f => f.startsWith('grade-') && f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(wordsDir, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Check if it's the wrapped format
  if (content.words && Array.isArray(content.words)) {
    console.log(`Transforming ${file}: ${content.words.length} words`);

    // Transform to Word[] format
    const transformed = content.words.map(raw => ({
      word: raw.word,
      definition: raw.definition,
      sentence: raw.example,
      grade: parseGrade(raw.gradeLevel),
      difficulty: normalizeDifficulty(raw.difficulty),
      ...(raw.syllables ? { syllables: raw.syllables } : {}),
      ...(raw.phonetic ? { phonetic: raw.phonetic } : {}),
    }));

    // Remove duplicates based on 'word' field
    const seen = new Set();
    const unique = transformed.filter(w => {
      if (seen.has(w.word)) {
        console.log(`  Removing duplicate: ${w.word}`);
        return false;
      }
      seen.add(w.word);
      return true;
    });

    fs.writeFileSync(filePath, JSON.stringify(unique, null, 2) + '\n', 'utf8');
    console.log(`  → ${unique.length} unique words written`);
  } else {
    console.log(`Skipping ${file}: already in Word[] format or empty`);
  }
}

console.log('\nDone! All grade files transformed to Word[] format.');
