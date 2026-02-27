/**
 * Tauri コマンドのフロントエンド側ラッパー。
 * Rust バックエンドの呼び出しをここに集約する。
 */
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ParsedFile } from "./types";

/**
 * ネイティブのファイル選択ダイアログを開き、選択されたパスを返す。
 * キャンセル時は null。
 */
export async function openFileDialog(): Promise<string | null> {
  const path = await open({
    filters: [{ name: "TSV", extensions: ["tsv", "txt"] }],
  });
  return path;
}

/**
 * 指定パスの TSV ファイルを Rust 側で読み込み・パースし、結果を返す。
 */
export async function openFile(path: string): Promise<ParsedFile> {
  return invoke<ParsedFile>("open_file", { path });
}
