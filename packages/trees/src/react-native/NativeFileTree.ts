import {
  type FileTreeDensity,
  type FileTreeDensityPreset,
  resolveFileTreeDensity,
} from '../model/density';
import {
  FILE_TREE_RENAME_VIEW,
  FileTreeController,
} from '../model/FileTreeController';
import {
  applyFileTreeGitStatusPatch,
  type FileTreeGitStatusState,
  resolveFileTreeGitStatusState,
} from '../model/gitStatus';
import type {
  FileTreeBatchOperation,
  FileTreeControllerOptions,
  FileTreeGitStatusPatch,
  FileTreeItemHandle,
  FileTreeListener,
  FileTreeMoveOptions,
  FileTreeMutationEventForType,
  FileTreeMutationEventType,
  FileTreeMutationHandle,
  FileTreePublicId,
  FileTreeRemoveOptions,
  FileTreeResetOptions,
  FileTreeScrollOffset,
  FileTreeScrollToPathOptions,
  FileTreeSearchSessionHandle,
  FileTreeSelectionChangeListener,
  FileTreeVisibleRow,
} from '../model/publicTypes';
import type { GitStatus, GitStatusEntry } from '../publicTypes';

export type NativeFileTreeOptions = FileTreeControllerOptions & {
  density?: FileTreeDensity;
  gitStatus?: readonly GitStatusEntry[];
  itemHeight?: number;
  onSelectionChange?: FileTreeSelectionChangeListener;
  search?: boolean;
};

export interface NativeFileTreeScrollRequest {
  id: number;
  offset: FileTreeScrollOffset;
  visibleIndex: number;
}

export interface NativeFileTreeVisibleRow extends FileTreeVisibleRow {
  containsGitChange: boolean;
  gitStatus: GitStatus | null;
  isRenaming: boolean;
  renamingValue: string;
  targetPath: FileTreePublicId;
}

function getTargetPath(row: FileTreeVisibleRow): FileTreePublicId {
  if (!row.isFlattened) {
    return row.path;
  }

  const flattenedSegments = row.flattenedSegments;
  if (flattenedSegments == null) {
    return row.path;
  }

  for (let index = flattenedSegments.length - 1; index >= 0; index -= 1) {
    const segment = flattenedSegments[index];
    if (segment?.isTerminal === true) {
      return segment.path;
    }
  }

  return row.path;
}

function getRowLabel(row: FileTreeVisibleRow): string {
  const flattenedSegments = row.flattenedSegments;
  if (flattenedSegments == null || flattenedSegments.length === 0) {
    return row.name;
  }

  return flattenedSegments.map((segment) => segment.name).join(' / ');
}

function getInheritedIgnoredGitStatus(
  ancestorPaths: readonly string[],
  ignoredDirectoryPaths: ReadonlySet<string> | undefined
): GitStatus | null {
  if (ignoredDirectoryPaths == null || ignoredDirectoryPaths.size === 0) {
    return null;
  }

  for (let index = ancestorPaths.length - 1; index >= 0; index -= 1) {
    const ancestorPath = ancestorPaths[index];
    if (ancestorPath != null && ignoredDirectoryPaths.has(ancestorPath)) {
      return 'ignored';
    }
  }

  return null;
}

export function getNativeFileTreeRowLabel(row: FileTreeVisibleRow): string {
  return getRowLabel(row);
}

export function getNativeFileTreeRowTargetPath(
  row: FileTreeVisibleRow
): FileTreePublicId {
  return getTargetPath(row);
}

/**
 * React Native model wrapper around the shared file-tree controller.
 *
 * The web model owns DOM, shadow-root, and Preact runtime concerns. This class
 * keeps the same mutation/search/selection semantics but exposes row snapshots
 * that React Native lists can render with native primitives.
 */
