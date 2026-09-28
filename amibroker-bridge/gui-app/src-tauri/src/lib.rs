#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }



      if !cfg!(debug_assertions) {
          use std::process::Command;
          #[cfg(windows)]
          use std::os::windows::process::CommandExt;
          #[cfg(windows)]
          const CREATE_NEW_CONSOLE: u32 = 0x00000010;

          let exe_dir = std::env::current_exe().unwrap().parent().unwrap().to_path_buf();
          let mut api_exe = exe_dir.join("local-api.exe");
          if !api_exe.exists() {
              api_exe = exe_dir.join("local-api-x86_64-pc-windows-msvc.exe");
          }

          if api_exe.exists() {
              #[cfg(windows)]
              {
                  // Aggressively kill any orphaned sidecars from previous runs/crashes before spawning
                  let _ = std::process::Command::new("taskkill").args(&["/F", "/IM", "local-api.exe", "/T"]).output();
                  let _ = std::process::Command::new("taskkill").args(&["/F", "/IM", "local-api-x86_64-pc-windows-msvc.exe", "/T"]).output();
              }

              #[cfg(windows)]
              let mut cmd = Command::new(&api_exe);
              #[cfg(windows)]
              cmd.creation_flags(CREATE_NEW_CONSOLE);
              
              #[cfg(not(windows))]
              let mut cmd = Command::new(api_exe);

              if let Ok(mut child) = cmd.spawn() {
                  println!("Successfully spawned local-api terminal!");
                  // Watch the terminal. If it closes, kill the app.
                  std::thread::spawn(move || {
                      let _ = child.wait();
                      std::process::exit(0);
                  });
              } else {
                  println!("Failed to spawn local-api terminal");
              }
          }
      }

      use tauri::{
          menu::{Menu, MenuItem},
          tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
          Manager
      };

      let quit_i = MenuItem::with_id(app, "quit", "Quit DataBridge", true, None::<&str>)?;
      let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

      let _tray = TrayIconBuilder::new()
          .icon(app.default_window_icon().unwrap().clone())
          .menu(&menu)
          .on_menu_event(|app, event| match event.id.as_ref() {
              "quit" => {
                  // Ensure terminal is killed when app is quit
                  let _ = std::process::Command::new("taskkill").args(&["/F", "/IM", "local-api.exe", "/T"]).output();
                  let _ = std::process::Command::new("taskkill").args(&["/F", "/IM", "local-api-x86_64-pc-windows-msvc.exe", "/T"]).output();
                  std::process::exit(0);
              }
              "show" => {
                  if let Some(window) = app.get_webview_window("main") {
                      let _ = window.show();
                      let _ = window.set_focus();
                  }
              }
              _ => {}
          })
          .on_tray_icon_event(|tray, event| match event {
              TrayIconEvent::Click {
                  button: MouseButton::Left,
                  button_state: MouseButtonState::Up,
                  ..
              } => {
                  if let Some(window) = tray.app_handle().get_webview_window("main") {
                      let _ = window.show();
                      let _ = window.set_focus();
                  }
              }
              _ => {}
          })
          .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            window.hide().unwrap();
            api.prevent_close();
        }
        _ => {}
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
