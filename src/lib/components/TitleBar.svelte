<!-- タイトルバー統合タブバー。macOS のトラフィックライト領域を避けつつ、タブ一覧と [+] ボタンを表示する。 -->
<script lang="ts">
  import { tabStore } from "$lib/stores/tabs.svelte";

  function fileName(path: string): string {
    return path.split("/").pop() ?? path;
  }

  function handleAdd() {
    tabStore.openDialog();
  }
</script>

<div class="titlebar" data-tauri-drag-region>
  <div class="traffic-light-spacer"></div>

  <div class="tabs" data-tauri-drag-region>
    {#each tabStore.tabs as tab (tab.id)}
      <div
        class="tab"
        class:active={tab.id === tabStore.activeTabId}
        onclick={() => tabStore.activate(tab.id)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") tabStore.activate(tab.id);
        }}
        role="tab"
        tabindex="0"
        aria-selected={tab.id === tabStore.activeTabId}
      >
        <span class="tab-label">
          {fileName(tab.fileMeta.path)}
          {#if tab.dirty}
            <span class="dirty-marker">●</span>
          {/if}
        </span>
        <button
          class="tab-close"
          onclick={(e) => {
            e.stopPropagation();
            tabStore.close(tab.id);
          }}
          aria-label="タブを閉じる"
        >
          ×
        </button>
      </div>
    {/each}
  </div>

  <button class="add-button" onclick={handleAdd} aria-label="ファイルを開く">
    +
  </button>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    height: 38px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .traffic-light-spacer {
    width: 78px;
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    height: 100%;
    gap: 1px;
  }

  .tab {
    all: unset;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
    padding: 0 12px;
    font-size: 12px;
    color: var(--color-text-secondary);
    cursor: pointer;
    position: relative;
    -webkit-app-region: no-drag;
    max-width: 180px;
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-hover);
  }

  .tab.active {
    color: var(--color-text-primary);
  }

  .tab.active::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 8px;
    right: 8px;
    height: 2px;
    background: var(--color-accent);
    border-radius: 1px;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dirty-marker {
    color: var(--color-unsaved-marker);
    margin-left: 2px;
  }

  .tab-close {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: 14px;
    color: var(--color-text-secondary);
    border-radius: 3px;
    cursor: pointer;
    opacity: 0;
    -webkit-app-region: no-drag;
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .add-button {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 18px;
    color: var(--color-text-secondary);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
    margin: 0 4px;
    -webkit-app-region: no-drag;
  }

  .add-button:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
</style>
