use crate::parser::ParsedFile;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

pub struct FileStore {
    pub files: Mutex<HashMap<String, CachedFile>>,
}

impl FileStore {
    pub fn new() -> Self {
        Self {
            files: Mutex::new(HashMap::new()),
        }
    }
}

pub struct CachedFile {
    pub parsed: ParsedFile,
    /// ソート・フィルタ適用後の行インデックス
    pub view_indices: Vec<usize>,
    /// キャッシュ無効化判定用
    pub last_sort_key: String,
    pub last_filter_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub headers: Vec<String>,
    pub encoding: String,
    pub path: String,
    pub row_count: usize,
    pub column_count: usize,
    pub line_ending: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RowsResult {
    pub rows: Vec<Vec<String>>,
    pub last_row: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SortItem {
    #[serde(rename = "colId")]
    pub col_id: String,
    pub sort: String, // "asc" | "desc"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterItem {
    #[serde(rename = "filterType")]
    pub filter_type: String,
    #[serde(rename = "type")]
    pub filter_op: String,
    pub filter: String,
}

/// フィルタ→ソートの順に view_indices を再構築する
pub fn rebuild_view_indices(
    cached: &mut CachedFile,
    sort_model: &[SortItem],
    filter_model: &HashMap<String, FilterItem>,
    quick_filter: &str,
) {
    let sort_key = serde_json::to_string(sort_model).unwrap_or_default();
    let filter_key = format!(
        "{}|{}",
        serde_json::to_string(filter_model).unwrap_or_default(),
        quick_filter
    );

    if sort_key == cached.last_sort_key && filter_key == cached.last_filter_key {
        return;
    }

    let headers = &cached.parsed.headers;
    let rows = &cached.parsed.rows;

    // フィルタ適用
    let mut indices: Vec<usize> = (0..rows.len())
        .filter(|&i| {
            let row = &rows[i];

            // クイックフィルタ: いずれかのセルに部分一致
            if !quick_filter.is_empty() {
                let qf_lower = quick_filter.to_lowercase();
                let matched = row
                    .iter()
                    .any(|cell| cell.to_lowercase().contains(&qf_lower));
                if !matched {
                    return false;
                }
            }

            // カラムフィルタ
            for (col_id, filter) in filter_model {
                let col_idx = headers
                    .iter()
                    .position(|h| h == col_id)
                    .or_else(|| col_id.parse::<usize>().ok());
                let Some(idx) = col_idx else { continue };
                let cell = row.get(idx).map(|s| s.as_str()).unwrap_or("");
                if !apply_filter(cell, filter) {
                    return false;
                }
            }

            true
        })
        .collect();

    // ソート適用
    if !sort_model.is_empty() {
        indices.sort_by(|&a, &b| {
            for item in sort_model {
                let col_idx = headers
                    .iter()
                    .position(|h| h == &item.col_id)
                    .or_else(|| item.col_id.parse::<usize>().ok())
                    .unwrap_or(0);

                let val_a = rows[a].get(col_idx).map(|s| s.as_str()).unwrap_or("");
                let val_b = rows[b].get(col_idx).map(|s| s.as_str()).unwrap_or("");

                let cmp = match (val_a.parse::<f64>(), val_b.parse::<f64>()) {
                    (Ok(na), Ok(nb)) => na.partial_cmp(&nb).unwrap_or(std::cmp::Ordering::Equal),
                    _ => val_a.cmp(val_b),
                };

                let cmp = if item.sort == "desc" {
                    cmp.reverse()
                } else {
                    cmp
                };
                if cmp != std::cmp::Ordering::Equal {
                    return cmp;
                }
            }
            std::cmp::Ordering::Equal
        });
    }

    cached.view_indices = indices;
    cached.last_sort_key = sort_key;
    cached.last_filter_key = filter_key;
}

/// AG Grid 標準フィルタ演算を適用
fn apply_filter(cell: &str, filter: &FilterItem) -> bool {
    let cell_lower = cell.to_lowercase();
    let filter_lower = filter.filter.to_lowercase();

    match filter.filter_op.as_str() {
        "contains" => cell_lower.contains(&filter_lower),
        "notContains" => !cell_lower.contains(&filter_lower),
        "equals" => cell_lower == filter_lower,
        "notEqual" => cell_lower != filter_lower,
        "startsWith" => cell_lower.starts_with(&filter_lower),
        "endsWith" => cell_lower.ends_with(&filter_lower),
        "blank" => cell.trim().is_empty(),
        "notBlank" => !cell.trim().is_empty(),
        _ => true,
    }
}
