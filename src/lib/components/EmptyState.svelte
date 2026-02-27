<!-- ファイル未読込時の空状態画面。「ファイルを開く」ボタンでダイアログを表示する。 -->
<script lang="ts">
  import { tabStore } from "$lib/stores/tabs.svelte";

  async function handleOpen() {
    try {
      await tabStore.openDialog();
    } catch (e) {
      console.error("ファイルを開けませんでした:", e);
    }
  }
</script>

<div class="empty-state">
  <div class="file-icon">
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  </div>

  <button class="open-button" type="button" onclick={handleOpen}
    >ファイルを開く</button
  >

  <p class="hint">TSVファイルを選択、または D&D</p>
</div>

<style>
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .file-icon {
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .open-button {
    padding: 8px 24px;
    border: 1px solid var(--color-accent);
    border-radius: 6px;
    background: transparent;
    color: var(--color-accent);
    font-family: var(--font-ui);
    font-size: 13px;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .open-button:hover {
    background: var(--color-accent);
    color: #1e1e1e;
  }

  .hint {
    color: var(--color-text-secondary);
    font-size: 12px;
  }
</style>
