<!-- ステータスバー。ファイル名・文字コード・行数×列数を表示する。 -->
<script lang="ts">
  import type { ParsedFile } from "$lib/types";

  interface Props {
    file: ParsedFile;
  }
  let { file }: Props = $props();

  /** パスからファイル名を取得 */
  function basename(path: string): string {
    return path.split(/[/\\]/).pop() ?? path;
  }

  let fileName = $derived(basename(file.path));
  let dimensions = $derived(
    `${file.row_count.toLocaleString()}行 \u00d7 ${file.column_count}列`,
  );
</script>

<div class="status-bar">
  <span class="item">{fileName}</span>
  <span class="sep">&vert;</span>
  <span class="item">{file.encoding}</span>
  <span class="sep">&vert;</span>
  <span class="item">{dimensions}</span>
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 12px;
    background: var(--color-surface);
    font-size: 11px;
    color: var(--color-text-secondary);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .sep {
    color: var(--color-border-strong);
  }
</style>
