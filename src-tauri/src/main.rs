// リリースビルドで Windows のコンソールウィンドウを非表示にする
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// アプリケーションのエントリポイント。lib.rs の run() に委譲する。
fn main() {
    tsv_viewer_lib::run()
}
