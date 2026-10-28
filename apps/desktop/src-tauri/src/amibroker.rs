//! Finding and opening AmiBroker.
//!
//! The first look finds AmiBroker wherever it is, and the place is remembered
//! (%APPDATA%\DataBridgePro\amibroker_path.txt), so every later "Open AmiBroker" starts it at once.
//! Places, quickest first:
//!   1. the remembered place, then the folder set in Settings
//!   2. a running AmiBroker (its own file path)
//!   3. what Windows recorded: every installed-programs entry named AmiBroker, App Paths\Broker.exe
//!   4. the usual folders on every local drive (Program Files, "AmiBroker*" folders, X:\AmiBroker)
//!   5. a search of the local drives, a few folders deep, for at most ~20 seconds
//! Only a Broker.exe with AmiBroker's own folders beside it counts (other programs ship a
//! "broker.exe" too). The DataBridge plugin is 32-bit, so a copy whose Plugins folder holds
//! DataBridgePro.dll wins over one without it.
//!
//! An AmiBroker that is already open is brought to the front instead of started again.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde::Serialize;

const AMIBROKER_EXE: &str = "Broker.exe";
const PLUGIN_DLL: &str = "DataBridgePro.dll";
const DEEP_SEARCH_BUDGET: Duration = Duration::from_secs(20);
const DEEP_SEARCH_DEPTH: usize = 5;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AmiBrokerResult {
    /// What happened, in plain words
    pub message: String,
    /// Where AmiBroker is (Broker.exe)
    pub path: Option<String>,
    /// It was open already and was brought to the front
    pub already_open: bool,
    /// The DataBridge plugin is installed in that copy
    pub plugin_installed: bool,
}

// ===== What counts as AmiBroker =====

/// `hint` may be the AmiBroker folder or Broker.exe itself
fn exe_in(hint: &Path) -> Option<PathBuf> {
    let candidate = if hint.file_name().map_or(false, |n| n.to_string_lossy().eq_ignore_ascii_case(AMIBROKER_EXE)) {
        hint.to_path_buf()
    } else {
        hint.join(AMIBROKER_EXE)
    };
    candidate.is_file().then_some(candidate)
}

/// A Broker.exe that is AmiBroker: its folder has AmiBroker's Formulas or Plugins folder, or
/// is named after it
fn looks_like_amibroker(exe: &Path) -> bool {
    let Some(dir) = exe.parent() else { return false };
    dir.join("Formulas").is_dir()
        || dir.join("Plugins").is_dir()
        || dir.file_name().map_or(false, |n| n.to_string_lossy().to_ascii_lowercase().contains("amibroker"))
}

fn has_plugin(exe: &Path) -> bool {
    exe.parent().map_or(false, |d| d.join("Plugins").join(PLUGIN_DLL).is_file())
}

/// Picks from candidates: ones with the plugin first, in the order they were found
fn best(candidates: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    let found: Vec<PathBuf> = candidates.into_iter().filter(|p| looks_like_amibroker(p)).collect();
    found.iter().find(|p| has_plugin(p)).or_else(|| found.first()).cloned()
}

// ===== The remembered place =====

fn memory_file() -> Option<PathBuf> {
    std::env::var("APPDATA").ok().map(|d| Path::new(&d).join("DataBridgePro").join("amibroker_path.txt"))
}

fn remembered() -> Option<PathBuf> {
    let text = std::fs::read_to_string(memory_file()?).ok()?;
    exe_in(Path::new(text.trim())).filter(|p| looks_like_amibroker(p))
}

fn remember(exe: &Path) {
    if let Some(file) = memory_file() {
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(file, exe.to_string_lossy().as_bytes());
    }
}

// ===== Windows: registry, processes, windows, drives =====

