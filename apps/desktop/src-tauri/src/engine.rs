//! The data engine (local-api.exe) as a hidden child process: started with the app, restarted
//! if it dies, and stopped cleanly when the app quits (it saves its buffered data first).
//! Its output goes to %APPDATA%\DataBridgePro\logs\backend.log.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const BACKEND_LOG_MAX_BYTES: u64 = 20 * 1024 * 1024;
/// local-api HTTP port
const ENGINE_PORT: u16 = 7890;
/// How long the engine gets to save its buffered data before it is killed
const ENGINE_STOP_TIMEOUT: Duration = Duration::from_secs(4);


/// The local-api data engine, run as a hidden child process and restarted if it dies.
pub(crate) struct Backend {
    child: Mutex<Option<Child>>,
    quitting: AtomicBool,
}

impl Backend {
    pub(crate) fn new() -> Self {
        Backend { child: Mutex::new(None), quitting: AtomicBool::new(false) }
    }

    /// Kill the engine for good (app is quitting).
    pub(crate) fn stop(&self) {
        self.quitting.store(true, Ordering::SeqCst);
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    /// Stop the engine for good, cleanly: ask it to save its buffered bars and logs and exit,
    /// kill it only if it hasn't within a few seconds. In dev the engine is not our child
    /// (`npm run dev` starts it); it gets the same request, so it saves before `concurrently`
    /// ends the rest of the dev processes.
    pub(crate) fn shutdown(&self) {
        self.quitting.store(true, Ordering::SeqCst);
        let asked = request_engine_shutdown();
        let deadline = Instant::now() + ENGINE_STOP_TIMEOUT;
        while asked && Instant::now() < deadline {
            let exited = match self.child.lock().unwrap().as_mut() {
                Some(child) => matches!(child.try_wait(), Ok(Some(_))),
                None => !engine_listening(),
            };
            if exited {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        self.stop();
    }

    /// Kill the engine; the supervisor starts a fresh one.
    pub(crate) fn restart(&self) {
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

pub(crate) fn supervisor_log(msg: &str) {
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

fn spawn_backend(exe: &PathBuf, secret_key: &str) -> std::io::Result<Child> {
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
    // Encrypts broker credentials in the database; empty = no key, the engine stores them plain
    cmd.env("DATABRIDGE_SECRET_KEY", secret_key);
    // The engine may exit to restart itself (restore from a backup): this supervisor starts it again
    cmd.env("DATABRIDGE_SUPERVISED", "1");
    cmd.stdin(Stdio::null()).spawn()
}

/// Keeps the engine running: restarts it with backoff if it crashes or exits
/// (e.g. after "Full Force Clean", which exits the engine on purpose).
fn supervise(backend: Arc<Backend>, exe: PathBuf, secret_key: String) {
    let mut delay = Duration::from_secs(1);
    while !backend.quitting.load(Ordering::SeqCst) {
        let started = Instant::now();
        match spawn_backend(&exe, &secret_key) {
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

/// Asks the engine on 127.0.0.1:7890 to save and exit. False if no engine answered.
fn request_engine_shutdown() -> bool {
    let Ok(mut s) = TcpStream::connect_timeout(&([127, 0, 0, 1], ENGINE_PORT).into(), Duration::from_millis(500)) else {
        return false;
    };
    let _ = s.set_write_timeout(Some(Duration::from_millis(500)));
    let _ = s.set_read_timeout(Some(Duration::from_millis(2000)));
    let request = format!(
        "POST /api/system/shutdown HTTP/1.1\r\nHost: 127.0.0.1:{ENGINE_PORT}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    );
    if s.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 64];
    matches!(s.read(&mut buf), Ok(n) if n > 0)
}

fn engine_listening() -> bool {
    TcpStream::connect_timeout(&([127, 0, 0, 1], ENGINE_PORT).into(), Duration::from_millis(200)).is_ok()
}

/// Kills an engine orphaned by a previous crash so its ports are free. Only when something
/// still answers on the engine port: taskkill takes a second or more, and most starts have
/// nothing to clean up.
fn kill_orphaned_engine() {
    if !engine_listening() {
        return;
    }
    supervisor_log("An engine from a previous run is still running: stopping it");
    #[cfg(windows)]
    for name in ["local-api.exe", "local-api-x86_64-pc-windows-msvc.exe"] {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", name, "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

/// Starts the engine next to the app and keeps it running (release builds; in dev
/// `npm run dev` starts it). Returns at once: the work happens on a background thread, so
/// the window opens without waiting for it.
pub(crate) fn start(backend: &Arc<Backend>) {
    let Some(exe) = backend_exe() else {
        supervisor_log("local-api executable not found next to the app");
        return;
    };
    let backend = backend.clone();
    std::thread::spawn(move || {
        kill_orphaned_engine();
        let secret_key = crate::secret_key::engine_key_hex().unwrap_or_else(|| {
            supervisor_log("Could not unlock the credential key: broker credentials will be stored unencrypted");
            String::new()
        });
        supervise(backend, exe, secret_key)
    });
}
