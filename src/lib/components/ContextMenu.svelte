<!-- 右クリックコンテキストメニュー。編集モードでの行操作に使用。 -->
<script lang="ts">
  interface Props {
    x: number;
    y: number;
    onAddAbove: () => void;
    onAddBelow: () => void;
    onDelete: () => void;
    onClose: () => void;
  }
  let { x, y, onAddAbove, onAddBelow, onDelete, onClose }: Props = $props();

  let menuEl: HTMLDivElement | undefined = $state();

  /** メニュー外クリックで閉じる */
  function handleWindowClick(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      onClose();
    }
  }

  /** Escape で閉じる */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }

  $effect(() => {
    window.addEventListener("click", handleWindowClick, true);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("click", handleWindowClick, true);
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  /** メニューが画面外にはみ出さないよう位置を調整 */
  let adjustedX = $derived(Math.min(x, window.innerWidth - 180));
  let adjustedY = $derived(Math.min(y, window.innerHeight - 120));
</script>

<div
  class="context-menu"
  bind:this={menuEl}
  style="left: {adjustedX}px; top: {adjustedY}px;"
>
  <button class="menu-item" onclick={onAddAbove}>上に行を追加</button>
  <button class="menu-item" onclick={onAddBelow}>下に行を追加</button>
  <div class="separator"></div>
  <button class="menu-item danger" onclick={onDelete}>行を削除</button>
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 10000;
    min-width: 160px;
    padding: 4px 0;
    background: rgba(45, 45, 45, 0.98);
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
  }

  .menu-item {
    all: unset;
    display: block;
    width: 100%;
    padding: 6px 12px;
    font-size: 12px;
    color: var(--color-text-primary);
    cursor: pointer;
    box-sizing: border-box;
  }

  .menu-item:hover {
    background: var(--color-accent-subtle);
  }

  .menu-item.danger {
    color: var(--color-error);
  }

  .menu-item.danger:hover {
    background: rgba(247, 118, 142, 0.15);
  }

  .separator {
    height: 1px;
    margin: 4px 0;
    background: var(--color-border-strong);
  }
</style>