#[cfg(windows)]
mod win {
    use std::path::PathBuf;
    use windows::core::{BOOL, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, ERROR_SUCCESS, HWND, LPARAM};
    use windows::Win32::Storage::FileSystem::GetDriveTypeW;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ,
        KEY_WOW64_32KEY, KEY_WOW64_64KEY, RRF_RT_REG_SZ,
    };
    use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindow, GetWindowThreadProcessId, IsIconic, IsWindowVisible, SetForegroundWindow, ShowWindow, GW_OWNER, SW_RESTORE,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn read_value(key: HKEY, value: &str) -> Option<String> {
        let v = wide(value);
        let mut size: u32 = 0;
        unsafe {
            if RegGetValueW(key, PCWSTR::null(), PCWSTR(v.as_ptr()), RRF_RT_REG_SZ, None, None, Some(&mut size)) != ERROR_SUCCESS || size == 0 {
                return None;
            }
            let mut buf = vec![0u16; (size as usize + 1) / 2];
            if RegGetValueW(key, PCWSTR::null(), PCWSTR(v.as_ptr()), RRF_RT_REG_SZ, None, Some(buf.as_mut_ptr() as *mut _), Some(&mut size)) != ERROR_SUCCESS {
                return None;
            }
            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            Some(String::from_utf16_lossy(&buf[..len]))
        }
    }

    fn open(root: HKEY, path: &str, view: u32) -> Option<HKEY> {
        let p = wide(path);
        let mut key = HKEY::default();
        let access = windows::Win32::System::Registry::REG_SAM_FLAGS(KEY_READ.0 | view);
        unsafe { (RegOpenKeyExW(root, PCWSTR(p.as_ptr()), Some(0), access, &mut key) == ERROR_SUCCESS).then_some(key) }
    }

    /// Install folders / exe paths Windows recorded for AmiBroker
    pub fn registry_places() -> Vec<PathBuf> {
        let mut out = Vec::new();
        const UNINSTALL: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
        for (root, view) in [(HKEY_LOCAL_MACHINE, KEY_WOW64_64KEY.0), (HKEY_LOCAL_MACHINE, KEY_WOW64_32KEY.0), (HKEY_CURRENT_USER, 0)] {
            let Some(list) = open(root, UNINSTALL, view) else { continue };
            let mut index = 0u32;
            loop {
                let mut name = [0u16; 256];
                let mut len = name.len() as u32;
                let r = unsafe { RegEnumKeyExW(list, index, Some(PWSTR(name.as_mut_ptr())), &mut len, None, None, None, None) };
                if r != ERROR_SUCCESS { break }
                index += 1;
                let sub = String::from_utf16_lossy(&name[..len as usize]);
                if let Some(key) = open(list, &sub, view) {
                    let display = read_value(key, "DisplayName").unwrap_or_default();
                    if display.to_ascii_lowercase().contains("amibroker") || sub.to_ascii_lowercase().contains("amibroker") {
                        if let Some(dir) = read_value(key, "InstallLocation") { out.push(PathBuf::from(dir)); }
                        if let Some(icon) = read_value(key, "DisplayIcon") {
                            // "C:\…\Broker.exe,0"
                            let icon = icon.trim_matches('"');
                            out.push(PathBuf::from(icon.split(',').next().unwrap_or(icon)));
                        }
                    }
                    unsafe { let _ = RegCloseKey(key); }
                }
            }
            unsafe { let _ = RegCloseKey(list); }
        }
        // App Paths\Broker.exe (default value is the exe)
        for view in [KEY_WOW64_64KEY.0, KEY_WOW64_32KEY.0] {
            if let Some(key) = open(HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\App Paths\Broker.exe", view) {
                if let Some(exe) = read_value(key, "") { out.push(PathBuf::from(exe.trim_matches('"'))); }
                unsafe { let _ = RegCloseKey(key); }
            }
        }
        out
    }

    /// Process ids of running Broker.exe
    pub fn amibroker_pids() -> Vec<u32> {
        let mut pids = Vec::new();
        unsafe {
            let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else { return pids };
            let mut entry = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
            let mut ok = Process32FirstW(snap, &mut entry).is_ok();
            while ok {
                let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                if String::from_utf16_lossy(&entry.szExeFile[..len]).eq_ignore_ascii_case(super::AMIBROKER_EXE) {
                    pids.push(entry.th32ProcessID);
                }
                ok = Process32NextW(snap, &mut entry).is_ok();
            }
            let _ = CloseHandle(snap);
        }
        pids
    }

    /// The file a running process was started from
    pub fn process_path(pid: u32) -> Option<PathBuf> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
            let _ = CloseHandle(handle);
            ok.then(|| PathBuf::from(String::from_utf16_lossy(&buf[..len as usize])))
        }
    }

    struct Search { pids: Vec<u32>, found: Option<HWND> }

    unsafe extern "system" fn each_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam.0 as *mut Search);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        // The main window: visible, top-level, not owned by another window
        if search.pids.contains(&pid) && IsWindowVisible(hwnd).as_bool() && GetWindow(hwnd, GW_OWNER).map_or(true, |o| o.0.is_null()) {
            search.found = Some(hwnd);
            return BOOL(0);
        }
        BOOL(1)
    }

    /// Restores (if minimised) and focuses AmiBroker's main window. False if it has none yet.
    pub fn bring_to_front(pids: &[u32]) -> bool {
        let mut search = Search { pids: pids.to_vec(), found: None };
        unsafe {
            let _ = EnumWindows(Some(each_window), LPARAM(&mut search as *mut Search as isize));
            let Some(hwnd) = search.found else { return false };
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            let _ = SetForegroundWindow(hwnd);
        }
        true
    }

    /// Local hard drives ("C:\", "D:\"…); network, removable and CD drives are skipped
    pub fn fixed_drives() -> Vec<PathBuf> {
        const DRIVE_FIXED: u32 = 3;
        (b'C'..=b'Z')
            .map(|c| format!("{}:\\", c as char))
            .filter(|d| unsafe { GetDriveTypeW(PCWSTR(wide(d).as_ptr())) } == DRIVE_FIXED)
            .map(PathBuf::from)
            .collect()
    }
}

