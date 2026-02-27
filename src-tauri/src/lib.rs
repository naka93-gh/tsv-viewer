mod commands;
mod encoding;
mod parser;

use tauri::Manager;
use tauri::window::{Color, Effect, EffectState, EffectsBuilder};

/// Tauri アプリケーションを構築・起動する。
///
/// - プラグイン登録 (opener, dialog)
/// - フロントエンドから呼び出せるコマンドの登録
/// - ウィンドウの透過・ブラー効果の設定 (macOS)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![commands::open_file])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            // Webview 背景を透過にする
            window.set_background_color(Some(Color(0, 0, 0, 0)))?;

            // macOS: ウィンドウ背景にブラー効果を適用
            #[cfg(target_os = "macos")]
            window.set_effects(
                EffectsBuilder::new()
                    .effect(Effect::UnderWindowBackground)
                    .state(EffectState::Active)
                    .build(),
            )?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
