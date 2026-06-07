import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __fileTreeReactNativeWebReady?: boolean;
    __fileTreeReactNativeWebSnapshot?: {
      selectedPaths: readonly string[];
      visibleCount: number;
      visiblePaths: readonly string[];
    };
  }
}

test('React Native Web renderer paints visible rows in a constrained flex panel', async ({
  page,
}) => {
  await page.goto('/test/e2e/fixtures/file-tree-react-native-web.html');
  await page.waitForFunction(
    () => window.__fileTreeReactNativeWebReady === true
  );

  const snapshot = await page.evaluate(
    () => window.__fileTreeReactNativeWebSnapshot
  );
  expect(snapshot).toMatchObject({
    selectedPaths: ['packages/trees/src/react-native/FileTree.tsx'],
    visibleCount: 9,
  });

  await expect(page.getByTestId('rn-web-tree-scroll-view')).toHaveCount(1);
  await expect(page.getByTestId('rn-web-tree-virtualized-list')).toHaveCount(0);
  await expect(page.getByTestId('rn-web-tree-row-apps/mobile/')).toBeVisible();
  await expect(
    page.getByTestId(
      'rn-web-tree-row-packages/trees/src/react-native/FileTree.tsx'
    )
  ).toHaveCount(1);

  const paintedRows = page.locator('[data-testid^="rn-web-tree-row-"]');
  await expect(paintedRows).toHaveCount(snapshot?.visibleCount ?? 0);
  const firstRowBox = await page
    .getByTestId('rn-web-tree-row-apps/mobile/')
    .boundingBox();
  expect(firstRowBox?.height).toBeGreaterThan(0);
  expect(firstRowBox?.width).toBeGreaterThan(0);
});