export class NativeFileTree
  implements FileTreeMutationHandle, FileTreeSearchSessionHandle
{
  readonly #controller: FileTreeController;
  readonly #density: FileTreeDensityPreset;
  readonly #listeners = new Set<FileTreeListener>();
  readonly #onSelectionChange: FileTreeSelectionChangeListener | undefined;
  readonly #renamingEnabled: boolean;
  readonly #searchEnabled: boolean;
  #controllerSubscription: (() => void) | null = null;
  #gitStatusState: FileTreeGitStatusState | null;
  #selectionVersion: number;
  #version = 0;

  public constructor(options: NativeFileTreeOptions) {
    const {
      density,
      gitStatus,
      itemHeight,
      onSelectionChange,
      renaming,
      search,
      ...controllerOptions
    } = options;
    this.#density = resolveFileTreeDensity(density, itemHeight);
    this.#gitStatusState = resolveFileTreeGitStatusState(gitStatus);
    this.#onSelectionChange = onSelectionChange;
    this.#renamingEnabled = renaming != null && renaming !== false;
    this.#searchEnabled = search === true;
    this.#controller = new FileTreeController({
      ...controllerOptions,
      renaming,
    } as FileTreeControllerOptions);
    this.#selectionVersion = this.#controller.getSelectionVersion();
    let hasSeenInitialSnapshot = false;
    this.#controllerSubscription = this.#controller.subscribe(() => {
      if (!hasSeenInitialSnapshot) {
        hasSeenInitialSnapshot = true;
        return;
      }

      this.#emitChange();
      this.#emitSelectionChange();
    });
  }

  public activateRow(row: NativeFileTreeVisibleRow): void {
    this.selectOnlyPath(row.targetPath);
    if (this.isSearchOpen()) {
      this.closeSearch();
    }
    if (row.kind === 'directory') {
      this.toggleDirectory(row.targetPath);
    }
  }

  public add(path: FileTreePublicId): void {
    this.#controller.add(path);
  }

  public applyGitStatusPatch(patch: FileTreeGitStatusPatch): void {
    const nextGitStatusState = applyFileTreeGitStatusPatch(
      this.#gitStatusState,
      patch
    );
    if (nextGitStatusState === this.#gitStatusState) {
      return;
    }

    this.#gitStatusState = nextGitStatusState;
    this.#emitChange();
  }

  public batch(operations: readonly FileTreeBatchOperation[]): void {
    this.#controller.batch(operations);
  }

  public cleanUp(): void {
    this.#controllerSubscription?.();
    this.#controllerSubscription = null;
    this.#listeners.clear();
    this.#controller.destroy();
  }

  public clearScrollRequest(id: number): void {
    this.#controller.clearScrollRequest(id);
  }

  public closeSearch(): void {
    this.#controller.closeSearch();
  }

  public commitRenaming(): void {
    this.#controller[FILE_TREE_RENAME_VIEW]().commit();
  }

  public cancelRenaming(): void {
    this.#controller[FILE_TREE_RENAME_VIEW]().cancel();
  }

  public deselectPath(path: FileTreePublicId): void {
    this.#controller.deselectPath(path);
  }

  public focusNearestPath(
    path: FileTreePublicId | null
  ): FileTreePublicId | null {
    return this.#controller.focusNearestPath(path);
  }

  public focusNextSearchMatch(): void {
    this.#controller.focusNextSearchMatch();
  }

  public focusPath(path: FileTreePublicId): void {
    this.#controller.focusPath(path);
  }

  public focusPreviousSearchMatch(): void {
    this.#controller.focusPreviousSearchMatch();
  }

  public getDensityFactor(): number {
    return this.#density.factor;
  }

  public getFocusedItem(): FileTreeItemHandle | null {
    return this.#controller.getFocusedItem();
  }

  public getFocusedPath(): FileTreePublicId | null {
    return this.#controller.getFocusedPath();
  }

  public getItem(path: FileTreePublicId): FileTreeItemHandle | null {
    return this.#controller.getItem(path);
  }

  public getItemHeight(): number {
    return this.#density.itemHeight;
  }

  public getRenamingPath(): FileTreePublicId | null {
    return this.#controller[FILE_TREE_RENAME_VIEW]().getPath();
  }

  public getRenamingValue(): string {
    return this.#controller[FILE_TREE_RENAME_VIEW]().getValue();
  }

  public getScrollRequest(): NativeFileTreeScrollRequest | null {
    const request = this.#controller.getScrollRequest();
    return request == null ? null : { ...request };
  }

  public getSearchMatchingPaths(): readonly FileTreePublicId[] {
    return this.#controller.getSearchMatchingPaths();
  }

  public getSearchValue(): string {
    return this.#controller.getSearchValue();
  }

  public getSelectedPaths(): readonly FileTreePublicId[] {
    return this.#controller.getSelectedPaths();
  }

  public getVersion(): number {
    return this.#version;
  }

  public getVisibleCount(): number {
    return this.#controller.getVisibleCount();
  }

  public getVisibleRow(index: number): NativeFileTreeVisibleRow | null {
    return this.getVisibleRows(index, index)[0] ?? null;
  }

  public getVisibleRows(
    start: number,
    end: number
  ): readonly NativeFileTreeVisibleRow[] {
    return this.#controller
      .getVisibleRows(start, end)
      .map((row) => this.#toNativeRow(row));
  }

  public isRenamingActive(): boolean {
    return this.#controller[FILE_TREE_RENAME_VIEW]().isActive();
  }

  public isRenamingEnabled(): boolean {
    return this.#renamingEnabled;
  }

  public isSearchEnabled(): boolean {
    return this.#searchEnabled;
  }

  public isSearchOpen(): boolean {
    return this.#controller.isSearchOpen();
  }

  public move(
    fromPath: FileTreePublicId,
    toPath: FileTreePublicId,
    options?: FileTreeMoveOptions
  ): void {
    this.#controller.move(fromPath, toPath, options);
  }

  public onMutation<TType extends FileTreeMutationEventType | '*'>(
    type: TType,
    handler: (event: FileTreeMutationEventForType<TType>) => void
  ): () => void {
    return this.#controller.onMutation(type, handler);
  }

  public openSearch(initialValue?: string): void {
    this.#controller.openSearch(initialValue);
  }

  public remove(path: FileTreePublicId, options?: FileTreeRemoveOptions): void {
    this.#controller.remove(path, options);
  }

  public resetPaths(
    paths: readonly FileTreePublicId[],
    options?: FileTreeResetOptions
  ): void {
    this.#controller.resetPaths(paths, options);
  }

  public scrollToPath(
    path: FileTreePublicId,
    options?: FileTreeScrollToPathOptions
  ): void {
    this.#controller.scrollToPath(path, options);
  }

  public selectOnlyPath(path: FileTreePublicId): void {
    this.#controller.selectOnlyPath(path);
  }

  public selectPath(path: FileTreePublicId): void {
    this.#controller.selectPath(path);
  }

  public selectPathRange(
    path: FileTreePublicId,
    unionSelection: boolean = false
  ): void {
    this.#controller.selectPathRange(path, unionSelection);
  }

  public setGitStatus(gitStatus?: readonly GitStatusEntry[]): void {
    const nextGitStatusState = resolveFileTreeGitStatusState(
      gitStatus,
      this.#gitStatusState
    );
    if (nextGitStatusState === this.#gitStatusState) {
      return;
    }

    this.#gitStatusState = nextGitStatusState;
    this.#emitChange();
  }

  public setRenamingValue(value: string): void {
    this.#controller[FILE_TREE_RENAME_VIEW]().setValue(value);
  }

  public setSearch(value: string | null): void {
    this.#controller.setSearch(value);
  }

  public startRenaming(
    path?: FileTreePublicId,
    options?: { removeIfCanceled?: boolean }
  ): boolean {
    return this.#controller.startRenaming(path, options);
  }

  public subscribe(listener: FileTreeListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  public toggleDirectory(path: FileTreePublicId): void {
    const item = this.#controller.getItem(path);
    if (item != null && 'toggle' in item) {
      item.toggle();
    }
  }

  public togglePathSelection(path: FileTreePublicId): void {
    this.#controller.togglePathSelection(path);
  }

  #emitChange(): void {
    this.#version += 1;
    for (const listener of this.#listeners) {
      listener();
    }
  }

  #emitSelectionChange(): void {
    const onSelectionChange = this.#onSelectionChange;
    if (onSelectionChange == null) {
      return;
    }

    const nextSelectionVersion = this.#controller.getSelectionVersion();
    if (nextSelectionVersion === this.#selectionVersion) {
      return;
    }

    this.#selectionVersion = nextSelectionVersion;
    onSelectionChange(this.#controller.getSelectedPaths());
  }

  #toNativeRow(row: FileTreeVisibleRow): NativeFileTreeVisibleRow {
    const targetPath = getTargetPath(row);
    const ownGitStatus = this.#gitStatusState?.statusByPath.get(targetPath);
    const gitStatus =
      ownGitStatus ??
      getInheritedIgnoredGitStatus(
        row.ancestorPaths,
        this.#gitStatusState?.ignoredDirectoryPaths
      );
    const containsGitChange =
      row.kind === 'directory' &&
      (this.#gitStatusState?.directoriesWithChanges.has(targetPath) ?? false);
    const renameView = this.#controller[FILE_TREE_RENAME_VIEW]();
    const renamingPath = renameView.getPath();

    return {
      ...row,
      containsGitChange,
      gitStatus,
      isRenaming: renamingPath === targetPath,
      renamingValue: renamingPath === targetPath ? renameView.getValue() : '',
      targetPath,
    };
  }
}

export type {
  FileTreeBatchOperation,
  FileTreeMoveOptions,
  FileTreeMutationEvent,
  FileTreeMutationEventForType,
  FileTreeMutationEventType,
  FileTreeRemoveOptions,
  FileTreeRenameEvent,
  FileTreeRenamingConfig,
  FileTreeResetOptions,
  FileTreeScrollOffset,
  FileTreeScrollToPathOptions,
  FileTreeSelectionChangeListener,
  FileTreeVisibleRow,
} from '../model/publicTypes';
export type { GitStatus, GitStatusEntry } from '../publicTypes';
