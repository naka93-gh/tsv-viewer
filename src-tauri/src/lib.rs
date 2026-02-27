use tauri::Manager;
use tauri::window::{Color, Effect, EffectState, EffectsBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            // Webview 背景を透過にする
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
