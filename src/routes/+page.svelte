<!--
  メインページ。
  - タブ未選択 → EmptyState を表示
  - タブ選択済み → Toolbar + DataGrid + StatusBar を表示
  - キーボードショートカット: Ctrl+E, Ctrl+S, Ctrl+Z, Ctrl+Shift+Z
  - Tauri の D&D イベントを購読し、ドロップされた TSV/TXT を自動で開く
-->
<script lang="ts">
  import DataGrid from "$lib/components/DataGrid.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { tabStore } from "$lib/stores/tabs.svelte";
  import type { EditOp } from "$lib/types";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  let searchQuery = $derived(tabStore.activeTab?.searchQuery ?? "");
  let mode = $derived(tabStore.activeTab?.mode ?? "view");
  let rows = $derived(tabStore.activeTab?.rows ?? []);
  let dirtyCells = $derived(
    tabStore.activeTab?.dirtyCells ?? new Set<string>(),
  );

  let dataGrid: DataGrid | undefined = $state();

  /** セル編集コールバック */
  function handleCellEdit(op: EditOp): void {
    tabStore.applyEdit(op);
    // AG Grid は自身で値を更新済みなので refreshGrid は不要
  }

  /** 行追加 */
  function handleAddRow(rowIndex: number, position: "above" | "below"): void {
    const tab = tabStore.activeTab;
    if (!tab) return;

    const insertIndex = position === "above" ? rowIndex : rowIndex + 1;
    const emptyRow = new Array(tab.file.headers.length).fill("");

    tabStore.applyEdit({
      type: "addRow",
      rowIndex: insertIndex,
      row: emptyRow,
    });
    dataGrid?.refreshGrid();
  }

  /** 行削除 */
  function handleDeleteRow(rowIndex: number): void {
    const tab = tabStore.activeTab;
    if (!tab || rowIndex < 0 || rowIndex >= tab.rows.length) return;

    tabStore.applyEdit({
      type: "deleteRow",
      rowIndex,
      row: [...tab.rows[rowIndex]],
    });
    dataGrid?.refreshGrid();
  }

  /** キーボードショートカット */
  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    if (e.key === "e") {
      e.preventDefault();
      tabStore.toggleMode();
    } else if (e.key === "s") {
      e.preventDefault();
      tabStore
        .save()
        .then(() => dataGrid?.refreshGrid())
        .catch((err) => console.error("保存に失敗:", err));
    } else if (e.key === "z" && e.shiftKey) {
      e.preventDefault();
      const op = tabStore.redo();
      if (op) dataGrid?.refreshGrid();
    } else if (e.key === "z") {
      e.preventDefault();
      const op = tabStore.undo();
      if (op) dataGrid?.refreshGrid();
    }
  }

  $effect(() => {
    // capture phase で登録し、AG Grid が stopPropagation しても受け取れるようにする
    window.addEventListener("keydown", handleKeydown, true);
    return () => window.removeEventListener("keydown", handleKeydown, true);
  });

  /** Tauri のファイル D&D イベントを購読 */
  $effect(() => {
    const appWindow = getCurrentWebviewWindow();
    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await appWindow.onDragDropEvent((event) => {
        if (cancelled) return;
        if (event.payload.type === "drop" && event.payload.paths.length > 0) {
          for (const path of event.payload.paths) {
            if (path.endsWith(".tsv") || path.endsWith(".txt")) {
              tabStore.open(path).catch((e) => {
                console.error("ファイルを開けませんでした:", e);
              });
            }
          }
        }
      });

      return unlisten;
    };

    let unlistenFn: (() => void) | undefined;
    setupListener().then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  });
</script>

{#if tabStore.activeTab}
  <Toolbar
    {searchQuery}
    onSearchChange={(q) => tabStore.setSearchQuery(q)}
    {mode}
    onToggleMode={() => tabStore.toggleMode()}
  />
  <DataGrid
    bind:this={dataGrid}
    file={tabStore.activeTab.file}
    {rows}
    {searchQuery}
    {mode}
    {dirtyCells}
    onCellEdit={handleCellEdit}
    onAddRow={handleAddRow}
    onDeleteRow={handleDeleteRow}
  />
  <StatusBar file={tabStore.activeTab.file} rowCount={rows.length} {mode} />
{:else}
  <EmptyState />
{/if}