// ===== Looking =====

/// The usual folders on every local drive
fn usual_places() -> Vec<PathBuf> {
    let mut places = Vec::new();
    for var in ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Ok(dir) = std::env::var(var) {
            places.push(Path::new(&dir).join("AmiBroker"));
        }
    }
    #[cfg(windows)]
    let drives = win::fixed_drives();
    #[cfg(not(windows))]
    let drives: Vec<PathBuf> = Vec::new();
    for drive in drives {
        places.push(drive.join("AmiBroker"));
        for parent in [drive.clone(), drive.join("Program Files"), drive.join("Program Files (x86)")] {
            // "AmiBroker", "AmiBroker 6.9", "AmiBroker64"…
            if let Ok(entries) = std::fs::read_dir(&parent) {
                for e in entries.flatten() {
                    if e.file_name().to_string_lossy().to_ascii_lowercase().starts_with("amibroker") {
                        places.push(e.path());
                    }
                }
            }
        }
    }
    places
}

const SKIP_DIRS: &[&str] = &["windows", "$recycle.bin", "system volume information", "node_modules", ".git", "winsxs", "temp", "cache", "programdata\\microsoft"];

/// Breadth-first search of the local drives for an AmiBroker Broker.exe, within a time budget
fn deep_search(budget: Duration) -> Option<PathBuf> {
    let started = Instant::now();
    #[cfg(windows)]
    let roots = win::fixed_drives();
    #[cfg(not(windows))]
    let roots: Vec<PathBuf> = Vec::new();
    let mut level: Vec<PathBuf> = roots;
    let mut found = Vec::new();
    for _depth in 0..DEEP_SEARCH_DEPTH {
        let mut next = Vec::new();
        for dir in level {
            if started.elapsed() > budget { return best(found) }
            let Ok(entries) = std::fs::read_dir(&dir) else { continue };
            for e in entries.flatten() {
                let Ok(kind) = e.file_type() else { continue };
                let path = e.path();
                if kind.is_file() {
                    if e.file_name().to_string_lossy().eq_ignore_ascii_case(AMIBROKER_EXE) { found.push(path) }
                } else if kind.is_dir() && !kind.is_symlink() {
                    let lower = path.to_string_lossy().to_ascii_lowercase();
                    if !SKIP_DIRS.iter().any(|s| lower.ends_with(s)) { next.push(path) }
                }
            }
        }
        if found.iter().any(|p| looks_like_amibroker(p)) { break }
        level = next;
    }
    best(found)
}

/// Where AmiBroker is. `hint` is the folder from Settings. `deep` allows the drive search.
pub fn locate(hint: Option<&str>, deep: bool) -> Option<PathBuf> {
    if let Some(p) = remembered() { return Some(p) }

    let mut quick: Vec<PathBuf> = Vec::new();
    if let Some(h) = hint.map(str::trim).filter(|h| !h.is_empty()) {
        if let Some(exe) = exe_in(Path::new(h)) { quick.push(exe) }
    }
    #[cfg(windows)]
    {
        quick.extend(win::amibroker_pids().into_iter().filter_map(win::process_path));
        quick.extend(win::registry_places().iter().filter_map(|p| exe_in(p)));
    }
    quick.extend(usual_places().iter().filter_map(|p| exe_in(p)));

    let found = best(quick).or_else(|| if deep { deep_search(DEEP_SEARCH_BUDGET) } else { None })?;
    remember(&found);
    Some(found)
}

fn amibroker_running() -> Vec<u32> {
    #[cfg(windows)]
    return win::amibroker_pids();
    #[cfg(not(windows))]
    Vec::new()
}

