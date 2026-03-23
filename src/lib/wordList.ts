export interface Word {
  word: string;
  definition: string;
  sentence: string;
  grade: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const WORD_LIST: Word[] = [
  { word: 'cat', definition: 'A small furry animal that says meow.', sentence: 'The cat sat on the mat.', grade: 1, difficulty: 'easy' },
  { word: 'dog', definition: 'A friendly pet that barks and wags its tail.', sentence: 'The dog barked at the stranger.', grade: 1, difficulty: 'easy' },
  { word: 'apple', definition: 'A crunchy red or green fruit.', sentence: 'I ate a red apple for snack.', grade: 1, difficulty: 'medium' },
  { word: 'banana', definition: 'A long yellow fruit that you peel.', sentence: 'Monkeys love to eat a banana.', grade: 2, difficulty: 'easy' },
  { word: 'elephant', definition: 'A very big animal with a long trunk and big ears.', sentence: 'The elephant is the largest land animal.', grade: 3, difficulty: 'medium' },
  { word: 'library', definition: 'A place where you can find many books to read.', sentence: 'I went to the library to borrow a book.', grade: 4, difficulty: 'medium' },
  { word: 'mountain', definition: 'A very high hill that reaches the clouds.', sentence: 'We climbed to the top of the mountain.', grade: 5, difficulty: 'medium' },
  { word: 'adventure', definition: 'An exciting or daring trip or activity.', sentence: 'Going to space would be a great adventure.', grade: 6, difficulty: 'hard' },
  { word: 'experience', definition: 'Something you have done or seen before.', sentence: 'Traveling gives you a lot of experience.', grade: 7, difficulty: 'hard' },
  { word: 'knowledge', definition: 'Information and facts you have learned.', sentence: 'Knowledge is power.', grade: 8, difficulty: 'hard' },
  // Add more words as needed...
];

export function getWordsForConfig(grade: number, difficulty: string): Word[] {
  return WORD_LIST.filter(w => {
    const gradeMatch = grade === 0 || w.grade === grade;
    const diffMatch = difficulty === 'all' || w.difficulty === difficulty;
    return gradeMatch && diffMatch;
  });
}
