'use client';

import { useEffect, useRef, useState } from 'react';

import { NativeFileTree, type NativeFileTreeOptions } from './NativeFileTree';

interface CleanUpRef {
  model: NativeFileTree;
  timeout: ReturnType<typeof setTimeout> | null;
}

export interface UseFileTreeResult {
  model: NativeFileTree;
}

export function useFileTree(options: NativeFileTreeOptions): UseFileTreeResult {
  const [model] = useState(() => new NativeFileTree(options));
  const cleanUpRef = useRef<CleanUpRef>({ model, timeout: null });
  useEffect(() => {
    const { current } = cleanUpRef;
    if (current.timeout != null) {
      clearTimeout(current.timeout);
      current.timeout = null;
    }
    return () => {
      current.timeout = setTimeout(() => current.model.cleanUp(), 1);
    };
  }, []);
  return { model };
}
