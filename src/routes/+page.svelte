<!--
  メインページ。
  - ファイル未読込 → EmptyState を表示
  - ファイル読込済み → DataGrid を表示
  - Tauri の D&D イベントを購読し、ドロップされた TSV/TXT を自動で開く
-->
<script lang="ts">
  import DataGrid from "$lib/components/DataGrid.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { fileState } from "$lib/stores/tabs.svelte";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  let searchQuery = $state("");

  /** Tauri のファイル D&D イベントを購読。コンポーネント破棄時に解除する。 */
  $effect(() => {
    const appWindow = getCurrentWebviewWindow();
    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await appWindow.onDragDropEvent((event) => {
        if (cancelled) return;
        if (event.payload.type === "drop" && event.payload.paths.length > 0) {
          const path = event.payload.paths[0];
          if (path.endsWith(".tsv") || path.endsWith(".txt")) {
            fileState.load(path).catch((e) => {
              console.error("ファイルを開けませんでした:", e);
            });
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

{#if fileState.current}
  <Toolbar bind:searchQuery />
  <DataGrid file={fileState.current} {searchQuery} />
  <StatusBar file={fileState.current} />
{:else}
  <EmptyState />
{/if}
