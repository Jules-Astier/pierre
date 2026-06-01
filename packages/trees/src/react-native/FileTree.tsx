/** @jsxImportSource react */
'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
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

interface FileTreeSnapshot {
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

function getSnapshot(model: NativeFileTree): FileTreeSnapshot {
  return {
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

function renderDefaultIcon(row: NativeFileTreeVisibleRow): ReactNode {
  if (row.kind === 'file') {
    return <Text style={styles.iconText}>-</Text>;
  }

  return <Text style={styles.iconText}>{row.isExpanded ? 'v' : '>'}</Text>;
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
        renderRowAccessory?.({ row }) ??
        (row.gitStatus != null ? (
          <Text style={styles.gitStatus}>
            {GIT_STATUS_LABEL[row.gitStatus]}
          </Text>
        ) : row.containsGitChange ? (
          <Text style={styles.gitStatus}>*</Text>
        ) : null);
      const content = (
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          accessibilityState={{
            expanded: row.kind === 'directory' ? row.isExpanded : undefined,
            selected: row.isSelected,
          }}
          onLongPress={startRenaming}
          onPress={activate}
          style={({ pressed }) => [
            styles.row,
            { minHeight: snapshot.itemHeight, paddingLeft: 8 + row.depth * 16 },
            row.isSelected ? styles.selectedRow : null,
            row.isFocused ? styles.focusedRow : null,
            pressed ? styles.pressedRow : null,
            resolveStyle(rowStyle, row),
          ]}
          testID={
            testID == null ? undefined : `${testID}-row-${row.targetPath}`
          }
        >
          <View style={styles.icon}>{icon}</View>
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
              style={[styles.renameInput, resolveStyle(rowTextStyle, row)]}
              value={row.renamingValue}
            />
          ) : (
            <Text
              numberOfLines={1}
              style={[styles.label, resolveStyle(rowTextStyle, row)]}
            >
              {label}
            </Text>
          )}
          {accessory == null ? null : (
            <View style={styles.accessory}>{accessory}</View>
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
      renderIcon,
      renderRow,
      renderRowAccessory,
      rowStyle,
      rowTextStyle,
      snapshot.itemHeight,
      testID,
    ]
  );

  const extraData = useMemo(
    () => ({
      itemHeight: snapshot.itemHeight,
      searchValue: snapshot.searchValue,
      version: snapshot.version,
    }),
    [snapshot.itemHeight, snapshot.searchValue, snapshot.version]
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
    marginLeft: 8,
  },
  focusedRow: {
    borderColor: '#3b82f6',
  },
  gitStatus: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    width: 18,
  },
  iconText: {
    color: '#475569',
    fontSize: 12,
  },
  label: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  pressedRow: {
    opacity: 0.72,
  },
  renameInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    margin: 0,
    padding: 0,
  },
  root: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    paddingRight: 8,
  },
  searchInput: {
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 14,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedRow: {
    backgroundColor: '#e0f2fe',
  },
});
