/**
 * Global Test Teardown
 * 
 * Runs once after all tests to collect diagnostics and cleanup.
 * Provides post-execution analysis for debugging CI issues.
 * 
 * Addresses issue #609 - Chromium SIGSEGV crashes in CI
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Global teardown function executed after all tests.
 * Collects diagnostics and performs cleanup.
 */
export default async function globalTeardown(): Promise<void> {
  console.log('\n=== Global Test Teardown ===\n');

  const isCI = !!process.env.CI;

  if (isCI) {
    console.log('[Teardown] Running CI post-test diagnostics...');

    // Check for crash dumps
    const crashDumpDir = process.env.PLAYWRIGHT_CRASH_DUMP_DIR || './crash-dumps';
    
    try {
      if (fs.existsSync(crashDumpDir)) {
        const files = fs.readdirSync(crashDumpDir);
        
        if (files.length > 0) {
          console.error('[Teardown] ⚠ CRASH DUMPS DETECTED:');
          files.forEach(file => {
            const filePath = path.join(crashDumpDir, file);
            const stats = fs.statSync(filePath);
            console.error(`  - ${file} (${stats.size} bytes, ${stats.mtime})`);
          });
          console.error('[Teardown] Please review crash dumps for debugging');
        } else {
          console.log('[Teardown] ✓ No crash dumps found');
        }
      }
    } catch (error) {
      console.warn('[Teardown] Could not check crash dumps:', (error as Error).message);
    }

    // Check test artifacts
    try {
      const testResultsDir = './test-results';
      if (fs.existsSync(testResultsDir)) {
        const files = fs.readdirSync(testResultsDir);
        const videos = files.filter(f => f.endsWith('.webm'));
        const screenshots = files.filter(f => f.match(/\.(png|jpg)$/));
        const traces = files.filter(f => f.endsWith('.zip'));

        console.log('[Teardown] Test artifacts:');
        console.log(`  - Videos: ${videos.length}`);
        console.log(`  - Screenshots: ${screenshots.length}`);
        console.log(`  - Traces: ${traces.length}`);
      }
    } catch (error) {
      console.warn('[Teardown] Could not check test artifacts:', (error as Error).message);
    }

    // Memory summary if available
    try {
      if (process.memoryUsage) {
        const mem = process.memoryUsage();
        console.log('[Teardown] Memory usage:');
        console.log(`  - RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`);
        console.log(`  - Heap Used: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
        console.log(`  - Heap Total: ${Math.round(mem.heapTotal / 1024 / 1024)} MB`);
      }
    } catch (error) {
      console.warn('[Teardown] Could not get memory usage:', (error as Error).message);
    }
  }

  console.log('\n=== Teardown Complete ===\n');
}
