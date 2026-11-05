/**
 * 牛马鼓励器 —— Rust 侧
 * 只负责三件事：系统托盘、窗口控制（关闭=隐藏到托盘）、事件桥接
 * 业务计算全部在前端完成
 */
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 本地持久化存储插件（tauri-plugin-store）
        .plugin(tauri_plugin_store::Builder::new().build())
        // 开机自启插件（tauri-plugin-autostart）
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // ===== 托盘右键菜单：显示窗口 / 隐藏窗口 / 打开设置 / 取消鼠标穿透 / 退出 =====
            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "打开设置", true, None::<&str>)?;
            let stop_ct =
                MenuItem::with_id(app, "stop_ct", "取消鼠标穿透", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &settings, &stop_ct, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("牛马鼓励器")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let win = app.get_webview_window("main");
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = &win {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(w) = &win {
                                let _ = w.hide();
                            }
                        }
                        "settings" => {
                            if let Some(w) = &win {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                            let _ = app.emit("open-settings", ());
                        }
                        // 鼠标穿透后窗口点不了，托盘是唯一恢复入口
                        "stop_ct" => {
                            if let Some(w) = &win {
                                let _ = w.set_ignore_cursor_events(false);
                            }
                            let _ = app.emit("click-through-changed", false);
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击托盘：唤起窗口
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        // 点关闭按钮 = 隐藏到托盘，不真正退出（退出走托盘菜单）
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running 牛马鼓励器");
}
