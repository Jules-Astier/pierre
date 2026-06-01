import { describe, expect, test } from 'bun:test';

import {
  getNativeFileTreeRowLabel,
  NativeFileTree,
} from '../src/react-native/NativeFileTree';

function visiblePaths(model: NativeFileTree): readonly string[] {
  const count = model.getVisibleCount();
  return model.getVisibleRows(0, count - 1).map((row) => row.targetPath);
}

describe('file-tree React Native model', () => {
  test('reuses the core controller for native row expansion and selection', () => {
    const selectedSnapshots: string[][] = [];
    const model = new NativeFileTree({
      initialExpansion: 'closed',
      onSelectionChange: (selectedPaths) => {
        selectedSnapshots.push([...selectedPaths]);
      },
      paths: ['README.md', 'src/index.ts', 'src/components/Button.tsx'],
    });

    const sourceRow = model
      .getVisibleRows(0, model.getVisibleCount() - 1)
      .find((row) => row.targetPath === 'src/');
    expect(sourceRow).toBeDefined();

    model.activateRow(sourceRow!);

    expect(model.getSelectedPaths()).toEqual(['src/']);
    expect(visiblePaths(model)).toContain('src/index.ts');
    expect(selectedSnapshots).toEqual([['src/']]);

    model.cleanUp();
  });

  test('exposes native row labels for flattened paths', () => {
    const model = new NativeFileTree({
      flattenEmptyDirectories: true,
      initialExpansion: 'open',
      paths: ['src/components/Button.tsx'],
    });

    const rows = model.getVisibleRows(0, model.getVisibleCount() - 1);
    const directoryRow = rows.find(
      (entry) => entry.targetPath === 'src/components/'
    );
    const fileRow = rows.find(
      (entry) => entry.targetPath === 'src/components/Button.tsx'
    );
    expect(getNativeFileTreeRowLabel(directoryRow!)).toBe('src / components');
    expect(getNativeFileTreeRowLabel(fileRow!)).toBe('Button.tsx');

    model.cleanUp();
  });

  test('tracks search state and visible native rows', () => {
    const model = new NativeFileTree({
      initialExpansion: 'open',
      paths: ['README.md', 'src/Button.tsx', 'src/input.ts'],
      search: true,
    });

    model.setSearch('button');

    expect(model.isSearchOpen()).toBe(true);
    expect(model.getSearchValue()).toBe('button');
    expect(model.getSearchMatchingPaths()).toEqual(['src/Button.tsx']);
    expect(visiblePaths(model)).toEqual(['src/', 'src/Button.tsx']);

    model.cleanUp();
  });

  test('annotates rows with git status and git status patches', () => {
    const model = new NativeFileTree({
      gitStatus: [{ path: 'src/index.ts', status: 'modified' }],
      initialExpansion: 'open',
      paths: ['src/index.ts', 'src/ignored/file.ts'],
    });

    const initialRows = model.getVisibleRows(0, model.getVisibleCount() - 1);
    expect(
      initialRows.find((row) => row.targetPath === 'src/index.ts')?.gitStatus
    ).toBe('modified');
    expect(
      initialRows.find((row) => row.targetPath === 'src/')?.containsGitChange
    ).toBe(true);

    model.applyGitStatusPatch({
      remove: ['src/index.ts'],
      set: [{ path: 'src/ignored/', status: 'ignored' }],
    });

    const patchedRows = model.getVisibleRows(0, model.getVisibleCount() - 1);
    expect(
      patchedRows.find((row) => row.targetPath === 'src/index.ts')?.gitStatus
    ).toBeNull();
    expect(
      patchedRows.find((row) => row.targetPath === 'src/ignored/file.ts')
        ?.gitStatus
    ).toBe('ignored');

    model.cleanUp();
  });

  test('surfaces the shared rename session to native rows', () => {
    const renameEvents: string[] = [];
    const model = new NativeFileTree({
      initialExpansion: 'open',
      paths: ['src/index.ts'],
      renaming: {
        onRename: (event) => {
          renameEvents.push(`${event.sourcePath}->${event.destinationPath}`);
        },
      },
    });

    expect(model.startRenaming('src/index.ts')).toBe(true);
    const renamingRow = model
      .getVisibleRows(0, model.getVisibleCount() - 1)
      .find((row) => row.targetPath === 'src/index.ts');
    expect(renamingRow?.isRenaming).toBe(true);
    expect(renamingRow?.renamingValue).toBe('index.ts');

    model.setRenamingValue('main.ts');
    model.commitRenaming();

    expect(model.getItem('src/main.ts')).not.toBeNull();
    expect(model.getItem('src/index.ts')).toBeNull();
    expect(renameEvents).toEqual(['src/index.ts->src/main.ts']);

    model.cleanUp();
  });
});
