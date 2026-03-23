import { test, expect } from '@playwright/test';

const TEST_USERNAME = 'difficulty-test-user';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(TEST_USERNAME);
  await page.getByRole('button', { name: /start playing/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.describe('Difficulty and Grade Level Selection', () => {
  test('can change difficulty level', async ({ page }) => {
    const difficultySelector = page.getByTestId('difficulty-selector');
    
    // Click to open dropdown
    await difficultySelector.click();
    
    // Verify menu items are visible
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /easy/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /medium/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /hard/i })).toBeVisible();
    
    // Select Hard
    await menu.getByRole('menuitem', { name: /hard/i }).click();
    
    // Verify selection changed
    await expect(difficultySelector).toContainText('Hard');
  });

  test('can change grade level', async ({ page }) => {
    const gradeLevelSelector = page.getByTestId('grade-level-selector');
    
    // Click to open dropdown
    await gradeLevelSelector.click();
    
    // Verify menu has grade options
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /grade 1/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /grade 5/i })).toBeVisible();
    
    // Select Grade 5
    await menu.getByRole('menuitem', { name: /grade 5/i }).click();
    
    // Verify selection changed
    await expect(gradeLevelSelector).toContainText('Grade 5');
  });

  test('difficulty preference persists after page reload', async ({ page }) => {
    // Change difficulty to Hard
    await page.getByTestId('difficulty-selector').click();
    await page.getByRole('menuitem', { name: /hard/i }).click();
    await expect(page.getByTestId('difficulty-selector')).toContainText('Hard');
    
    // Reload page
    await page.reload();
    
    // Verify difficulty is still Hard
    await expect(page.getByTestId('difficulty-selector')).toContainText('Hard');
  });

  test('grade level preference persists after page reload', async ({ page }) => {
    // Change grade to Grade 3
    await page.getByTestId('grade-level-selector').click();
    await page.getByRole('menuitem', { name: /grade 3/i }).click();
    await expect(page.getByTestId('grade-level-selector')).toContainText('Grade 3');
    
    // Reload page
    await page.reload();
    
    // Verify grade is still Grade 3
    await expect(page.getByTestId('grade-level-selector')).toContainText('Grade 3');
  });

  test('can change difficulty via settings dialog', async ({ page }) => {
    // Open settings
    await page.getByTestId('settings-btn').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Find difficulty section and select Easy
    const difficultySection = dialog.locator('text=Difficulty').locator('..');
    await difficultySection.getByRole('button', { name: /easy/i }).click();
    
    // Close dialog
    await page.keyboard.press('Escape');
    
    // Verify difficulty changed in main UI
    await expect(page.getByTestId('difficulty-selector')).toContainText('Easy');
  });

  test('can change grade level via settings dialog', async ({ page }) => {
    // Open settings
    await page.getByTestId('settings-btn').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Find grade level section and select Grade 6
    const gradeLevelSection = dialog.locator('text=Grade Level').locator('..');
    await gradeLevelSection.getByRole('button', { name: /grade 6/i }).click();
    
    // Close dialog
    await page.keyboard.press('Escape');
    
    // Verify grade level changed in main UI
    await expect(page.getByTestId('grade-level-selector')).toContainText('Grade 6');
  });
});
