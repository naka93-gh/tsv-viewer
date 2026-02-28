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
  import { toastStore } from "$lib/stores/toast.svelte";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  let searchQuery = $derived(tabStore.activeTab?.searchQuery ?? "");
  let mode = $derived(tabStore.activeTab?.mode ?? "view");
  let rows = $derived(tabStore.activeTab?.rows ?? []);
  let dirtyCells = $derived(
    tabStore.activeTab?.dirtyCells ?? new Set<string>(),
  );

  /** キーボードショートカット */
  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    if (e.key === "e") {
      e.preventDefault();
      tabStore.toggleMode();
    } else if (e.key === "s") {
      e.preventDefault();
      tabStore.save();
    } else if (e.key === "z" && e.shiftKey) {
      e.preventDefault();
      tabStore.redo();
    } else if (e.key === "z") {
      e.preventDefault();
      tabStore.undo();
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
      const unlisten = await appWindow.onDragDropEvent(async (event) => {
        if (cancelled) return;
        if (event.payload.type === "drop" && event.payload.paths.length > 0) {
          const paths = event.payload.paths.filter(
            (p) => p.endsWith(".tsv") || p.endsWith(".txt"),
          );
          await Promise.all(
            paths.map((p) => tabStore.open(p, { silent: true })),
          );
          if (paths.length === 1) {
            const name = paths[0].split("/").pop() ?? paths[0];
            toastStore.success(`${name} を読み込みました`);
          } else if (paths.length > 1) {
            toastStore.success(`${paths.length} 件のファイルを読み込みました`);
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
  {#key tabStore.activeTabId}
    <DataGrid
      file={tabStore.activeTab.file}
      {rows}
      {searchQuery}
      {mode}
      {dirtyCells}
      lastGridOp={tabStore.lastGridOp}
      onCellEdit={(op) => tabStore.applyEdit(op)}
      onAddRow={(rowIndex, position) => tabStore.addRow(rowIndex, position)}
      onDeleteRow={(rowIndex) => tabStore.deleteRow(rowIndex)}
    />
  {/key}
  <StatusBar file={tabStore.activeTab.file} rowCount={rows.length} {mode} />
{:else}
  <EmptyState />
{/if}
