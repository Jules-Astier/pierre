import { docsCodeSnippet } from '@/lib/docsCodeSnippet';

export const REACT_QUICKSTART_INSTALL = docsCodeSnippet(
  'install.sh',
  `bun add @baguette-studios/trees
# npm: npm install @baguette-studios/trees
# pnpm: pnpm add @baguette-studios/trees`
);

export const REACT_QUICKSTART_PROJECT_TREE = docsCodeSnippet(
  'project-tree.tsx',
  `import { FileTree, useFileTree } from '@baguette-studios/trees/react';
import type { FileTreePreparedInput } from '@baguette-studios/trees';

interface ProjectTreeProps {
  preparedInput: FileTreePreparedInput;
}

export function ProjectTree({ preparedInput }: ProjectTreeProps) {
  const { model } = useFileTree({
    preparedInput,
    search: true,
    initialExpandedPaths: ['src', 'src/components'],
  });

  return (
    <FileTree
      model={model}
      className="rounded-lg border"
      style={{ height: '320px' }}
    />
  );
}`
);

export const REACT_QUICKSTART_SEARCHABLE_TREE = docsCodeSnippet(
  'searchable-tree.tsx',
  `import {
  FileTree,
  useFileTree,
  useFileTreeSearch,
  useFileTreeSelection,
} from '@baguette-studios/trees/react';

export function SearchableTree({ paths }: { paths: readonly string[] }) {
  const { model } = useFileTree({
    paths,
    fileTreeSearchMode: 'hide-non-matches',
    search: true,
  });
  const selectedPaths = useFileTreeSelection(model);
  const search = useFileTreeSearch(model);

  return (
    <div className="space-y-3">
      <input
        value={search.value}
        onChange={(event) => search.setValue(event.target.value)}
        placeholder="Search files"
      />
      <p>{selectedPaths.length} item(s) selected.</p>
      <FileTree model={model} className="rounded-lg border" />
    </div>
  );
}`
);
