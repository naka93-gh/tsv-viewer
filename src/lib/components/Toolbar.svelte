<!-- ツールバー。検索バーを提供する。 -->
<script lang="ts">
  interface Props {
    searchQuery: string;
    onSearchChange: (query: string) => void;
  }
  let { searchQuery, onSearchChange }: Props = $props();

  let inputEl: HTMLInputElement | undefined = $state();

  /** Ctrl+F (macOS: Cmd+F) で検索バーにフォーカス */
  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      inputEl?.focus();
      inputEl?.select();
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<div class="toolbar">
  <div class="search-box">
    <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor">
      <path
        d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04Z"
      />
    </svg>
    <input
      bind:this={inputEl}
      value={searchQuery}
      oninput={(e) => onSearchChange(e.currentTarget.value)}
      type="text"
      class="search-input"
      placeholder="検索..."
    />
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 12px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    width: 280px;
  }

  .search-box:focus-within {
    border-color: var(--color-accent);
  }

  .search-icon {
    width: 14px;
    height: 14px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .search-input {
    all: unset;
    flex: 1;
    font-size: 12px;
    color: var(--color-text-primary);
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
  }
</style>
