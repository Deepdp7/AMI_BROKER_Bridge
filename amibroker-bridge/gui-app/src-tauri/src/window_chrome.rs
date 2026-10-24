//! Native Windows behaviour for the frameless window.
//!
//! The window runs with `decorations: false` so the app can draw its own title bar, but
//! that normally costs the maximize-button behaviour Windows 11 users expect: the Snap
//! Layouts flyout only appears while the OS hit-test reports the cursor over a real
//! maximize button (HTMAXBUTTON). Ours is drawn inside the webview, so the OS never sees it.
//!
//! This subclasses the window proc: the page reports where it painted the maximize button,
//! we answer HTMAXBUTTON for that rect, and turn the resulting non-client clicks back into
//! a maximize toggle plus hover events the page can style against (once the OS owns the
//! cursor over that button the webview no longer gets mouse events there).

use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};

use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::ScreenToClient;
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    HTCLIENT, HTMAXBUTTON, WM_NCHITTEST, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP, WM_NCMOUSELEAVE,
};

/// Maximize-button rect in physical pixels, relative to the client area.
/// Written by the page, read on the UI thread inside the window proc, hence atomics.
static BTN_LEFT: AtomicI32 = AtomicI32::new(0);
static BTN_TOP: AtomicI32 = AtomicI32::new(0);
static BTN_RIGHT: AtomicI32 = AtomicI32::new(0);
static BTN_BOTTOM: AtomicI32 = AtomicI32::new(0);

/// True while the OS routes the cursor to us as HTMAXBUTTON, so hover changes are emitted
/// once per transition instead of once per mouse move.
static BTN_HOVERED: AtomicBool = AtomicBool::new(false);

const SUBCLASS_ID: usize = 0x4442_5052; // "DBPR"

/// Records where the page painted the maximize button, in physical pixels relative to the
/// client area (CSS pixels times `devicePixelRatio`).
#[tauri::command]
pub fn set_maximize_button_rect(left: i32, top: i32, right: i32, bottom: i32) {
    BTN_LEFT.store(left, Ordering::Relaxed);
    BTN_TOP.store(top, Ordering::Relaxed);
    BTN_RIGHT.store(right, Ordering::Relaxed);
    BTN_BOTTOM.store(bottom, Ordering::Relaxed);
}

fn rect_is_set() -> bool {
    BTN_RIGHT.load(Ordering::Relaxed) > BTN_LEFT.load(Ordering::Relaxed)
        && BTN_BOTTOM.load(Ordering::Relaxed) > BTN_TOP.load(Ordering::Relaxed)
}

fn point_in_button(hwnd: HWND, screen_x: i32, screen_y: i32) -> bool {
    if !rect_is_set() {
        return false;
    }

    let mut pt = POINT { x: screen_x, y: screen_y };
    // SAFETY: `hwnd` is the live window we subclassed and `pt` is a valid local.
    unsafe {
        if !ScreenToClient(hwnd, &mut pt).as_bool() {
            return false;
        }
    }

    pt.x >= BTN_LEFT.load(Ordering::Relaxed)
        && pt.x < BTN_RIGHT.load(Ordering::Relaxed)
        && pt.y >= BTN_TOP.load(Ordering::Relaxed)
        && pt.y < BTN_BOTTOM.load(Ordering::Relaxed)
}

/// Tells the page to paint (or clear) the maximize button's hover state, which it can no
/// longer derive from CSS `:hover`.
fn set_hover(window: &WebviewWindow, hovered: bool) {
    if BTN_HOVERED.swap(hovered, Ordering::Relaxed) == hovered {
        return;
    }
    let _ = window.emit("titlebar://maximize-hover", hovered);
}

unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    data: usize,
) -> LRESULT {
    // `data` is the leaked WebviewWindow handed to SetWindowSubclass below; it lives for the
    // lifetime of the process.
    let window = &*(data as *const WebviewWindow);

    match msg {
        WM_NCHITTEST => {
            // Let tao hit-test first so the resize borders keep winning over the button in
            // the window's corner.
            let hit = DefSubclassProc(hwnd, msg, wparam, lparam);
            if hit.0 != HTCLIENT as isize {
                set_hover(window, false);
                return hit;
            }

            let x = (lparam.0 & 0xFFFF) as i16 as i32;
            let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;

            if point_in_button(hwnd, x, y) {
                set_hover(window, true);
                return LRESULT(HTMAXBUTTON as isize);
            }

            set_hover(window, false);
            hit
        }

        // Swallow the press so DefWindowProc does not start its own caption-button loop;
        // act on release, like a real caption button.
        WM_NCLBUTTONDOWN if wparam.0 == HTMAXBUTTON as usize => LRESULT(0),

        WM_NCLBUTTONUP if wparam.0 == HTMAXBUTTON as usize => {
            if let Ok(true) = window.is_maximized() {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
            LRESULT(0)
        }

        WM_NCMOUSELEAVE => {
            set_hover(window, false);
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }

        _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
}

/// Installs the Snap Layouts hit-test hook on `window`.
pub fn install(window: &WebviewWindow) {
    let hwnd = match window.hwnd() {
        Ok(hwnd) => hwnd,
        Err(err) => {
            log::warn!("snap layouts: could not get HWND: {err}");
            return;
        }
    };

    // Leaked on purpose: the window proc needs it for as long as the window exists, which is
    // as long as the process does.
    let boxed = Box::into_raw(Box::new(window.clone()));

    // SAFETY: `hwnd` is a live top-level window we own and `boxed` outlives it.
    unsafe {
        if !SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, boxed as usize).as_bool() {
            log::warn!("snap layouts: SetWindowSubclass failed");
            // Reclaim the allocation the proc will never see.
            drop(Box::from_raw(boxed));
        }
    }
}
