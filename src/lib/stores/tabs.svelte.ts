/** マルチタブ状態管理。各タブが独立したファイルと検索クエリを保持する。 */
import { openFile, openFileDialog } from "$lib/commands";
import type { TabState } from "$lib/types";

let nextId = 0;
function generateId(): string {
  return `tab-${nextId++}`;
}

class TabStore {
  tabs = $state<TabState[]>([]);
  activeTabId = $state<string | null>(null);

  get activeTab(): TabState | undefined {
    return this.tabs.find((t) => t.id === this.activeTabId);
  }

  get hasTabs(): boolean {
    return this.tabs.length > 0;
  }

  /** ファイルを新タブで開く。同一パスが既に開かれていればそのタブをアクティブにする。 */
  async open(path: string): Promise<void> {
    const existing = this.tabs.find((t) => t.file.path === path);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }

    const file = await openFile(path);
    const id = generateId();
    this.tabs.push({ id, file, searchQuery: "" });
    this.activeTabId = id;
  }

  /** ファイル選択ダイアログを表示し、選択されたファイルを新タブで開く。 */
  async openDialog(): Promise<void> {
    const path = await openFileDialog();
    if (path) {
      await this.open(path);
    }
  }

  /** 指定タブをアクティブにする。 */
  activate(tabId: string): void {
    this.activeTabId = tabId;
  }

  /** 指定タブを閉じる。閉じた後は隣のタブをアクティブにする。 */
  close(tabId: string): void {
    const index = this.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const wasActive = this.activeTabId === tabId;
    this.tabs.splice(index, 1);

    if (wasActive) {
      if (this.tabs.length === 0) {
        this.activeTabId = null;
      } else {
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.activeTabId = this.tabs[nextIndex].id;
      }
    }
  }

  /** アクティブタブの検索クエリを更新する。 */
  setSearchQuery(query: string): void {
    const tab = this.activeTab;
    if (tab) {
      tab.searchQuery = query;
    }
  }
}

export const tabStore = new TabStore();
