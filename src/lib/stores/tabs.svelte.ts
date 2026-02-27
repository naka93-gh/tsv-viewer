/**
 * ファイル状態管理。
 * シングルファイルのみ対応。
 * TODO: マルチタブ対応。
 */
import { openFile, openFileDialog } from "$lib/commands";
import type { ParsedFile } from "$lib/types";

class FileState {
  /** 現在開いているファイルのパース結果。未読込時は null。 */
  current = $state<ParsedFile | null>(null);

  /** 指定パスのファイルを読み込んで current にセットする。 */
  async load(path: string): Promise<void> {
    this.current = await openFile(path);
  }

  /** ファイル選択ダイアログを表示し、選択されたファイルを読み込む。 */
  async openDialog(): Promise<void> {
    const path = await openFileDialog();
    if (path) {
      await this.load(path);
    }
  }
}

export const fileState = new FileState();
