/**
 * Alphabet data for voice recognition and spelling normalization.
 * Contains NATO phonetic alphabet, letter pronunciations, and other mappings.
 */

// NATO phonetic alphabet mapping (includes alternate spellings)
export const NATO_TO_LETTER: Record<string, string> = {
  'ALPHA': 'A', 'ALFA': 'A',
  'BRAVO': 'B',
  'CHARLIE': 'C',
  'DELTA': 'D',
  'ECHO': 'E',
  'FOXTROT': 'F',
  'GOLF': 'G',
  'HOTEL': 'H',
  'INDIA': 'I',
  'JULIET': 'J', 'JULIETT': 'J',
  'KILO': 'K',
  'LIMA': 'L',
  'MIKE': 'M',
  'NOVEMBER': 'N',
  'OSCAR': 'O',
  'PAPA': 'P',
  'QUEBEC': 'Q',
  'ROMEO': 'R',
  'SIERRA': 'S',
  'TANGO': 'T',
  'UNIFORM': 'U',
  'VICTOR': 'V',
  'WHISKEY': 'W',
  'XRAY': 'X', 'X-RAY': 'X',
  'YANKEE': 'Y',
  'ZULU': 'Z',
};

// Common speech recognition letter pronunciations
export const LETTER_TO_SYMBOL: Record<string, string> = {
  'DOUBLE U': 'W', 'DOUBLEU': 'W', 'DOUBLE-U': 'W',
  'DOUBLE YOU': 'W', 'DOUBLEYOU': 'W', 'DOUBLE-YOU': 'W',
  'ZEE': 'Z', 'ZED': 'Z',
  'ARE': 'R', 'AR': 'R',
  'AY': 'A', 'AYE': 'A',
  'BEE': 'B', 'BE': 'B',
  'SEE': 'C', 'SEA': 'C',
  'DEE': 'D',
  'EE': 'E',
  'EF': 'F', 'EFF': 'F',
  'GEE': 'G',
  'AITCH': 'H', 'ACHE': 'H',
  'EYE': 'I', 'AI': 'I',
  'JAY': 'J',
  'KAY': 'K', 'OKAY': 'K',
  'EL': 'L', 'ELL': 'L',
  'EM': 'M',
  'EN': 'N',
  'OH': 'O', 'OWE': 'O',
  'PEA': 'P', 'PEE': 'P',
  'CUE': 'Q', 'QUEUE': 'Q',
  'ES': 'S', 'ESS': 'S',
  'TEA': 'T', 'TEE': 'T',
  'YOU': 'U', 'EWE': 'U',
  'VEE': 'V',
  'EX': 'X',
  'WHY': 'Y', 'WYE': 'Y',
};

// Digit words for numbers
export const DIGIT_WORDS: Record<string, string> = {
  'ZERO': '0',
  'ONE': '1',
  'TWO': '2',
  'THREE': '3',
  'FOUR': '4',
  'FIVE': '5',
  'SIX': '6',
  'SEVEN': '7',
  'EIGHT': '8',
  'NINE': '9',
};

// Common filler words to remove from voice input
export const COMMON_FILLER_WORDS: string[] = [
  'THE', 'A', 'AN', 'AND', 'OR', 'BUT',
  'IS', 'ARE', 'WAS', 'WERE',
  'LETTER', 'CAPITAL', 'LOWERCASE', 'UPPERCASE',
];
