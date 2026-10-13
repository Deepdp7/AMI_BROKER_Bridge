use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::Manager;

/// Loopback port used only to detect a second copy of the app and bring the first one forward.
const SINGLE_INSTANCE_PORT: u16 = 7892;
const SINGLE_INSTANCE_HELLO: &[u8] = b"DATABRIDGE\n";
const BACKEND_LOG_MAX_BYTES: u64 = 20 * 1024 * 1024;

/// The local-api data engine, run as a hidden child process and restarted if it dies.
struct Backend {
    child: Mutex<Option<Child>>,
    quitting: AtomicBool,
}

impl Backend {
    fn new() -> Self {
        Backend { child: Mutex::new(None), quitting: AtomicBool::new(false) }
    }

    /// Kill the engine for good (app is quitting).
    fn stop(&self) {
        self.quitting.store(true, Ordering::SeqCst);
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    /// Kill the engine; the supervisor starts a fresh one.
    fn restart(&self) {
        if let Some(child) = self.child.lock().unwrap().as_mut() {
            let _ = child.kill();
        }
    }
}

fn logs_dir() -> PathBuf {
    let base = std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
    base.join("DataBridgePro").join("logs")
}

/// %APPDATA%\DataBridgePro\logs\backend.log (rotated to backend.old.log past 20 MB).
/// This replaces the old console window: the same output is shown live in the app's Console page.
fn open_backend_log() -> Option<File> {
    let dir = logs_dir();
    fs::create_dir_all(&dir).ok()?;
    let path = dir.join("backend.log");
    if fs::metadata(&path).map(|m| m.len() > BACKEND_LOG_MAX_BYTES).unwrap_or(false) {
        let _ = fs::rename(&path, dir.join("backend.old.log"));
    }
    OpenOptions::new().create(true).append(true).open(path).ok()
}

fn supervisor_log(msg: &str) {
    println!("{msg}");
    if let Some(mut f) = open_backend_log() {
        let _ = writeln!(f, "[Supervisor] {msg}");
    }
}

fn backend_exe() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    ["local-api.exe", "local-api-x86_64-pc-windows-msvc.exe"]
        .iter()
        .map(|name| exe_dir.join(name))
        .find(|p| p.exists())
}

fn spawn_backend(exe: &PathBuf) -> std::io::Result<Child> {
    let mut cmd = Command::new(exe);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    if let Some(out) = open_backend_log() {
        let err = out.try_clone()?;
        cmd.stdout(Stdio::from(out)).stderr(Stdio::from(err));
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }
    // Lets the engine exit on its own if this app is killed without a clean shutdown.
    cmd.env("DATABRIDGE_PARENT_PID", std::process::id().to_string());
    cmd.stdin(Stdio::null()).spawn()
}

/// Keeps the engine running: restarts it with backoff if it crashes or exits
/// (e.g. after "Full Force Clean", which exits the engine on purpose).
fn supervise(backend: Arc<Backend>, exe: PathBuf) {
    let mut delay = Duration::from_secs(1);
    while !backend.quitting.load(Ordering::SeqCst) {
        let started = Instant::now();
        match spawn_backend(&exe) {
            Ok(child) => {
                supervisor_log(&format!("Data engine started (pid {})", child.id()));
                *backend.child.lock().unwrap() = Some(child);
            }
            Err(e) => {
                supervisor_log(&format!("Failed to start data engine: {e}"));
                std::thread::sleep(delay);
                delay = (delay * 2).min(Duration::from_secs(30));
                continue;
            }
        }

        // Poll instead of wait() so stop()/restart() can take the lock at any time.
        let status = loop {
            if backend.quitting.load(Ordering::SeqCst) {
                return;
            }
            {
                let mut guard = backend.child.lock().unwrap();
                match guard.as_mut().map(|c| c.try_wait()) {
                    Some(Ok(Some(status))) => {
                        *guard = None;
                        break Some(status);
                    }
                    Some(Ok(None)) => {}
                    Some(Err(_)) | None => {
                        *guard = None;
                        break None;
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(500));
        };

        if backend.quitting.load(Ordering::SeqCst) {
            return;
        }
        if started.elapsed() > Duration::from_secs(60) {
            delay = Duration::from_secs(1);
        }
        supervisor_log(&format!(
            "Data engine stopped ({}). Restarting in {}s...",
            status.map(|s| s.to_string()).unwrap_or_else(|| "unknown".into()),
            delay.as_secs()
        ));
        std::thread::sleep(delay);
        delay = (delay * 2).min(Duration::from_secs(30));
    }
}

/// Returns the lock listener if we are the first instance, or None if another
/// DataBridge instance answered (it has been asked to show its window).
fn acquire_single_instance() -> Option<Option<TcpListener>> {
    match TcpListener::bind(("127.0.0.1", SINGLE_INSTANCE_PORT)) {
        Ok(listener) => Some(Some(listener)),
        Err(_) => {
            // Port taken: is it really us, or some unrelated program?
            if let Ok(mut s) = TcpStream::connect_timeout(
                &([127, 0, 0, 1], SINGLE_INSTANCE_PORT).into(),
                Duration::from_millis(500),
            ) {
                let _ = s.set_read_timeout(Some(Duration::from_millis(1000)));
                let mut buf = [0u8; 16];
                if let Ok(n) = s.read(&mut buf) {
                    if buf[..n].starts_with(SINGLE_INSTANCE_HELLO) {
                        return None;
                    }
                }
            }
            Some(None) // not ours — run without the guard
        }
    }
}

fn show_main_window(app: &tauri::AppHandle) {
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
    let instance_lock = match acquire_single_instance() {
        Some(lock) => lock,
        None => return, // the running instance brought its window to the front
    };

    let backend = Arc::new(Backend::new());
    let backend_for_exit = backend.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(backend.clone())
        .invoke_handler(tauri::generate_handler![restart_backend])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Some(listener) = instance_lock {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    for mut stream in listener.incoming().flatten() {
                        let _ = stream.write_all(SINGLE_INSTANCE_HELLO);
                        show_main_window(&handle);
                    }
                });
            }

            // In dev the API is started by `npm run dev:desktop`; in release we own it.
            if !cfg!(debug_assertions) {
                if let Some(exe) = backend_exe() {
                    #[cfg(windows)]
                    {
                        // Kill engines orphaned by a previous crash so the ports are free.
                        for name in ["local-api.exe", "local-api-x86_64-pc-windows-msvc.exe"] {
                            let _ = Command::new("taskkill").args(["/F", "/IM", name, "/T"]).output();
                        }
                    }
                    let backend = backend.clone();
                    std::thread::spawn(move || supervise(backend, exe));
                } else {
                    supervisor_log("local-api executable not found next to the app");
                }
            }

            use tauri::{
                menu::{Menu, MenuItem},
                tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
            };

            let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let restart_i = MenuItem::with_id(app, "restart", "Restart Data Engine", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit DataBridge", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &restart_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("DataBridge Pro")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.state::<Arc<Backend>>().stop();
                        app.exit(0);
                    }
                    "restart" => app.state::<Arc<Backend>>().restart(),
                    "show" => show_main_window(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps streaming in the background (tray icon stays)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
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
