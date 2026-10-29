//! DataBridge Pro desktop shell: the window, the tray icon, and the data engine it runs.
//!
//!   amibroker.rs        finding AmiBroker anywhere on the PC (remembered), opening / focusing it
//!   autostart.rs        Start with Windows (tray, hidden window)
//!   engine.rs           local-api.exe supervisor (start, restart, clean stop)
//!   secret_key.rs       DPAPI-locked key the engine encrypts broker credentials with
//!   single_instance.rs  one app per user; a second launch shows the running window
//!   tray.rs             notification-area menu
//!   window_chrome.rs    custom title bar support (Windows 11 Snap Layouts), no browser menus/keys

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::Manager;

mod amibroker;
mod autostart;
mod engine;
mod secret_key;
mod single_instance;
mod tray;
#[cfg(windows)]
mod window_chrome;

use engine::{supervisor_log, Backend};

/// Set once the app starts quitting (window closed or tray Quit)
static QUITTING_APP: AtomicBool = AtomicBool::new(false);

/// Set once the window was first shown (it waits for the page's data, see `app_ready`)
static FIRST_SHOWN: AtomicBool = AtomicBool::new(false);

/// Longest the window waits for the page to say its data is in (a slow first engine start)
const FIRST_SHOW_FALLBACK: std::time::Duration = std::time::Duration::from_secs(10);

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
    FIRST_SHOWN.store(true, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// First start: shows the window once, unless Windows started the app at login (that start
/// stays in the tray until the tray icon or the shortcut is used)
fn reveal_on_start(app: &tauri::AppHandle) {
    if autostart::launched_at_login() || FIRST_SHOWN.load(Ordering::SeqCst) {
        return;
    }
    show_main_window(app);
}

/// The page has its first data (symbols, brokers, settings) on screen: show the window now,
/// so it never opens on an empty "Connecting…" page
#[tauri::command]
fn app_ready(app: tauri::AppHandle) {
    reveal_on_start(&app);
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

    // In release the app owns the engine (in dev `npm run dev` starts it). Started first thing,
    // so it boots while the window and page are being created rather than after
    if !cfg!(debug_assertions) {
        engine::start(&backend);
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(backend.clone());

    // `generate_handler!` takes a plain list, so the platform split happens here
    #[cfg(windows)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_ready,
        restart_backend,
        autostart::get_autostart,
        autostart::set_autostart,
        amibroker::start_amibroker,
        amibroker::locate_amibroker,
        window_chrome::set_maximize_button_rect,
        window_chrome::open_devtools
    ]);
    #[cfg(not(windows))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_ready,
        restart_backend,
        autostart::get_autostart,
        autostart::set_autostart,
        amibroker::start_amibroker,
        amibroker::locate_amibroker
    ]);

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
                window_chrome::make_webview_native(&window);
            }

            if let Some(listener) = instance_lock {
                let handle = app.handle().clone();
                single_instance::serve(listener, || QUITTING_APP.load(Ordering::SeqCst), move || show_main_window(&handle));
            }

            tray::build(app)?;

            // Find AmiBroker once in the background, so "Open AmiBroker" is instant
            amibroker::warm_up();

            // The window starts hidden (tauri.conf.json) and is shown when the page has its first
            // data (`app_ready`), so it opens full rather than on an empty page. If the page never
            // says so (engine very slow to start), it is shown anyway after a few seconds.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(FIRST_SHOW_FALLBACK);
                reveal_on_start(&handle);
            });

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
