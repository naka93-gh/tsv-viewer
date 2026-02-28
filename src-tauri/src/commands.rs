use crate::encoding;
use crate::parser::{self, FileMetadata, ParsedFile};
use crate::state::{rebuild_view_indices, CachedFile, FileStore, FilterItem, RowsResult, SortItem};
use std::collections::HashMap;
use std::fs;
use tauri::State;

/// 閲覧モード用: ファイルを読み込み State にキャッシュし、metadata のみ返す
#[tauri::command]
pub fn open_file_view(path: String, store: State<FileStore>) -> Result<FileMetadata, String> {
    let bytes = fs::read(&path).map_err(|e| format!("ファイルの読み込みに失敗: {e}"))?;
    let (text, enc) = encoding::detect_and_decode(&bytes);
    let line_ending = encoding::detect_line_ending(&text);
    let parsed = parser::parse_tsv(&text, &path, &enc, line_ending)?;

    let metadata = parsed.meta.clone();
    let row_count = parsed.meta.row_count;
    let cached = CachedFile {
        parsed,
        view_indices: (0..row_count).collect(),
        last_sort_key: String::new(),
        last_filter_key: String::new(),
    };

    let mut files = store.files.lock().map_err(|e| format!("Lock error: {e}"))?;
    files.insert(path, cached);

    Ok(metadata)
}

/// ページング範囲の行を返す。ソート・フィルタ適用済み。
#[tauri::command]
pub fn get_rows(
    path: String,
    start_row: usize,
    end_row: usize,
    sort_model: Vec<SortItem>,
    filter_model: HashMap<String, FilterItem>,
    quick_filter: String,
    store: State<FileStore>,
) -> Result<RowsResult, String> {
    let mut files = store.files.lock().map_err(|e| format!("Lock error: {e}"))?;
    let cached = files
        .get_mut(&path)
        .ok_or_else(|| format!("ファイルがキャッシュにありません: {path}"))?;

    rebuild_view_indices(cached, &sort_model, &filter_model, &quick_filter);

    let total = cached.view_indices.len();
    let start = start_row.min(total);
    let end = end_row.min(total);

    let rows: Vec<Vec<String>> = cached.view_indices[start..end]
        .iter()
        .map(|&idx| cached.parsed.rows[idx].clone())
        .collect();

    Ok(RowsResult {
        rows,
        last_row: total,
    })
}

/// 編集モード切替時に全行取得
#[tauri::command]
pub fn get_all_rows(path: String, store: State<FileStore>) -> Result<ParsedFile, String> {
    let files = store.files.lock().map_err(|e| format!("Lock error: {e}"))?;
    let cached = files
        .get(&path)
        .ok_or_else(|| format!("ファイルがキャッシュにありません: {path}"))?;

    Ok(cached.parsed.clone())
}

/// キャッシュ削除
#[tauri::command]
pub fn close_file(path: String, store: State<FileStore>) -> Result<(), String> {
    let mut files = store.files.lock().map_err(|e| format!("Lock error: {e}"))?;
    files.remove(&path);
    Ok(())
}

/// ヘッダーと行データを TSV 形式で指定パスに保存する。
/// 元の文字コードを維持して書き出す。
/// 保存後、FileStore のキャッシュも更新する（閲覧モードとの整合性維持）。
#[tauri::command]
pub fn save_file(
    path: String,
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    encoding: String,
    line_ending: String,
    store: State<FileStore>,
) -> Result<(), String> {
    let mut lines: Vec<String> = Vec::with_capacity(rows.len() + 1);
    lines.push(headers.join("\t"));
    for row in &rows {
        lines.push(row.join("\t"));
    }
    let separator = if line_ending == "CRLF" { "\r\n" } else { "\n" };
    let text = lines.join(separator);

    let bytes = encoding::encode(&text, &encoding)?;
    fs::write(&path, bytes).map_err(|e| format!("ファイルの保存に失敗: {e}"))?;

    // キャッシュを更新（閲覧モードに戻った時に最新データを返すため）
    if let Ok(mut files) = store.files.lock() {
        let row_count = rows.len();
        let column_count = headers.len();
        files.insert(
            path.clone(),
            CachedFile {
                parsed: ParsedFile {
                    meta: FileMetadata {
                        headers,
                        encoding,
                        path,
                        row_count,
                        column_count,
                        line_ending,
                    },
                    rows,
                },
                view_indices: (0..row_count).collect(),
                last_sort_key: String::new(),
                last_filter_key: String::new(),
            },
        );
    }

    Ok(())
}