/// Opens AmiBroker, or brings it to the front when it is open already
pub fn open(hint: Option<&str>) -> Result<AmiBrokerResult, String> {
    let pids = amibroker_running();
    if !pids.is_empty() {
        #[cfg(windows)]
        let shown = win::bring_to_front(&pids);
        #[cfg(not(windows))]
        let shown = false;
        // Learn where the running copy lives, for next time
        #[cfg(windows)]
        let path = pids.iter().find_map(|&p| win::process_path(p)).filter(|p| looks_like_amibroker(p));
        #[cfg(not(windows))]
        let path: Option<PathBuf> = None;
        if let Some(p) = &path { remember(p) }
        return Ok(AmiBrokerResult {
            message: if shown { "AmiBroker is open (brought to the front)".into() } else { "AmiBroker is already starting".into() },
            plugin_installed: path.as_deref().map_or(false, has_plugin),
            path: path.map(|p| p.to_string_lossy().into_owned()),
            already_open: true,
        });
    }
    let exe = locate(hint, true).ok_or_else(|| {
        "AmiBroker was not found on this PC. Install AmiBroker, or choose its folder in Settings → AmiBroker path & launch.".to_string()
    })?;
    let mut cmd = std::process::Command::new(&exe);
    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }
    cmd.spawn().map_err(|e| format!("AmiBroker could not be started: {e}"))?;
    crate::engine::supervisor_log(&format!("Started AmiBroker ({})", exe.display()));
    Ok(AmiBrokerResult {
        message: format!("Started AmiBroker from {}", exe.display()),
        plugin_installed: has_plugin(&exe),
        path: Some(exe.to_string_lossy().into_owned()),
        already_open: false,
    })
}

// ===== Commands =====

/// Opens AmiBroker (finds it the first time), or brings the open one to the front
#[tauri::command]
pub async fn start_amibroker(path: Option<String>) -> Result<AmiBrokerResult, String> {
    // The first search may read the disks for a while: off the UI thread
    tauri::async_runtime::spawn_blocking(move || open(path.as_deref()))
        .await
        .map_err(|e| format!("AmiBroker could not be started: {e}"))?
}

/// Where AmiBroker is, without opening it (Settings "Find" and the first start)
#[tauri::command]
pub async fn locate_amibroker(path: Option<String>, deep: Option<bool>) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || locate(path.as_deref(), deep.unwrap_or(true)).map(|p| p.to_string_lossy().into_owned()))
        .await
        .ok()
        .flatten()
}

/// Called once at startup: finds AmiBroker in the background, so the first click is instant
pub fn warm_up() {
    std::thread::spawn(|| {
        if remembered().is_none() {
            if let Some(p) = locate(None, true) {
                crate::engine::supervisor_log(&format!("Found AmiBroker at {}", p.display()));
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fake_install(name: &str, with_plugin: bool) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dbp-ab-{}-{}", name, std::process::id()));
        std::fs::create_dir_all(dir.join("Formulas")).unwrap();
        std::fs::create_dir_all(dir.join("Plugins")).unwrap();
        if with_plugin {
            std::fs::write(dir.join("Plugins").join(PLUGIN_DLL), b"").unwrap();
        }
        std::fs::write(dir.join(AMIBROKER_EXE), b"").unwrap();
        dir
    }

    #[test]
    fn finds_amibroker_from_a_folder_or_the_exe() {
        let dir = fake_install("plain", false);
        let exe = dir.join(AMIBROKER_EXE);
        assert_eq!(exe_in(&dir), Some(exe.clone()));
        assert_eq!(exe_in(&exe), Some(exe.clone()));
        assert!(looks_like_amibroker(&exe));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn another_programs_broker_exe_does_not_count() {
        let dir = std::env::temp_dir().join(format!("dbp-other-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(AMIBROKER_EXE), b"").unwrap();
        assert!(!looks_like_amibroker(&dir.join(AMIBROKER_EXE)));
        assert_eq!(best([dir.join(AMIBROKER_EXE)]), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// The real search on this PC (run with --ignored); remembers into a temp folder, not the real profile
    #[test]
    #[ignore]
    fn locate_on_this_pc() {
        let tmp = std::env::temp_dir().join(format!("dbp-ab-appdata-{}", std::process::id()));
        std::env::set_var("APPDATA", &tmp);
        let t = Instant::now();
        let quick = locate(None, false);
        println!("quick search: {:?} in {:?}", quick, t.elapsed());
        let t = Instant::now();
        let again = locate(None, false);
        println!("remembered:   {:?} in {:?}", again, t.elapsed());
        assert_eq!(quick, again);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    /// The last-resort drive search alone on this PC (run with --ignored)
    #[test]
    #[ignore]
    fn deep_search_on_this_pc() {
        let t = Instant::now();
        let found = deep_search(DEEP_SEARCH_BUDGET);
        println!("drive search: {:?} in {:?}", found, t.elapsed());
        assert!(t.elapsed() < DEEP_SEARCH_BUDGET + Duration::from_secs(2));
    }

    #[test]
    fn the_copy_with_the_databridge_plugin_wins() {
        let a = fake_install("a64", false);
        let b = fake_install("b32", true);
        assert_eq!(best([a.join(AMIBROKER_EXE), b.join(AMIBROKER_EXE)]), Some(b.join(AMIBROKER_EXE)));
        std::fs::remove_dir_all(&a).unwrap();
        std::fs::remove_dir_all(&b).unwrap();
    }
}
