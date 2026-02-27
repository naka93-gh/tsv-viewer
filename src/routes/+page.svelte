<!--
  メインページ。
  - タブ未選択 → EmptyState を表示
  - タブ選択済み → DataGrid を表示
  - Tauri の D&D イベントを購読し、ドロップされた TSV/TXT を自動で開く（複数対応）
-->
<script lang="ts">
  import DataGrid from "$lib/components/DataGrid.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { tabStore } from "$lib/stores/tabs.svelte";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  let searchQuery = $derived(tabStore.activeTab?.searchQuery ?? "");

  /** Tauri のファイル D&D イベントを購読。コンポーネント破棄時に解除する。 */
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
  <Toolbar {searchQuery} onSearchChange={(q) => tabStore.setSearchQuery(q)} />
  <DataGrid file={tabStore.activeTab.file} {searchQuery} />
  <StatusBar file={tabStore.activeTab.file} />
{:else}
  <EmptyState />
{/if}
