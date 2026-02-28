<!--
  トースト通知コンテナ。画面右下に固定配置。
  タイプ別の左ボーダーカラーで区別し、duration=0 のトーストには閉じるボタンを表示する。
  MEMO: {#if} で囲むと {#each} のトランジションと競合するため、コンテナは常にDOMに存在させる。
-->
<script lang="ts">
  import { toastStore } from "$lib/stores/toast.svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
</script>

<div class="toast-container" role="status" aria-live="polite">
  {#each toastStore.toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      in:fly={{ x: 300, duration: 300, easing: cubicOut }}
      out:fade={{ duration: 200 }}
    >
      <span class="toast-message">{toast.message}</span>
      {#if toast.duration === 0}
        <button
          class="toast-close"
          onclick={() => toastStore.remove(toast.id)}
          aria-label="閉じる"
        >
          ✕
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 360px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 6px;
    border-left: 3px solid;
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: 13px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
  }

  .toast-success {
    border-left-color: var(--color-success);
  }

  .toast-error {
    border-left-color: var(--color-error);
  }

  .toast-warning {
    border-left-color: var(--color-warning);
  }

  .toast-info {
    border-left-color: var(--color-info);
  }

  .toast-message {
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }

  .toast-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    line-height: 1;
  }

  .toast-close:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
</style>
