//! The key the data engine encrypts broker credentials with (see apps/server/src/lib/secretBox.ts).
//!
//! 32 random bytes in %APPDATA%\DataBridgePro\secret.key, locked with Windows DPAPI for the
//! current user, so the file can't be opened on another PC or Windows account. Unlocked here
//! natively and handed to the engine as DATABRIDGE_SECRET_KEY (hex) when it starts.

use std::path::PathBuf;

/// Must match the engine's DPAPI_ENTROPY
const ENTROPY: &[u8] = b"DataBridgePro secret key v1";
const KEY_LEN: usize = 32;

fn key_file() -> Option<PathBuf> {
    let appdata = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(appdata).join("DataBridgePro").join("secret.key"))
}

/// The key as hex, creating it on first use. None when DPAPI isn't available; the engine then
/// stores credentials unencrypted, as older versions did.
pub(crate) fn engine_key_hex() -> Option<String> {
    let file = key_file()?;
    if let Ok(locked) = std::fs::read(&file) {
        match dpapi::unprotect(&locked, ENTROPY) {
            Some(key) if key.len() == KEY_LEN => return Some(hex(&key)),
            _ => {
                // Made on another PC or account (e.g. a copied profile): keep it aside, start a
                // new key. Credentials sealed with the old one need a new login.
                let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
                let _ = std::fs::rename(&file, file.with_extension(format!("key.unreadable-{stamp}")));
                crate::engine::supervisor_log("secret.key could not be unlocked on this account: made a new one (broker logins may be needed again)");
            }
        }
    }
    let key = dpapi::random(KEY_LEN)?;
    let locked = dpapi::protect(&key, ENTROPY)?;
    std::fs::create_dir_all(file.parent()?).ok()?;
    std::fs::write(&file, locked).ok()?;
    Some(hex(&key))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(windows)]
mod dpapi {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{
        BCryptGenRandom, CryptProtectData, CryptUnprotectData, BCRYPT_USE_SYSTEM_PREFERRED_RNG, CRYPTPROTECT_UI_FORBIDDEN,
        CRYPT_INTEGER_BLOB,
    };

    fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 }
    }

    /// Copies DPAPI's output and frees it
    unsafe fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(out.pbData as _)));
        v
    }

    pub(super) fn protect(data: &[u8], entropy: &[u8]) -> Option<Vec<u8>> {
        let (input, extra) = (blob(data), blob(entropy));
        let mut out = CRYPT_INTEGER_BLOB::default();
        unsafe {
            CryptProtectData(&input, None, Some(&extra), None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out).ok()?;
            Some(take(out))
        }
    }

    pub(super) fn unprotect(data: &[u8], entropy: &[u8]) -> Option<Vec<u8>> {
        let (input, extra) = (blob(data), blob(entropy));
        let mut out = CRYPT_INTEGER_BLOB::default();
        unsafe {
            CryptUnprotectData(&input, None, Some(&extra), None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out).ok()?;
            Some(take(out))
        }
    }

    pub(super) fn random(len: usize) -> Option<Vec<u8>> {
        let mut buf = vec![0u8; len];
        unsafe { BCryptGenRandom(None, &mut buf, BCRYPT_USE_SYSTEM_PREFERRED_RNG).ok().ok()? };
        Some(buf)
    }
}

#[cfg(not(windows))]
mod dpapi {
    pub(super) fn protect(_: &[u8], _: &[u8]) -> Option<Vec<u8>> {
        None
    }
    pub(super) fn unprotect(_: &[u8], _: &[u8]) -> Option<Vec<u8>> {
        None
    }
    pub(super) fn random(_: usize) -> Option<Vec<u8>> {
        None
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn dpapi_round_trip_and_entropy_matters() {
        let key = dpapi::random(KEY_LEN).unwrap();
        assert_eq!(key.len(), KEY_LEN);
        let locked = dpapi::protect(&key, ENTROPY).unwrap();
        assert_ne!(locked, key);
        assert_eq!(dpapi::unprotect(&locked, ENTROPY).unwrap(), key);
        assert!(dpapi::unprotect(&locked, b"other").is_none());
        assert!(dpapi::unprotect(b"not a dpapi blob", ENTROPY).is_none());
    }

    /// Cross-check with the engine's PowerShell path: DBP_TEST_APPDATA holds a secret.key the
    /// engine made; prints the key this side unlocks, for the engine to decrypt with.
    /// Run with --ignored --nocapture.
    #[test]
    #[ignore]
    fn reads_the_key_the_engine_made() {
        let Ok(dir) = std::env::var("DBP_TEST_APPDATA") else { return };
        unsafe { std::env::set_var("APPDATA", dir) };
        let key = engine_key_hex().unwrap();
        assert_eq!(engine_key_hex().unwrap(), key, "stable across starts");
        println!("KEY={key}");
    }
}
