//! Notification-area icon: Show Dashboard, Open AmiBroker, Restart Data Engine, Quit DataBridge.

use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

use crate::engine::Backend;

pub(crate) fn build(app: &App) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
    let amibroker_i = MenuItem::with_id(app, "amibroker", "Open AmiBroker", true, None::<&str>)?;
    let restart_i = MenuItem::with_id(app, "restart", "Restart Data Engine", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit DataBridge", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &amibroker_i, &restart_i, &quit_i])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("DataBridge Pro")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => crate::quit_app(app),
            "restart" => app.state::<Arc<Backend>>().restart(),
            "show" => crate::show_main_window(app),
            // Uses the remembered place (or finds it); off the UI thread
            "amibroker" => {
                std::thread::spawn(|| {
                    if let Err(e) = crate::amibroker::open(None) {
                        crate::engine::supervisor_log(&format!("Open AmiBroker from the tray: {e}"));
                    }
                });
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
