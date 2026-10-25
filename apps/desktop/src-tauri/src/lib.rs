//! DataBridge Pro desktop shell: the window, the tray icon, and the data engine it runs.
//!
//!   engine.rs           local-api.exe supervisor (start, restart, clean stop)
//!   single_instance.rs  one app per user; a second launch shows the running window
//!   tray.rs             notification-area menu
//!   window_chrome.rs    custom title bar support (Windows 11 Snap Layouts)

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::Manager;

mod engine;
mod single_instance;
mod tray;
#[cfg(windows)]
mod window_chrome;

use engine::{supervisor_log, Backend};

/// Set once the app starts quitting (window closed or tray Quit)
static QUITTING_APP: AtomicBool = AtomicBool::new(false);

/// Closing the window quits DataBridge, engine included: the window goes away at once, the
/// engine saves its buffered data and stops, then the app exits. The next start's catch-up
/// downloads whatever was missed while it was closed.
pub(crate) fn quit_app(app: &tauri::AppHandle) {
    if QUITTING_APP.swap(true, Ordering::SeqCst) {
        return;
    }
    for window in app.webview_windows().values() {
        let _ = window.hide();
    }
    supervisor_log("App closed: stopping the data engine");
    let app = app.clone();
    std::thread::spawn(move || {
        app.state::<Arc<Backend>>().shutdown();
        app.exit(0);
    });
}

pub(crate) fn show_main_window(app: &tauri::AppHandle) {
    if QUITTING_APP.load(Ordering::SeqCst) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn restart_backend(backend: tauri::State<'_, Arc<Backend>>) {
    supervisor_log("Restart requested from the app");
    backend.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let instance_lock = match single_instance::acquire() {
        Some(lock) => lock,
        None => return, // the running instance brought its window to the front
    };

    let backend = Arc::new(Backend::new());
    let backend_for_exit = backend.clone();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(backend.clone());

    // `generate_handler!` takes a plain list, so the platform split happens here
    #[cfg(windows)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        restart_backend,
        window_chrome::set_maximize_button_rect
    ]);
    #[cfg(not(windows))]
    let builder = builder.invoke_handler(tauri::generate_handler![restart_backend]);

    builder
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                window_chrome::install(&window);
            }

            if let Some(listener) = instance_lock {
                let handle = app.handle().clone();
                single_instance::serve(listener, || QUITTING_APP.load(Ordering::SeqCst), move || show_main_window(&handle));
            }

            // In dev the engine is started by `npm run dev`; in release the app owns it
            if !cfg!(debug_assertions) {
                engine::start(&backend);
            }

            tray::build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window (red button, Alt+F4, taskbar) quits everything
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                quit_app(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                backend_for_exit.stop();
            }
        });
}
