<!--
  ルートレイアウト。
  - グローバル CSS (theme.css) の読み込み
  - アプリ全体の縦方向 Flex レイアウト: タイトルバー + コンテンツ領域
  - タイトルバーは macOS Overlay スタイル用のドラッグ領域
-->
<script lang="ts">
  import "$lib/theme.css";

  let { children } = $props();
</script>

<div class="app">
  <div class="titlebar" data-tauri-drag-region></div>
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-window-bg);
  }

  .titlebar {
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
