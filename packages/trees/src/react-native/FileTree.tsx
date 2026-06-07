/** @jsxImportSource react */
'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  VirtualizedList,
} from 'react-native';
import type {
  ListRenderItemInfo,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';

import {
  getNativeFileTreeRowLabel,
  NativeFileTree,
  type NativeFileTreeScrollRequest,
  type NativeFileTreeVisibleRow,
} from './NativeFileTree';
import { useFileTreeSelector } from './useFileTreeSelector';

const GIT_STATUS_LABEL = {
  added: 'A',
  deleted: 'D',
  ignored: 'I',
  modified: 'M',
  renamed: 'R',
  untracked: 'U',
} as const;

const DEFAULT_FILE_ICON = {
  color: '#84848a',
  label: '\u2022',
} as const;

const ROW_ACCESSIBILITY_ROLE = Platform.OS === 'web' ? undefined : 'button';

interface FileTreeSnapshot {
  focusedParentPath: string | null;
  itemHeight: number;
  scrollRequest: NativeFileTreeScrollRequest | null;
  searchEnabled: boolean;
  searchValue: string;
  version: number;
  visibleCount: number;
}

export interface FileTreeRenderIconContext {
  kind: 'collapsed-directory' | 'expanded-directory' | 'file';
  row: NativeFileTreeVisibleRow;
}

export interface FileTreeRenderRowAccessoryContext {
  row: NativeFileTreeVisibleRow;
}

export interface FileTreeRenderRowContext {
  activate: () => void;
  defaultContent: React.JSX.Element;
  row: NativeFileTreeVisibleRow;
  startRenaming: () => boolean;
  toggleDirectory: () => void;
}

export interface FileTreeProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  listStyle?: StyleProp<ViewStyle>;
  model: NativeFileTree;
  renderIcon?: (context: FileTreeRenderIconContext) => ReactNode;
  renderRow?: (context: FileTreeRenderRowContext) => React.JSX.Element | null;
  renderRowAccessory?: (
    context: FileTreeRenderRowAccessoryContext
  ) => ReactNode;
  rowStyle?:
    | StyleProp<ViewStyle>
    | ((row: NativeFileTreeVisibleRow) => StyleProp<ViewStyle>);
  rowTextStyle?:
    | StyleProp<TextStyle>
    | ((row: NativeFileTreeVisibleRow) => StyleProp<TextStyle>);
  searchInputStyle?: StyleProp<TextStyle>;
  searchPlaceholder?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function getFocusedParentPath(model: NativeFileTree): string | null {
  const focusedPath = model.getFocusedPath();
  if (focusedPath == null) {
    return null;
  }

  const visibleCount = model.getVisibleCount();
  if (visibleCount <= 0) {
    return null;
  }

  const focusedRow =
    model
      .getVisibleRows(0, visibleCount - 1)
      .find((row) => row.targetPath === focusedPath) ?? null;

  return focusedRow?.ancestorPaths.at(-1) ?? null;
}

function getSnapshot(model: NativeFileTree): FileTreeSnapshot {
  return {
    focusedParentPath: getFocusedParentPath(model),
    itemHeight: model.getItemHeight(),
    scrollRequest: model.getScrollRequest(),
    searchEnabled: model.isSearchEnabled(),
    searchValue: model.getSearchValue(),
    version: model.getVersion(),
    visibleCount: model.getVisibleCount(),
  };
}

function areSnapshotsEqual(
  previous: FileTreeSnapshot,
  next: FileTreeSnapshot
): boolean {
  return (
    previous.focusedParentPath === next.focusedParentPath &&
    previous.itemHeight === next.itemHeight &&
    previous.searchEnabled === next.searchEnabled &&
    previous.searchValue === next.searchValue &&
    previous.version === next.version &&
    previous.visibleCount === next.visibleCount &&
    previous.scrollRequest?.id === next.scrollRequest?.id
  );
}

function getIconKind(
  row: NativeFileTreeVisibleRow
): FileTreeRenderIconContext['kind'] {
  if (row.kind === 'file') {
    return 'file';
  }

  return row.isExpanded ? 'expanded-directory' : 'collapsed-directory';
}

function getGitStatusColor(
  status: NativeFileTreeVisibleRow['gitStatus']
): string | null {
  switch (status) {
    case 'added':
    case 'untracked':
      return '#16a994';
    case 'deleted':
      return '#ff2e3f';
    case 'ignored':
      return '#adadb1';
    case 'modified':
      return '#1ca1c7';
    case 'renamed':
      return '#d5a910';
    default:
      return null;
  }
}

function getGitStatusStyle(
  status: NativeFileTreeVisibleRow['gitStatus']
): StyleProp<TextStyle> | null {
  switch (status) {
    case 'added':
    case 'untracked':
      return styles.gitStatusAdded;
    case 'deleted':
      return styles.gitStatusDeleted;
    case 'ignored':
      return styles.gitStatusIgnored;
    case 'modified':
      return styles.gitStatusModified;
    case 'renamed':
      return styles.gitStatusRenamed;
    default:
      return null;
  }
}

function getFileIconDescriptor(row: NativeFileTreeVisibleRow): {
  color: string;
  kind?: 'react';
  label: string;
} {
  const name = row.name.toLowerCase();

  if (name.endsWith('.tsx') || name.endsWith('.jsx')) {
    return { color: '#1ca1c7', kind: 'react', label: '\u269b\ufe0e' };
  }
  if (name.endsWith('.ts')) {
    return { color: '#1a85d4', label: 'TS' };
  }
  if (name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.cjs')) {
    return { color: '#d5a910', label: 'JS' };
  }
  if (name.endsWith('.json')) {
    return { color: '#d47628', label: '{}' };
  }
  if (name.endsWith('.md') || name.endsWith('.mdx')) {
    return { color: '#199f43', label: 'M\u2193' };
  }
  if (name.endsWith('.css')) {
    return { color: '#693acf', label: '#' };
  }
  if (name.endsWith('.html')) {
    return { color: '#d47628', label: '<>' };
  }

  return DEFAULT_FILE_ICON;
}

function renderDefaultIcon(row: NativeFileTreeVisibleRow): ReactNode {
  const statusStyle = getGitStatusStyle(row.gitStatus);

  if (row.kind === 'file') {
    const descriptor = getFileIconDescriptor(row);
    return (
      <Text
        style={[
          styles.fileIconText,
          descriptor.kind === 'react' ? styles.reactFileIconText : null,
          { color: descriptor.color },
          statusStyle,
          row.gitStatus === 'ignored' ? styles.ignoredIcon : null,
        ]}
      >
        {descriptor.label}
      </Text>
    );
  }

  const strokeColor = getGitStatusColor(row.gitStatus) ?? '#84848a';

  return (
    <View
      style={[
        styles.chevronIcon,
        row.gitStatus === 'ignored' ? styles.ignoredIcon : null,
      ]}
    >
      <View
        style={[
          styles.chevronStroke,
          { backgroundColor: strokeColor },
          row.isExpanded
            ? styles.chevronExpandedLeft
            : styles.chevronCollapsedTop,
        ]}
      />
      <View
        style={[
          styles.chevronStroke,
          { backgroundColor: strokeColor },
          row.isExpanded
            ? styles.chevronExpandedRight
            : styles.chevronCollapsedBottom,
        ]}
      />
    </View>
  );
}

function renderDefaultRowAccessory(row: NativeFileTreeVisibleRow): ReactNode {
  if (row.gitStatus != null) {
    return (
      <Text style={[styles.gitStatus, getGitStatusStyle(row.gitStatus)]}>
        {GIT_STATUS_LABEL[row.gitStatus]}
      </Text>
    );
  }

  if (!row.containsGitChange) {
    return null;
  }

  return (
    <Text style={[styles.gitStatusDot, styles.gitStatusModified]}>
      {'\u2022'}
    </Text>
  );
}

function isPressableHovered(state: { pressed: boolean }): boolean {
  return 'hovered' in state && state.hovered === true;
}

function getDensityFactor(itemHeight: number): number {
  return itemHeight > 0 ? itemHeight / 30 : 1;
}

function getRowHorizontalPadding(itemHeight: number): number {
  return Math.max(4, Math.round(8 * getDensityFactor(itemHeight)));
}

function getRowBorderRadius(itemHeight: number): number {
  return Math.max(4, Math.round(6 * getDensityFactor(itemHeight)));
}

function getIconGap(itemHeight: number): number {
  return Math.max(4, Math.round(6 * getDensityFactor(itemHeight)));
}

function renderIndentGuides(
  row: NativeFileTreeVisibleRow,
  itemHeight: number,
  focusedParentPath: string | null,
  showAllGuides: boolean
): ReactNode {
  if (row.depth <= 0) {
    return null;
  }

  const horizontalPadding = getRowHorizontalPadding(itemHeight);

  return (
    <View pointerEvents="none" style={styles.indentGuideLayer}>
      {Array.from({ length: row.depth }).map((_, index) => (
        <View
          key={row.ancestorPaths[index] ?? index}
          style={[
            styles.indentGuide,
            showAllGuides || row.ancestorPaths[index] === focusedParentPath
              ? styles.visibleIndentGuide
              : null,
            {
              left: horizontalPadding + 8 + index * 16,
            },
          ]}
        />
      ))}
    </View>
  );
}

function resolveStyle<TStyle>(
  style:
    | StyleProp<TStyle>
    | ((row: NativeFileTreeVisibleRow) => StyleProp<TStyle>)
    | undefined,
  row: NativeFileTreeVisibleRow
): StyleProp<TStyle> {
  return typeof style === 'function'
    ? (style as (row: NativeFileTreeVisibleRow) => StyleProp<TStyle>)(row)
    : style;
}

export function FileTree({
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  listStyle,
  model,
  renderIcon,
  renderRow,
  renderRowAccessory,
  rowStyle,
  rowTextStyle,
  searchInputStyle,
  searchPlaceholder = 'Search files',
  style,
  testID,
}: FileTreeProps): React.JSX.Element {
  const listRef = useRef<VirtualizedList<NativeFileTreeVisibleRow | null>>(
    null
  );
  const snapshot = useFileTreeSelector(model, getSnapshot, areSnapshotsEqual);
  const hoveredRowsRef = useRef(0);
  const [isTreeHovered, setIsTreeHovered] = useState(false);

  useEffect(() => {
    const request = snapshot.scrollRequest;
    if (request == null) {
      return;
    }

    const viewPosition =
      request.offset === 'center' ? 0.5 : request.offset === 'top' ? 0 : 0;
    try {
      listRef.current?.scrollToIndex({
        animated: true,
        index: request.visibleIndex,
        viewPosition,
      });
    } finally {
      model.clearScrollRequest(request.id);
    }
  }, [model, snapshot.scrollRequest]);

  const getItem = useCallback(
    (tree: NativeFileTree, index: number) => tree.getVisibleRow(index),
    []
  );
  const getItemCount = useCallback(
    (tree: NativeFileTree) => tree.getVisibleCount(),
    []
  );
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      index,
      length: snapshot.itemHeight,
      offset: snapshot.itemHeight * index,
    }),
    [snapshot.itemHeight]
  );
  const keyExtractor = useCallback(
    (row: NativeFileTreeVisibleRow | null, index: number) =>
      row?.targetPath ?? String(index),
    []
  );
  const handleScrollToIndexFailed = useCallback(
    (info: { averageItemLength: number; index: number }) => {
      listRef.current?.scrollToOffset({
        animated: true,
        offset: Math.max(0, info.averageItemLength * info.index),
      });
    },
    []
  );
  const handleSearchFocus = useCallback(() => {
    if (!model.isSearchOpen()) {
      model.openSearch(model.getSearchValue());
    }
  }, [model]);
  const handleRowHoverIn = useCallback(() => {
    hoveredRowsRef.current += 1;
    setIsTreeHovered(true);
  }, []);
  const handleRowHoverOut = useCallback(() => {
    hoveredRowsRef.current = Math.max(0, hoveredRowsRef.current - 1);
    if (hoveredRowsRef.current === 0) {
      setIsTreeHovered(false);
    }
  }, []);
  const renderItem = useCallback(
    ({ item: row }: ListRenderItemInfo<NativeFileTreeVisibleRow | null>) => {
      if (row == null) {
        return null;
      }

      const label = getNativeFileTreeRowLabel(row);
      const activate = () => {
        model.activateRow(row);
      };
      const toggleDirectory = () => {
        model.toggleDirectory(row.targetPath);
      };
      const startRenaming = () => model.startRenaming(row.targetPath);
      const icon =
        renderIcon?.({ kind: getIconKind(row), row }) ?? renderDefaultIcon(row);
      const accessory =
        renderRowAccessory?.({ row }) ?? renderDefaultRowAccessory(row);
      const horizontalPadding = getRowHorizontalPadding(snapshot.itemHeight);
      const iconGap = getIconGap(snapshot.itemHeight);
      const statusStyle = getGitStatusStyle(row.gitStatus);
      const content = (
        <Pressable
          accessibilityLabel={label}
          accessibilityRole={ROW_ACCESSIBILITY_ROLE}
          accessibilityState={{
            expanded: row.kind === 'directory' ? row.isExpanded : undefined,
            selected: row.isSelected,
          }}
          onLongPress={startRenaming}
          onHoverIn={handleRowHoverIn}
          onHoverOut={handleRowHoverOut}
          onPress={activate}
          style={(state) => [
            styles.row,
            {
              borderRadius: getRowBorderRadius(snapshot.itemHeight),
              height: snapshot.itemHeight,
              minHeight: snapshot.itemHeight,
              paddingLeft: horizontalPadding + row.depth * 16,
              paddingRight: horizontalPadding,
            },
            isPressableHovered(state) && !row.isSelected
              ? styles.hoveredRow
              : null,
            row.isSelected ? styles.selectedRow : null,
            state.pressed && !row.isSelected ? styles.pressedRow : null,
            row.isFocused && !row.isSelected ? styles.focusedRow : null,
            resolveStyle(rowStyle, row),
          ]}
          testID={
            testID == null ? undefined : `${testID}-row-${row.targetPath}`
          }
        >
          {(state) => (
            <>
              {renderIndentGuides(
                row,
                snapshot.itemHeight,
                snapshot.focusedParentPath,
                isTreeHovered || isPressableHovered(state)
              )}
              <View style={[styles.icon, { marginRight: iconGap }]}>
                {icon}
              </View>
              {row.isRenaming ? (
                <TextInput
                  autoFocus
                  onBlur={() => {
                    model.commitRenaming();
                  }}
                  onChangeText={(value) => {
                    model.setRenamingValue(value);
                  }}
                  onSubmitEditing={() => {
                    model.commitRenaming();
                  }}
                  selectTextOnFocus
                  style={[
                    styles.renameInput,
                    statusStyle,
                    resolveStyle(rowTextStyle, row),
                  ]}
                  value={row.renamingValue}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    statusStyle,
                    resolveStyle(rowTextStyle, row),
                  ]}
                >
                  {label}
                </Text>
              )}
              {accessory == null ? null : (
                <View style={styles.accessory}>{accessory}</View>
              )}
            </>
          )}
        </Pressable>
      );

      return (
        renderRow?.({
          activate,
          defaultContent: content,
          row,
          startRenaming,
          toggleDirectory,
        }) ?? content
      );
    },
    [
      model,
      handleRowHoverIn,
      handleRowHoverOut,
      isTreeHovered,
      renderIcon,
      renderRow,
      renderRowAccessory,
      rowStyle,
      rowTextStyle,
      snapshot.focusedParentPath,
      snapshot.itemHeight,
      testID,
    ]
  );

  const extraData = useMemo(
    () => ({
      focusedParentPath: snapshot.focusedParentPath,
      itemHeight: snapshot.itemHeight,
      isTreeHovered,
      searchValue: snapshot.searchValue,
      version: snapshot.version,
    }),
    [
      isTreeHovered,
      snapshot.focusedParentPath,
      snapshot.itemHeight,
      snapshot.searchValue,
      snapshot.version,
    ]
  );

  return (
    <View style={[styles.root, style]} testID={testID}>
      {snapshot.searchEnabled ? (
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={(value) => {
            model.setSearch(value);
          }}
          onFocus={handleSearchFocus}
          placeholder={searchPlaceholder}
          style={[styles.searchInput, searchInputStyle]}
          value={snapshot.searchValue}
        />
      ) : null}
      <VirtualizedList
        contentContainerStyle={contentContainerStyle}
        data={model}
        extraData={extraData}
        getItem={getItem}
        getItemCount={getItemCount}
        getItemLayout={getItemLayout}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyExtractor={keyExtractor}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        ref={listRef}
        renderItem={renderItem}
        style={[styles.list, listStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    width: 12,
  },
  chevronCollapsedBottom: {
    left: 5,
    top: 8.25,
    transform: [{ rotate: '-45deg' }],
  },
  chevronCollapsedTop: {
    left: 5,
    top: 4.75,
    transform: [{ rotate: '45deg' }],
  },
  chevronExpandedLeft: {
    left: 2.9,
    top: 6.25,
    transform: [{ rotate: '45deg' }],
  },
  chevronExpandedRight: {
    left: 7.1,
    top: 6.25,
    transform: [{ rotate: '-45deg' }],
  },
  chevronIcon: {
    height: 16,
    position: 'relative',
    width: 16,
  },
  chevronStroke: {
    borderRadius: 1,
    height: 2,
    position: 'absolute',
    width: 7.5,
  },
  fileIconText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
  },
  focusedRow: {
    borderColor: 'rgba(0, 159, 255, 0.58)',
  },
  gitStatusAdded: {
    color: '#16a994',
  },
  gitStatusDeleted: {
    color: '#ff2e3f',
  },
  gitStatus: {
    color: '#84848a',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  gitStatusDot: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  gitStatusIgnored: {
    color: '#adadb1',
  },
  gitStatusModified: {
    color: '#1ca1c7',
  },
  gitStatusRenamed: {
    color: '#d5a910',
  },
  hoveredRow: {
    backgroundColor: '#e4f2fa',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
  },
  ignoredIcon: {
    opacity: 0.5,
  },
  indentGuide: {
    borderLeftColor: 'rgba(132, 132, 138, 0.25)',
    borderLeftWidth: 1,
    bottom: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  indentGuideLayer: {
    bottom: -1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -1,
  },
  label: {
    color: '#6c6c71',
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  list: {
    backgroundColor: '#f8f8f8',
    flex: 1,
  },
  pressedRow: {
    backgroundColor: '#dceff8',
  },
  reactFileIconText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
  },
  renameInput: {
    color: '#6c6c71',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    margin: 0,
    padding: 0,
  },
  root: {
    backgroundColor: '#f8f8f8',
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#f8f8f8',
    borderColor: '#eeeeef',
    borderRadius: 6,
    borderWidth: 1,
    color: '#6c6c71',
    fontSize: 13,
    fontWeight: '600',
    height: 30,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  selectedRow: {
    backgroundColor: '#e1f1fb',
  },
  visibleIndentGuide: {
    opacity: 0.75,
  },
});
