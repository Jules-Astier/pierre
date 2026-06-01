'use client';

import type { NativeFileTree } from './NativeFileTree';
import { areArraysEqual, useFileTreeSelector } from './useFileTreeSelector';

export function useFileTreeSelection(model: NativeFileTree): readonly string[] {
  return useFileTreeSelector(
    model,
    (currentModel) => currentModel.getSelectedPaths(),
    areArraysEqual
  );
}
