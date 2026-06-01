import type { FileTreeOptions } from '@baguette-studios/trees';

export type FileTreePathOptions = FileTreeOptions & {
  paths: readonly string[];
};
