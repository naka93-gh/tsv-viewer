<!--
  ルートレイアウト。
  - グローバル CSS (theme.css) の読み込み
  - アプリ全体の縦方向 Flex レイアウト: タイトルバー + コンテンツ領域
  - タブがあるとき → TitleBar（タブバー付き）
  - タブがないとき → 空のドラッグ領域（38px）
-->
<script lang="ts">
  import "$lib/theme.css";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import { tabStore } from "$lib/stores/tabs.svelte";

  let { children } = $props();
</script>

<div class="app">
  {#if tabStore.hasTabs}
    <TitleBar />
  {:else}
    <div class="titlebar-empty" data-tauri-drag-region></div>
  {/if}
  <div class="content">
    {@render children()}
  </div>
  <ToastContainer />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-window-bg);
  }

  .titlebar-empty {
    height: 38px;
    flex-shrink: 0;
  }

  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
