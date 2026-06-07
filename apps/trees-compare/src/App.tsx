import {
  FileTree as ForkNativeFileTree,
  useFileTree as useForkNativeFileTree,
} from '@baguette-studios/trees/react-native';
import type { NativeFileTreeVisibleRow } from '@baguette-studios/trees/react-native';
import {
  FileTree as PierreReactFileTree,
  useFileTree as usePierreFileTree,
} from '@pierre/trees/react';
import { useState } from 'react';

const PATHS = [
  'apps/',
  'apps/mobile/',
  'apps/mobile/App.tsx',
  'apps/mobile/package.json',
  'apps/mobile/src/',
  'apps/mobile/src/screens/',
  'apps/mobile/src/screens/HomeScreen.tsx',
  'apps/mobile/src/screens/FilesScreen.tsx',
  'apps/mobile/src/components/',
  'apps/mobile/src/components/FileTreePanel.tsx',
  'apps/web/',
  'apps/web/index.html',
  'apps/web/src/',
  'apps/web/src/App.tsx',
  'apps/web/src/styles.css',
  'packages/',
  'packages/trees/',
  'packages/trees/src/',
  'packages/trees/src/react/',
  'packages/trees/src/react/FileTree.tsx',
  'packages/trees/src/react/useFileTree.ts',
  'packages/trees/src/react-native/',
  'packages/trees/src/react-native/FileTree.tsx',
  'packages/trees/src/react-native/NativeFileTree.ts',
  'packages/trees/src/model/',
  'packages/trees/src/model/FileTreeController.ts',
  'packages/trees/src/model/publicTypes.ts',
  'packages/trees/README.md',
  'README.md',
] as const;

const GIT_STATUS = [
  { path: 'apps/mobile/src/screens/FilesScreen.tsx', status: 'modified' },
  { path: 'packages/trees/src/react-native/FileTree.tsx', status: 'added' },
  { path: 'packages/trees/src/model/publicTypes.ts', status: 'modified' },
  { path: 'apps/web/src/styles.css', status: 'untracked' },
] as const;

const INITIAL_EXPANDED_PATHS = [
  'apps/',
  'apps/mobile/',
  'apps/mobile/src/',
  'apps/mobile/src/screens/',
  'packages/',
  'packages/trees/',
  'packages/trees/src/',
  'packages/trees/src/react-native/',
] as const;

const SELECTION_PATH = 'packages/trees/src/react-native/FileTree.tsx';

function getNativeVisiblePaths(rows: readonly NativeFileTreeVisibleRow[]) {
  return rows.map((row) => row.targetPath);
}

function makeTreeOptions() {
  return {
    density: 'compact' as const,
    flattenEmptyDirectories: true,
    gitStatus: GIT_STATUS,
    initialExpandedPaths: INITIAL_EXPANDED_PATHS,
    initialSelectedPaths: [SELECTION_PATH],
    paths: PATHS,
    search: false,
  };
}

export function App() {
  const [searchValue, setSearchValue] = useState('');
  const [, setRevision] = useState(0);
  const pierreTree = usePierreFileTree(makeTreeOptions()).model;
  const forkNativeTree = useForkNativeFileTree(makeTreeOptions()).model;

  const nativeVisiblePaths = getNativeVisiblePaths(
    forkNativeTree.getVisibleRows(0, forkNativeTree.getVisibleCount() - 1)
  );

  const applySearch = (value: string) => {
    setSearchValue(value);
    if (value.trim().length === 0) {
      pierreTree.closeSearch();
      forkNativeTree.closeSearch();
    } else {
      pierreTree.openSearch(value);
      forkNativeTree.openSearch(value);
    }
    setRevision((current) => current + 1);
  };

  const resetTrees = () => {
    setSearchValue('');
    pierreTree.resetPaths(PATHS, {
      initialExpandedPaths: INITIAL_EXPANDED_PATHS,
    });
    forkNativeTree.resetPaths(PATHS, {
      initialExpandedPaths: INITIAL_EXPANDED_PATHS,
    });
    pierreTree.closeSearch();
    forkNativeTree.closeSearch();
    pierreTree.getItem(SELECTION_PATH)?.select();
    pierreTree.focusPath(SELECTION_PATH);
    forkNativeTree.selectOnlyPath(SELECTION_PATH);
    forkNativeTree.focusPath(SELECTION_PATH);
    setRevision((current) => current + 1);
  };

  const selectNativeFile = () => {
    pierreTree.getItem(SELECTION_PATH)?.select();
    pierreTree.focusPath(SELECTION_PATH);
    pierreTree.scrollToPath(SELECTION_PATH, { focus: true, offset: 'center' });
    forkNativeTree.selectOnlyPath(SELECTION_PATH);
    forkNativeTree.focusPath(SELECTION_PATH);
    forkNativeTree.scrollToPath(SELECTION_PATH, {
      focus: true,
      offset: 'center',
    });
    setRevision((current) => current + 1);
  };

  const toggleReactNativeFolder = () => {
    const pierreItem = pierreTree.getItem('packages/trees/src/react-native/');
    if (pierreItem != null && 'toggle' in pierreItem) {
      pierreItem.toggle();
    }
    forkNativeTree.toggleDirectory('packages/trees/src/react-native/');
    setRevision((current) => current + 1);
  };

  return (
    <main className="app-shell">
      <section className="toolbar" aria-label="Comparison controls">
        <div className="toolbar-title">
          <h1>Trees Compare</h1>
          <p>@pierre/trees React vs @baguette-studios/trees React Native</p>
        </div>
        <div className="toolbar-actions">
          <label className="search-field">
            <span>Search</span>
            <input
              onChange={(event) => applySearch(event.target.value)}
              placeholder="react-native"
              type="search"
              value={searchValue}
            />
          </label>
          <button type="button" onClick={selectNativeFile}>
            Select native file
          </button>
          <button type="button" onClick={toggleReactNativeFolder}>
            Toggle native folder
          </button>
          <button type="button" onClick={resetTrees}>
            Reset
          </button>
        </div>
      </section>

      <section className="compare-grid" aria-label="Tree comparison">
        <article className="pane">
          <header>
            <div>
              <h2>Pierre package</h2>
              <p>@pierre/trees/react · 1.0.0-beta.4</p>
            </div>
            <span>Web React</span>
          </header>
          <div className="tree-host">
            <PierreReactFileTree model={pierreTree} />
          </div>
        </article>

        <article className="pane">
          <header>
            <div>
              <h2>Fork package</h2>
              <p>@baguette-studios/trees/react-native · workspace</p>
            </div>
            <span>RN Web</span>
          </header>
          <div className="tree-host native-host">
            <ForkNativeFileTree
              contentContainerStyle={nativeStyles.content}
              listStyle={nativeStyles.list}
              model={forkNativeTree}
              style={nativeStyles.root}
            />
          </div>
        </article>
      </section>

      <section className="parity-strip" aria-label="Native visible rows">
        <div>
          <strong>{nativeVisiblePaths.length}</strong>
          <span>visible rows in the React Native model</span>
        </div>
        <code>{nativeVisiblePaths.join('  |  ')}</code>
      </section>
    </main>
  );
}

const nativeStyles = {
  content: {
    paddingBottom: 12,
    paddingTop: 8,
  },
  list: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
} satisfies Record<string, unknown>;
