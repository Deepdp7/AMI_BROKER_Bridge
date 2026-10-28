//! "Start with Windows" from Settings (finding and opening AmiBroker is in amibroker.rs).
//!
//! Start with Windows is a Run entry for the current user (no admin rights needed) that starts
//! the app with `--autostart`: the data engine and tray icon come up, the window stays hidden
//! until the tray icon or the desktop shortcut is used. The switch in Settings shows whether the
//! entry is really there, not just what was saved.

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE: &str = "DataBridge Pro";
/// Given by the Run entry: start in the tray, window hidden
pub const AUTOSTART_ARG: &str = "--autostart";

/// True when this start came from the Windows Run entry
pub fn launched_at_login() -> bool {
    std::env::args().any(|a| a == AUTOSTART_ARG)
}

#[cfg(windows)]
mod reg {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    pub use windows::Win32::System::Registry::{
        RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW, HKEY, HKEY_CURRENT_USER, REG_ROUTINE_FLAGS,
        REG_SZ, RRF_RT_REG_SZ,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn read_string(root: HKEY, subkey: &str, value: &str, view: REG_ROUTINE_FLAGS) -> Option<String> {
        let (k, v) = (wide(subkey), wide(value));
        let flags = REG_ROUTINE_FLAGS(RRF_RT_REG_SZ.0 | view.0);
        let mut size: u32 = 0;
        unsafe {
            if RegGetValueW(root, PCWSTR(k.as_ptr()), PCWSTR(v.as_ptr()), flags, None, None, Some(&mut size)) != ERROR_SUCCESS || size == 0 {
                return None;
            }
            let mut buf = vec![0u16; (size as usize + 1) / 2];
            if RegGetValueW(root, PCWSTR(k.as_ptr()), PCWSTR(v.as_ptr()), flags, None, Some(buf.as_mut_ptr() as *mut _), Some(&mut size)) != ERROR_SUCCESS {
                return None;
            }
            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            Some(String::from_utf16_lossy(&buf[..len]))
        }
    }

    pub fn write_string(root: HKEY, subkey: &str, value: &str, data: &str) -> bool {
        let (k, v, d) = (wide(subkey), wide(value), wide(data));
        unsafe {
            RegSetKeyValueW(root, PCWSTR(k.as_ptr()), PCWSTR(v.as_ptr()), REG_SZ.0, Some(d.as_ptr() as *const _), (d.len() * 2) as u32) == ERROR_SUCCESS
        }
    }

    pub fn delete_value(root: HKEY, subkey: &str, value: &str) -> bool {
        let (k, v) = (wide(subkey), wide(value));
        let r = unsafe { RegDeleteKeyValueW(root, PCWSTR(k.as_ptr()), PCWSTR(v.as_ptr())) };
        r == ERROR_SUCCESS || r == ERROR_FILE_NOT_FOUND
    }
}

// ===== Start with Windows =====

fn autostart_command() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| format!("Could not find the app's own file: {e}"))?;
    Ok(format!("\"{}\" {}", exe.display(), AUTOSTART_ARG))
}

#[cfg(windows)]
fn read_run_entry(value: &str) -> Option<String> {
    reg::read_string(reg::HKEY_CURRENT_USER, RUN_KEY, value, reg::REG_ROUTINE_FLAGS(0))
}

/// The Run entry exists and starts this copy of the app (an entry of an older, moved install doesn't count)
#[cfg(windows)]
fn autostart_enabled_for(value: &str) -> bool {
    match (read_run_entry(value), autostart_command()) {
        (Some(entry), Ok(cmd)) => entry.eq_ignore_ascii_case(&cmd),
        _ => false,
    }
}

#[cfg(windows)]
fn set_autostart_for(value: &str, enabled: bool) -> Result<(), String> {
    if enabled {
        let cmd = autostart_command()?;
        if !reg::write_string(reg::HKEY_CURRENT_USER, RUN_KEY, value, &cmd) {
            return Err("Windows did not accept the startup entry".into());
        }
    } else if !reg::delete_value(reg::HKEY_CURRENT_USER, RUN_KEY, value) {
        return Err("Windows did not let the startup entry be removed".into());
    }
    Ok(())
}

#[tauri::command]
pub fn get_autostart() -> bool {
    #[cfg(windows)]
    return autostart_enabled_for(RUN_VALUE);
    #[cfg(not(windows))]
    false
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        set_autostart_for(RUN_VALUE, enabled)?;
        crate::engine::supervisor_log(if enabled { "Start with Windows turned on" } else { "Start with Windows turned off" });
        return Ok(autostart_enabled_for(RUN_VALUE));
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("Only available on Windows".into())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn startup_entry_round_trip() {
        // A test-only value name: the real "DataBridge Pro" entry is never touched
        let name = format!("DataBridge Pro test {}", std::process::id());
        assert!(!autostart_enabled_for(&name));
        set_autostart_for(&name, true).unwrap();
        assert!(autostart_enabled_for(&name));
        let entry = read_run_entry(&name).unwrap();
        assert!(entry.starts_with('"') && entry.ends_with(AUTOSTART_ARG), "entry: {entry}");
        set_autostart_for(&name, false).unwrap();
        assert!(!autostart_enabled_for(&name));
        assert!(read_run_entry(&name).is_none());
        set_autostart_for(&name, false).unwrap(); // removing what isn't there is fine
    }

    #[test]
    fn an_entry_for_another_copy_does_not_count() {
        let name = format!("DataBridge Pro test other {}", std::process::id());
        assert!(reg::write_string(reg::HKEY_CURRENT_USER, RUN_KEY, &name, r#""C:\Old\DataBridge Pro.exe" --autostart"#));
        assert!(!autostart_enabled_for(&name));
        assert!(reg::delete_value(reg::HKEY_CURRENT_USER, RUN_KEY, &name));
    }
}
