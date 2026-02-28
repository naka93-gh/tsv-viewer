mod commands;
mod encoding;
mod parser;
mod state;

use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::window::{Color, Effect, EffectState, EffectsBuilder};
use tauri::Manager;

/// Tauri アプリケーションを構築・起動する。
///
/// - プラグイン登録 (opener, dialog)
/// - フロントエンドから呼び出せるコマンドの登録
/// - カスタムメニュー設定（macOS デフォルトメニューのショートカット横取りを防止）
/// - ウィンドウの透過・ブラー効果の設定 (macOS)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state::FileStore::new())
        .invoke_handler(tauri::generate_handler![
            commands::open_file_view,
            commands::get_rows,
            commands::get_all_rows,
            commands::close_file,
            commands::save_file
        ])
        .menu(|handle| {
            let app_submenu = Submenu::with_items(
                handle,
                "TSV Viewer",
                true,
                &[
                    &MenuItem::with_id(handle, "about", "About TSV Viewer", true, None::<&str>)?,
                    &MenuItem::with_id(
                        handle,
                        "quit",
                        "Quit TSV Viewer",
                        true,
                        Some("CmdOrCtrl+Q"),
                    )?,
                ],
            )?;
            Menu::with_items(handle, &[&app_submenu])
        })
        .on_menu_event(|app, event| {
            if event.id() == "quit" {
                app.exit(0);
            }
        })
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            window.set_background_color(Some(Color(0, 0, 0, 0)))?;

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
