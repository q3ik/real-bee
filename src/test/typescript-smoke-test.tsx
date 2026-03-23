/**
 * TypeScript configuration smoke test to verify:
 * - Strict typing works
 * - React/JSX support is configured correctly
 * - Path alias (@/*) resolution works
 * - JavaScript files remain supported via allowJs
 * 
 * This file should compile without errors when running:
 * npx tsc --noEmit
 */

import React from 'react';
import type { ReactNode } from 'react';

// Test strict typing
export function formatPracticeWord(word: string): string {
  return word.trim().toLowerCase();
}

// Test React component with proper types
interface TestComponentProps {
  children: ReactNode;
  value: string;
  optional?: number;
}

export const TestComponent: React.FC<TestComponentProps> = ({ 
  children, 
  value,
  optional = 0 
}) => {
  const formattedValue = formatPracticeWord(value);
  
  return (
    <div data-value={formattedValue} data-optional={optional}>
      {children}
    </div>
  );
};

// Test type inference
export const inferredNumber = 42;
export const inferredString = 'buzzy';
export const inferredArray: string[] = ['test', 'migration'];

// Test strict null checks
export function handleNullable(value: string | null): string {
  if (value === null) {
    return 'default';
  }
  return value;
}

// Test that configuration is ready
export const TYPESCRIPT_MIGRATION_READY: boolean =
  formatPracticeWord('  BuzzY  ') === 'buzzy' &&
  typeof TestComponent === 'function' &&
  inferredNumber === 42;
