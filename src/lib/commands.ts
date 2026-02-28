/**
 * Tauri コマンドのフロントエンド側ラッパー。
 * Rust バックエンドの呼び出しをここに集約する。
 */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  FileMetadata,
  FilterItem,
  ParsedFile,
  RowsResult,
  SortItem,
} from "./types";

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
 * 保存先を選択するダイアログを開き、選択されたパスを返す。
 * キャンセル時は null。
 */
export async function saveFileDialog(
  defaultPath?: string,
): Promise<string | null> {
  const path = await save({
    defaultPath,
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

/** 閲覧モード用: ファイルを読み込み Rust にキャッシュし metadata のみ返す */
export async function openFileView(path: string): Promise<FileMetadata> {
  return invoke<FileMetadata>("open_file_view", { path });
}

/** ページング範囲の行を取得。ソート・フィルタを Rust 側で処理 */
export async function getRows(
  path: string,
  startRow: number,
  endRow: number,
  sortModel: SortItem[],
  filterModel: Record<string, FilterItem>,
  quickFilter: string,
): Promise<RowsResult> {
  return invoke<RowsResult>("get_rows", {
    path,
    startRow,
    endRow,
    sortModel,
    filterModel,
    quickFilter,
  });
}

/** 編集モード切替時に全行取得 */
export async function getAllRows(path: string): Promise<ParsedFile> {
  return invoke<ParsedFile>("get_all_rows", { path });
}

/** Rust 側のキャッシュを解放 */
export async function closeFile(path: string): Promise<void> {
  return invoke("close_file", { path });
}

/**
 * ヘッダーと行データを TSV 形式で指定パスに保存する。
 */
export async function saveFile(
  path: string,
  headers: string[],
  rows: string[][],
  encoding: string,
  lineEnding: string,
): Promise<void> {
  return invoke("save_file", { path, headers, rows, encoding, lineEnding });
}
