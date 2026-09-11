use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_dialog::FilePath;
use tauri::webview::WebviewWindowBuilder;
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, State, WebviewUrl, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone)]
struct DragState {
    start_screen_x: f64,
    start_screen_y: f64,
    start_win_x: i32,
    start_win_y: i32,
}

struct AppState {
    drag_states: Mutex<HashMap<String, DragState>>,
    is_quitting: AtomicBool,
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir.join("store.json"))
}

/// Electron 版数据目录（Tauri 迁移后 identifier 不同，需一次性复制）
fn legacy_electron_store_path() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .ok()
            .map(|home| PathBuf::from(home).join("Library/Application Support/plan-desk/store.json"))
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|appdata| PathBuf::from(appdata).join("plan-desk").join("store.json"))
    } else {
        std::env::var("HOME").ok().map(|home| {
            PathBuf::from(home)
                .join(".config")
                .join("plan-desk")
                .join("store.json")
        })
    }
}

fn migrate_legacy_store_if_needed(path: &PathBuf) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }
    let Some(legacy) = legacy_electron_store_path() else {
        return Ok(());
    };
    if !legacy.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&legacy, path).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_store_raw(app: &AppHandle) -> Result<Value, String> {
    let path = store_path(app)?;
    migrate_legacy_store_if_needed(&path)?;
    if !path.exists() {
        let empty = json!({
            "version": 2,
            "projects": [],
            "items": [],
            "widgets": [],
            "prefs": {}
        });
        let text = serde_json::to_string_pretty(&empty).map_err(|e| e.to_string())?;
        fs::write(&path, text).map_err(|e| e.to_string())?;
        return Ok(empty);
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_store_raw(app: &AppHandle, store: &Value) -> Result<(), String> {
    let path = store_path(app)?;
    let text = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

fn is_mac() -> bool {
    cfg!(target_os = "macos")
}

fn is_pet_mode(mode: Option<&str>) -> bool {
    matches!(mode, Some("pet") | Some("pet-stage"))
}

fn pet_min_size() -> (f64, f64) {
    if cfg!(any(target_os = "macos", target_os = "windows")) {
        (128.0, 128.0)
    } else {
        (72.0, 96.0)
    }
}

fn apply_widget_window_policies(win: &WebviewWindow, is_pet: bool) {
    let _ = win.set_skip_taskbar(true);
    let _ = win.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
    if is_pet {
        let _ = win.set_shadow(false);
    }
}

fn load_tray_icon(app: &AppHandle) -> Result<tauri::image::Image<'static>, String> {
    #[cfg(target_os = "windows")]
    if let Ok(dir) = app.path().resource_dir() {
        let path = dir.join("trayTemplate.png");
        if path.exists() {
            if let Ok(icon) = tauri::image::Image::from_path(path) {
                return Ok(icon.to_owned());
            }
        }
    }

    app.default_window_icon()
        .cloned()
        .map(|icon| icon.to_owned())
        .ok_or_else(|| "missing app icon".to_string())
}

fn widget_label(id: &str) -> String {
    format!("widget-{id}")
}

fn widget_id_from_label(label: &str) -> Option<String> {
    label.strip_prefix("widget-").map(str::to_string)
}

fn current_widget_id(window: &WebviewWindow) -> Option<String> {
    widget_id_from_label(window.label())
}

fn emit_store_updated(app: &AppHandle) {
    let _ = app.emit("store:updated", ());
    let _ = refresh_tray_menu(app);
}

fn active_item_count(store: &Value) -> usize {
    store
        .get("items")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter(|item| !item.get("completed").and_then(|v| v.as_bool()).unwrap_or(false))
                .count()
        })
        .unwrap_or(0)
}

fn sort_items(items: &[Value], completed: bool) -> Vec<Value> {
    let mut filtered: Vec<Value> = items
        .iter()
        .filter(|item| item.get("completed").and_then(|v| v.as_bool()).unwrap_or(false) == completed)
        .cloned()
        .collect();
    filtered.sort_by(|a, b| {
        let a_pinned = a.get("pinned").and_then(|v| v.as_bool()).unwrap_or(false);
        let b_pinned = b.get("pinned").and_then(|v| v.as_bool()).unwrap_or(false);
        if a_pinned != b_pinned {
            return b_pinned.cmp(&a_pinned);
        }
        let ao = a
            .get("sortOrder")
            .and_then(|v| v.as_i64())
            .or_else(|| a.get("createdAt").and_then(|v| v.as_i64()))
            .unwrap_or(0);
        let bo = b
            .get("sortOrder")
            .and_then(|v| v.as_i64())
            .or_else(|| b.get("createdAt").and_then(|v| v.as_i64()))
            .unwrap_or(0);
        if ao != bo {
            return ao.cmp(&bo);
        }
        let au = a.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(0);
        let bu = b.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(0);
        bu.cmp(&au)
    });
    filtered
}

fn toggle_item_completed(app: &AppHandle, item_id: &str, completed: bool) -> Result<(), String> {
    let mut store = read_store_raw(app)?;
    let items = store
        .get_mut("items")
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| "invalid store".to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    for item in items.iter_mut() {
        if item.get("id").and_then(|v| v.as_str()) == Some(item_id) {
            item["completed"] = json!(completed);
            item["updatedAt"] = json!(now);
            item["completedAt"] = json!(if completed { Some(now) } else { None::<i64> });
            break;
        }
    }
    write_store_raw(app, &store)?;
    emit_store_updated(app);
    Ok(())
}

#[cfg(target_os = "windows")]
fn refresh_main_window(win: &WebviewWindow) {
    let _ = win.set_background_color(Some(tauri::window::Color(0x16, 0x14, 0x0f, 0xff)));
    if let Ok(size) = win.inner_size() {
        let w = size.width;
        let h = size.height;
        if w > 2 && h > 2 {
            let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: w.saturating_sub(1),
                height: h,
            }));
            let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: w,
                height: h,
            }));
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        #[cfg(target_os = "windows")]
        refresh_main_window(&win);
        let _ = win.set_focus();
        let _ = win.emit("app:window-shown", ());
    }
}

fn hide_main_window(_app: &AppHandle, win: &WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        let _ = win.minimize();
        return;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = win.hide();
    }
}

fn open_quick_add(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("quick-add") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("app:quick-add-focus", ());
        return;
    }

    let mut builder = WebviewWindowBuilder::new(app, "quick-add", WebviewUrl::App("quick-add.html".into()))
        .title("快速添加")
        .inner_size(420.0, 200.0)
        .min_inner_size(360.0, 180.0)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .background_color(tauri::window::Color(0x1e, 0x1a, 0x14, 0xff));

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    if let Ok(win) = builder.build() {
        let label = win.label().to_string();
        let app_handle = app.clone();
        win.on_window_event(move |event| {
            if let WindowEvent::Focused(false) = event {
                if let Some(w) = app_handle.get_webview_window(&label) {
                    let _ = w.hide();
                }
            }
        });
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn open_settings(app: &AppHandle) {
    show_main_window(app);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit("app:open-settings", ());
    }
}

fn persist_widget_bounds(app: &AppHandle, widget_id: &str, win: &WebviewWindow, is_pet: bool) {
    let Ok(pos) = win.outer_position() else { return };
    let Ok(size) = win.outer_size() else { return };
    let Ok(mut store) = read_store_raw(app) else { return };
    let Some(widgets) = store.get_mut("widgets").and_then(|v| v.as_array_mut()) else {
        return;
    };
    for widget in widgets.iter_mut() {
        if widget.get("id").and_then(|v| v.as_str()) == Some(widget_id) {
            widget["x"] = json!(pos.x);
            widget["y"] = json!(pos.y);
            if !is_pet {
                widget["width"] = json!(size.width);
                widget["height"] = json!(size.height);
            }
            break;
        }
    }
    let _ = write_store_raw(app, &store);
}

fn remove_widget_from_store(app: &AppHandle, widget_id: &str) {
    let Ok(mut store) = read_store_raw(app) else { return };
    let Some(widgets) = store.get_mut("widgets").and_then(|v| v.as_array_mut()) else {
        return;
    };
    let before = widgets.len();
    widgets.retain(|w| w.get("id").and_then(|v| v.as_str()) != Some(widget_id));
    if widgets.len() != before {
        let _ = write_store_raw(app, &store);
        emit_store_updated(app);
    }
}

fn widget_url(id: &str) -> String {
    format!("widget.html?widgetId={id}")
}

fn open_widget_window(app: &AppHandle, config: &Value) -> Result<(), String> {
    let id = config
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "widget id required".to_string())?;
    let label = widget_label(id);

    if let Some(existing) = app.get_webview_window(&label) {
        let display_mode = config.get("displayMode").and_then(|v| v.as_str());
        apply_widget_window_policies(&existing, is_pet_mode(display_mode));
        let _ = existing.show();
        apply_widget_window_policies(&existing, is_pet_mode(display_mode));
        let _ = existing.set_focus();
        return Ok(());
    }

    let x = config.get("x").and_then(|v| v.as_i64()).unwrap_or(100) as f64;
    let y = config.get("y").and_then(|v| v.as_i64()).unwrap_or(100) as f64;
    let width = config.get("width").and_then(|v| v.as_i64()).unwrap_or(260) as f64;
    let height = config.get("height").and_then(|v| v.as_i64()).unwrap_or(280) as f64;
    let display_mode = config.get("displayMode").and_then(|v| v.as_str());
    let is_pet = is_pet_mode(display_mode);

    let mut builder = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App(widget_url(id).into()),
    )
    .title("PlanDesk Widget")
    .position(x, y)
    .inner_size(width, height)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(!is_pet)
    .visible(false)
    .background_color(tauri::window::Color(0, 0, 0, 0));

    if is_pet {
        let (min_w, min_h) = pet_min_size();
        builder = builder.min_inner_size(min_w, min_h).shadow(false);
    } else {
        builder = builder.min_inner_size(240.0, 200.0);
    }

    let win = builder.build().map_err(|e| e.to_string())?;
    apply_widget_window_policies(&win, is_pet);
    let _ = win.set_always_on_top(true);

    #[cfg(target_os = "macos")]
    {
        let _ = win.set_visible_on_all_workspaces(true);
    }

    let app_handle = app.clone();
    let widget_id = id.to_string();
    let is_pet_clone = is_pet;
    win.on_window_event(move |event| match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            if let Some(win) = app_handle.get_webview_window(&widget_label(&widget_id)) {
                persist_widget_bounds(&app_handle, &widget_id, &win, is_pet_clone);
            }
        }
        WindowEvent::Destroyed => {
            remove_widget_from_store(&app_handle, &widget_id);
        }
        _ => {}
    });

    if !is_pet {
        #[cfg(not(target_os = "windows"))]
        {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }

    Ok(())
}

fn open_all_widgets(app: &AppHandle) {
    let Ok(store) = read_store_raw(app) else { return };
    let Some(widgets) = store.get("widgets").and_then(|v| v.as_array()) else {
        return;
    };
    for widget in widgets {
        let _ = open_widget_window(app, widget);
    }
}

fn save_main_window_bounds(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else { return };
    let Ok(pos) = win.outer_position() else { return };
    let Ok(size) = win.outer_size() else { return };
    let Ok(mut store) = read_store_raw(app) else { return };
    if !store.get("prefs").and_then(|v| v.as_object()).is_some() {
        store["prefs"] = json!({});
    }
    let Some(prefs) = store.get_mut("prefs").and_then(|v| v.as_object_mut()) else {
        return;
    };
    prefs.insert(
        "windowBounds".to_string(),
        json!({
            "x": pos.x,
            "y": pos.y,
            "width": size.width,
            "height": size.height
        }),
    );
    let _ = write_store_raw(app, &store);
}

fn restore_main_window_bounds(app: &AppHandle) {
    let Ok(store) = read_store_raw(app) else { return };
    let Some(bounds) = store
        .get("prefs")
        .and_then(|p| p.get("windowBounds"))
        .and_then(|b| b.as_object())
    else {
        return;
    };
    let Some(win) = app.get_webview_window("main") else { return };
    if let (Some(x), Some(y)) = (
        bounds.get("x").and_then(|v| v.as_i64()),
        bounds.get("y").and_then(|v| v.as_i64()),
    ) {
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        }));
    }
    if let (Some(w), Some(h)) = (
        bounds.get("width").and_then(|v| v.as_u64()),
        bounds.get("height").and_then(|v| v.as_u64()),
    ) {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: w as u32,
            height: h as u32,
        }));
    }
}

fn letter_code(c: char) -> Option<Code> {
    match c.to_ascii_uppercase() {
        'A' => Some(Code::KeyA),
        'B' => Some(Code::KeyB),
        'C' => Some(Code::KeyC),
        'D' => Some(Code::KeyD),
        'E' => Some(Code::KeyE),
        'F' => Some(Code::KeyF),
        'G' => Some(Code::KeyG),
        'H' => Some(Code::KeyH),
        'I' => Some(Code::KeyI),
        'J' => Some(Code::KeyJ),
        'K' => Some(Code::KeyK),
        'L' => Some(Code::KeyL),
        'M' => Some(Code::KeyM),
        'N' => Some(Code::KeyN),
        'O' => Some(Code::KeyO),
        'P' => Some(Code::KeyP),
        'Q' => Some(Code::KeyQ),
        'R' => Some(Code::KeyR),
        'S' => Some(Code::KeyS),
        'T' => Some(Code::KeyT),
        'U' => Some(Code::KeyU),
        'V' => Some(Code::KeyV),
        'W' => Some(Code::KeyW),
        'X' => Some(Code::KeyX),
        'Y' => Some(Code::KeyY),
        'Z' => Some(Code::KeyZ),
        _ => None,
    }
}

fn parse_shortcut(accel: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = accel.split('+').map(str::trim).filter(|s| !s.is_empty()).collect();
    if parts.is_empty() {
        return None;
    }
    let key = parts.last()?;
    let mut mods = Modifiers::empty();
    for part in &parts[..parts.len() - 1] {
        match *part {
            "CommandOrControl" | "CmdOrCtrl" | "Command" | "Cmd" if is_mac() => {
                mods |= Modifiers::SUPER;
            }
            "CommandOrControl" | "CmdOrCtrl" | "Control" | "Ctrl" if !is_mac() => {
                mods |= Modifiers::CONTROL;
            }
            "Control" | "Ctrl" => mods |= Modifiers::CONTROL,
            "Alt" | "Option" => mods |= Modifiers::ALT,
            "Shift" => mods |= Modifiers::SHIFT,
            _ => {}
        }
    }
    let code = match *key {
        "Space" => Code::Space,
        "Escape" | "Esc" => Code::Escape,
        "Enter" => Code::Enter,
        "Backspace" => Code::Backspace,
        "Delete" => Code::Delete,
        "ArrowUp" => Code::ArrowUp,
        "ArrowDown" => Code::ArrowDown,
        "ArrowLeft" => Code::ArrowLeft,
        "ArrowRight" => Code::ArrowRight,
        other if other.len() == 1 => letter_code(other.chars().next()?)?,
        other if other.starts_with('F') && other.len() <= 3 => {
            match other {
                "F1" => Code::F1,
                "F2" => Code::F2,
                "F3" => Code::F3,
                "F4" => Code::F4,
                "F5" => Code::F5,
                "F6" => Code::F6,
                "F7" => Code::F7,
                "F8" => Code::F8,
                "F9" => Code::F9,
                "F10" => Code::F10,
                "F11" => Code::F11,
                "F12" => Code::F12,
                _ => return None,
            }
        }
        _ => return None,
    };
    Some(Shortcut::new(Some(mods), code))
}

fn register_global_shortcuts(app: &AppHandle, shortcuts: &Value) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;

    let quick_add = shortcuts
        .get("global.quickAdd")
        .and_then(|v| v.as_str())
        .unwrap_or(if is_mac() { "Alt+Space" } else { "Alt+Shift+Space" });
    let new_widget = shortcuts
        .get("global.newWidget")
        .and_then(|v| v.as_str())
        .unwrap_or("CommandOrControl+Shift+W");

    if let Some(shortcut) = parse_shortcut(quick_add) {
        let app_handle = app.clone();
        gs.on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                open_quick_add(&app_handle);
            }
        })
        .map_err(|e| e.to_string())?;
    }

    if let Some(shortcut) = parse_shortcut(new_widget) {
        let app_handle = app.clone();
        gs.on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(win) = app_handle.get_webview_window("main") {
                    let _ = win.emit("app:new-widget", ());
                }
            }
        })
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn sync_launch_at_login(app: &AppHandle) -> Result<(), String> {
    let store = read_store_raw(app)?;
    let enabled = store
        .get("prefs")
        .and_then(|p| p.get("launchAtLogin"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn apply_dock_visibility(app: &AppHandle, hide: bool) {
    if hide {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    } else {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_dock_visibility(_app: &AppHandle, _hide: bool) {}

fn sync_menu_bar_from_prefs(app: &AppHandle) -> Result<(), String> {
    let store = read_store_raw(app)?;
    let default_menu_bar = is_mac() || cfg!(target_os = "windows");
    let menu_bar_enabled = store
        .get("prefs")
        .and_then(|p| p.get("menuBarEnabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(default_menu_bar);
    let hide_dock = store
        .get("prefs")
        .and_then(|p| p.get("hideDockIcon"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
        && menu_bar_enabled;

    apply_dock_visibility(app, hide_dock);

    if !menu_bar_enabled {
        if let Some(tray) = app.tray_by_id("main-tray") {
            let _ = tray.set_visible(false);
        }
        return Ok(());
    }

    ensure_tray(app)?;
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_visible(true);
    }
    refresh_tray_menu(app)
}

enum TrayMenuEntry {
    Item(MenuItem<tauri::Wry>),
    Sep(PredefinedMenuItem<tauri::Wry>),
}

fn build_tray_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let store = read_store_raw(app)?;
    let count = active_item_count(&store);
    let mut entries: Vec<TrayMenuEntry> = vec![TrayMenuEntry::Item(
        MenuItem::with_id(
            app,
            "tray-status",
            if count > 0 {
                format!("进行中 {count} 条")
            } else {
                "暂无进行中事项".to_string()
            },
            false,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?,
    )];

    if let Some(all_items) = store.get("items").and_then(|v| v.as_array()) {
        for item in sort_items(all_items, false).into_iter().take(8) {
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let project_id = item.get("projectId").and_then(|v| v.as_str());
            let project_name = project_id.and_then(|pid| {
                store
                    .get("projects")
                    .and_then(|v| v.as_array())
                    .and_then(|projects| {
                        projects
                            .iter()
                            .find(|p| p.get("id").and_then(|v| v.as_str()) == Some(pid))
                            .and_then(|p| p.get("name").and_then(|v| v.as_str()))
                    })
            });
            let label = if let Some(name) = project_name {
                format!("[{name}] {title}")
            } else {
                title.to_string()
            };
            entries.push(TrayMenuEntry::Item(
                MenuItem::with_id(
                    app,
                    format!("complete-{id}"),
                    label.chars().take(48).collect::<String>(),
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            ));
        }
    }

    entries.push(TrayMenuEntry::Sep(
        PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
    ));
    for (id, label) in [
        ("quick-add", "快速添加…"),
        ("open-main", "打开主窗口"),
        ("new-widget", "新建桌面组件"),
        ("open-settings", "设置…"),
    ] {
        entries.push(TrayMenuEntry::Item(
            MenuItem::with_id(app, id, label, true, None::<&str>).map_err(|e| e.to_string())?,
        ));
    }
    entries.push(TrayMenuEntry::Sep(
        PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
    ));
    entries.push(TrayMenuEntry::Item(
        MenuItem::with_id(
            app,
            "quit",
            if is_mac() { "退出 PlanDesk" } else { "退出" },
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?,
    ));

    let refs: Vec<&dyn IsMenuItem<tauri::Wry>> = entries
        .iter()
        .map(|entry| match entry {
            TrayMenuEntry::Item(item) => item as &dyn IsMenuItem<tauri::Wry>,
            TrayMenuEntry::Sep(sep) => sep as &dyn IsMenuItem<tauri::Wry>,
        })
        .collect();

    Menu::with_items(app, &refs).map_err(|e| e.to_string())
}

fn dialog_save_file(app: &AppHandle, file_name: String) -> Result<Option<FilePath>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title("导出数据")
        .add_filter("JSON", &["json"])
        .set_file_name(file_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    rx.recv().map_err(|e| e.to_string())
}

fn dialog_pick_file(app: &AppHandle, title: &str) -> Result<Option<FilePath>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title(title)
        .add_filter("JSON", &["json"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    rx.recv().map_err(|e| e.to_string())
}

fn dialog_pick_path(app: &AppHandle, title: &str, folder: bool) -> Result<Option<FilePath>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let builder = app.dialog().file().set_title(title);
    if folder {
        builder.pick_folder(move |path| {
            let _ = tx.send(path);
        });
    } else {
        builder.pick_file(move |path| {
            let _ = tx.send(path);
        });
    }
    rx.recv().map_err(|e| e.to_string())
}

fn refresh_tray_menu(app: &AppHandle) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main-tray") else {
        return Ok(());
    };
    let store = read_store_raw(app)?;
    let count = active_item_count(&store);
    let tooltip = if count > 0 {
        format!("PlanDesk · {count} 条进行中")
    } else {
        "PlanDesk".to_string()
    };
    let _ = tray.set_tooltip(Some(tooltip));
    let menu = build_tray_menu(app)?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

fn ensure_tray(app: &AppHandle) -> Result<(), String> {
    if app.tray_by_id("main-tray").is_some() {
        return refresh_tray_menu(app);
    }

    let menu = build_tray_menu(app)?;
    let icon = load_tray_icon(app)?;

    let app_handle = app.clone();
    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("PlanDesk")
        .show_menu_on_left_click(is_mac())
        .on_menu_event(move |app, event| {
            let id = event.id().0.as_str();
            if let Some(item_id) = id.strip_prefix("complete-") {
                let _ = toggle_item_completed(app, item_id, true);
                return;
            }
            if let Some(plan_id) = id.strip_prefix("open-plan-") {
                show_main_window(app);
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.emit("app:select-plan", plan_id);
                }
                return;
            }
            match id {
                "quick-add" => open_quick_add(app),
                "open-main" => show_main_window(app),
                "new-widget" => {
                    show_main_window(app);
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.emit("app:new-widget", ());
                    }
                }
                "open-settings" => open_settings(app),
                "quit" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        state.is_quitting.store(true, Ordering::SeqCst);
                    }
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if !is_mac() {
                if let tauri::tray::TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    ..
                } = event
                {
                    show_main_window(tray.app_handle());
                }
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;

    let _ = app_handle;
    Ok(())
}

#[tauri::command]
fn store_load(app: AppHandle) -> Result<Value, String> {
    read_store_raw(&app)
}

#[tauri::command]
fn store_save(app: AppHandle, store: Value) -> Result<bool, String> {
    write_store_raw(&app, &store)?;
    Ok(true)
}

#[tauri::command]
fn store_get_data_dir(app: AppHandle) -> Result<String, String> {
    store_path(&app).map(|p| p.parent().unwrap().to_string_lossy().into_owned())
}

#[tauri::command]
async fn store_open_data_dir(app: AppHandle) -> Result<bool, String> {
    let dir = store_path(&app)?.parent().unwrap().to_string_lossy().into_owned();
    app.opener()
        .open_path(dir, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn store_export_dialog(app: AppHandle) -> Result<Value, String> {
    let date = chrono_lite_date();
    let path = dialog_save_file(&app, format!("plandesk-backup-{date}.json"))?;
    let Some(path) = path else {
        return Ok(json!({ "ok": false }));
    };
    let store = read_store_raw(&app)?;
    let text = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(path.as_path().ok_or("invalid path")?, text).map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true, "path": path.to_string() }))
}

#[tauri::command]
async fn store_import_dialog(app: AppHandle) -> Result<Value, String> {
    let picked = dialog_pick_file(&app, "导入数据")?;
    let Some(path) = picked else {
        return Ok(json!({ "ok": false }));
    };
    let text = fs::read_to_string(path.as_path().ok_or("invalid path")?).map_err(|e| e.to_string())?;
    let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if !parsed.get("projects").and_then(|v| v.as_array()).is_some()
        || !parsed.get("items").and_then(|v| v.as_array()).is_some()
    {
        return Ok(json!({ "ok": false, "error": "无效的数据格式" }));
    }
    if let Ok(current_path) = store_path(&app) {
        if current_path.exists() {
            let _ = fs::copy(&current_path, format!("{}.bak", current_path.to_string_lossy()));
        }
    }
    write_store_raw(&app, &parsed)?;
    emit_store_updated(&app);
    Ok(json!({ "ok": true }))
}

fn chrono_lite_date() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs / 86400)
}

#[tauri::command]
fn app_notify_store_changed(app: AppHandle) -> Result<(), String> {
    emit_store_updated(&app);
    Ok(())
}

#[tauri::command]
fn app_set_launch_at_login(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
    }
    let mut store = read_store_raw(&app)?;
    let prefs = store
        .get_mut("prefs")
        .and_then(|v| v.as_object_mut())
        .ok_or_else(|| "invalid prefs".to_string())?;
    prefs.insert("launchAtLogin".to_string(), json!(enabled));
    write_store_raw(&app, &store)?;
    Ok(true)
}

#[tauri::command]
fn app_get_launch_at_login(app: AppHandle) -> Result<bool, String> {
    Ok(app
        .autolaunch()
        .is_enabled()
        .map_err(|e| e.to_string())?)
}

#[tauri::command]
fn app_get_menu_bar_enabled(app: AppHandle) -> Result<bool, String> {
    let store = read_store_raw(&app)?;
    Ok(store
        .get("prefs")
        .and_then(|p| p.get("menuBarEnabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(is_mac()))
}

#[tauri::command]
fn app_set_menu_bar_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let mut store = read_store_raw(&app)?;
    let prefs = store
        .get_mut("prefs")
        .and_then(|v| v.as_object_mut())
        .ok_or_else(|| "invalid prefs".to_string())?;
    prefs.insert("menuBarEnabled".to_string(), json!(enabled));
    if !enabled {
        prefs.insert("hideDockIcon".to_string(), json!(false));
    }
    write_store_raw(&app, &store)?;
    sync_menu_bar_from_prefs(&app)?;
    Ok(true)
}

#[tauri::command]
fn app_get_hide_dock_icon(app: AppHandle) -> Result<bool, String> {
    let store = read_store_raw(&app)?;
    Ok(store
        .get("prefs")
        .and_then(|p| p.get("hideDockIcon"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

#[tauri::command]
fn app_set_hide_dock_icon(app: AppHandle, hide: bool) -> Result<bool, String> {
    let mut store = read_store_raw(&app)?;
    let prefs = store
        .get_mut("prefs")
        .and_then(|v| v.as_object_mut())
        .ok_or_else(|| "invalid prefs".to_string())?;
    prefs.insert("hideDockIcon".to_string(), json!(hide));
    if hide {
        prefs.insert("menuBarEnabled".to_string(), json!(true));
    }
    write_store_raw(&app, &store)?;
    sync_menu_bar_from_prefs(&app)?;
    Ok(true)
}

#[tauri::command]
fn app_sync_global_shortcuts(app: AppHandle, shortcuts: Value) -> Result<bool, String> {
    register_global_shortcuts(&app, &shortcuts)?;
    Ok(true)
}

#[tauri::command]
async fn fs_pick_link(app: AppHandle, kind: String) -> Result<Value, String> {
    let picked = if kind == "folder" {
        dialog_pick_path(&app, "选择文件夹", true)?
    } else {
        dialog_pick_path(&app, "选择文件", false)?
    };
    let Some(path) = picked else {
        return Ok(json!({ "ok": false }));
    };
    Ok(json!({
        "ok": true,
        "path": path.to_string(),
        "kind": kind
    }))
}

#[tauri::command]
async fn fs_open_path(app: AppHandle, file_path: String) -> Result<Value, String> {
    if file_path.is_empty() || !PathBuf::from(&file_path).exists() {
        return Ok(json!({ "ok": false, "error": "路径不存在或已被移动" }));
    }
    app.opener()
        .open_path(&file_path, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
async fn fs_show_in_folder(app: AppHandle, file_path: String) -> Result<Value, String> {
    if file_path.is_empty() || !PathBuf::from(&file_path).exists() {
        return Ok(json!({ "ok": false, "error": "路径不存在或已被移动" }));
    }
    app.opener()
        .reveal_item_in_dir(&file_path)
        .map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
fn fs_path_exists(file_path: String) -> Result<Value, String> {
    Ok(json!({
        "ok": true,
        "exists": !file_path.is_empty() && PathBuf::from(file_path).exists()
    }))
}

#[tauri::command]
fn widget_open(app: AppHandle, config: Value) -> Result<(), String> {
    open_widget_window(&app, &config)
}

#[tauri::command]
fn widget_close(app: AppHandle, widget_id: String) -> Result<bool, String> {
    let label = widget_label(&widget_id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.close();
        return Ok(true);
    }
    remove_widget_from_store(&app, &widget_id);
    Ok(true)
}

#[tauri::command]
fn widget_focus_by_id(app: AppHandle, widget_id: String) -> Result<bool, String> {
    let label = widget_label(&widget_id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(true);
    }
    let store = read_store_raw(&app)?;
    if let Some(widget) = store
        .get("widgets")
        .and_then(|v| v.as_array())
        .and_then(|widgets| widgets.iter().find(|w| w.get("id").and_then(|v| v.as_str()) == Some(widget_id.as_str())))
    {
        open_widget_window(&app, widget)?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn widget_get_id(window: WebviewWindow) -> Result<Option<String>, String> {
    Ok(current_widget_id(&window))
}

#[tauri::command]
fn widget_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

fn widget_surface_ready(window: WebviewWindow, is_pet: bool) -> Result<(), String> {
    apply_widget_window_policies(&window, is_pet);
    let _ = window.show();
    apply_widget_window_policies(&window, is_pet);
    if is_pet {
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn widget_pet_ready(window: WebviewWindow) -> Result<(), String> {
    widget_surface_ready(window, true)
}

#[tauri::command]
fn widget_list_ready(window: WebviewWindow) -> Result<(), String> {
    widget_surface_ready(window, false)
}

#[tauri::command]
fn widget_begin_drag(
    window: WebviewWindow,
    state: State<'_, AppState>,
    screen_x: f64,
    screen_y: f64,
) -> Result<(), String> {
    let Ok(pos) = window.outer_position() else {
        return Ok(());
    };
    let label = window.label().to_string();
    state.drag_states.lock().unwrap().insert(
        label,
        DragState {
            start_screen_x: screen_x,
            start_screen_y: screen_y,
            start_win_x: pos.x,
            start_win_y: pos.y,
        },
    );
    Ok(())
}

#[tauri::command]
fn widget_drag_to(
    window: WebviewWindow,
    state: State<'_, AppState>,
    screen_x: f64,
    screen_y: f64,
) -> Result<(), String> {
    let label = window.label().to_string();
    let Some(drag) = state.drag_states.lock().unwrap().get(&label).cloned() else {
        return Ok(());
    };
    let x = drag.start_win_x + (screen_x - drag.start_screen_x).round() as i32;
    let y = drag.start_win_y + (screen_y - drag.start_screen_y).round() as i32;
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn widget_end_drag(window: WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    state.drag_states.lock().unwrap().remove(window.label());
    Ok(())
}

#[tauri::command]
fn widget_refresh_transparency(window: WebviewWindow) -> Result<bool, String> {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
    Ok(true)
}

#[tauri::command]
fn widget_set_size(
    app: AppHandle,
    window: WebviewWindow,
    width: f64,
    height: f64,
) -> Result<bool, String> {
    let widget_id = current_widget_id(&window);
    let display_mode = widget_id.as_ref().and_then(|id| {
        read_store_raw(&app).ok().and_then(|store| {
            store
                .get("widgets")
                .and_then(|v| v.as_array())
                .and_then(|widgets| {
                    widgets
                        .iter()
                        .find(|w| w.get("id").and_then(|v| v.as_str()) == Some(id.as_str()))
                        .and_then(|w| w.get("displayMode").and_then(|v| v.as_str().map(str::to_string)))
                })
        })
    });
    let is_pet = is_pet_mode(display_mode.as_deref());
    let (min_w, min_h) = if is_pet {
        pet_min_size()
    } else {
        (240.0, 200.0)
    };
    let w = width.max(min_w);
    let h = height.max(min_h);
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width: w, height: h }))
        .map_err(|e| e.to_string())?;
    if is_pet {
        let _ = window.set_resizable(false);
    }
    if let Some(id) = widget_id {
        persist_widget_bounds(&app, &id, &window, is_pet);
    }
    Ok(true)
}

#[tauri::command]
fn widget_remove_stage_member(
    app: AppHandle,
    window: WebviewWindow,
    project_id: String,
) -> Result<Value, String> {
    let widget_id = current_widget_id(&window).ok_or_else(|| "no-widget".to_string())?;
    let mut store = read_store_raw(&app)?;
    let widgets = store
        .get_mut("widgets")
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| "invalid widgets".to_string())?;
    let Some(stage) = widgets
        .iter_mut()
        .find(|w| w.get("id").and_then(|v| v.as_str()) == Some(widget_id.as_str()))
    else {
        return Ok(json!({ "ok": false, "reason": "no-widget" }));
    };
    if stage.get("displayMode").and_then(|v| v.as_str()) != Some("pet-stage") {
        return Ok(json!({ "ok": false, "reason": "not-stage" }));
    }
    let members = stage
        .get("stageMembers")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let filtered: Vec<Value> = members
        .iter()
        .filter(|m| m.get("projectId").and_then(|v| v.as_str()) != Some(project_id.as_str()))
        .cloned()
        .collect();
    if filtered.len() == members.len() {
        return Ok(json!({ "ok": false, "reason": "not-found" }));
    }
    if filtered.is_empty() {
        let _ = window.close();
        return Ok(json!({ "ok": true, "closed": true }));
    }
    stage["stageMembers"] = json!(filtered);
    stage["projectId"] = filtered
        .first()
        .and_then(|m| m.get("projectId"))
        .cloned()
        .unwrap_or(Value::Null);
    stage["petdexSlug"] = filtered
        .first()
        .and_then(|m| m.get("petdexSlug"))
        .cloned()
        .unwrap_or(Value::Null);
    write_store_raw(&app, &store)?;
    emit_store_updated(&app);
    Ok(json!({ "ok": true, "closed": false }))
}

#[tauri::command]
fn quick_add_close(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("quick-add") {
        let _ = win.hide();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            drag_states: Mutex::new(HashMap::new()),
            is_quitting: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            store_load,
            store_save,
            store_get_data_dir,
            store_open_data_dir,
            store_export_dialog,
            store_import_dialog,
            app_notify_store_changed,
            app_set_launch_at_login,
            app_get_launch_at_login,
            app_get_menu_bar_enabled,
            app_set_menu_bar_enabled,
            app_get_hide_dock_icon,
            app_set_hide_dock_icon,
            app_sync_global_shortcuts,
            fs_pick_link,
            fs_open_path,
            fs_show_in_folder,
            fs_path_exists,
            widget_open,
            widget_close,
            widget_focus_by_id,
            widget_get_id,
            widget_minimize,
            widget_pet_ready,
            widget_list_ready,
            widget_begin_drag,
            widget_drag_to,
            widget_end_drag,
            widget_refresh_transparency,
            widget_set_size,
            widget_remove_stage_member,
            quick_add_close
        ])
        .setup(|app| {
            restore_main_window_bounds(app.handle());
            if let Some(win) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                let label = win.label().to_string();
                win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            if !state.is_quitting.load(Ordering::SeqCst) {
                                api.prevent_close();
                                if let Some(w) = app_handle.get_webview_window(&label) {
                                    hide_main_window(&app_handle, &w);
                                }
                            }
                        }
                    }
                    if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
                        save_main_window_bounds(&app_handle);
                    }
                });
                let _ = win.show();
                #[cfg(target_os = "windows")]
                refresh_main_window(&win);
                let _ = win.set_focus();
            }

            let _ = sync_launch_at_login(app.handle());
            let _ = sync_menu_bar_from_prefs(app.handle());

            let widget_app = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(600));
                let handle = widget_app.clone();
                let _ = widget_app.run_on_main_thread(move || {
                    open_all_widgets(&handle);
                });
            });

            let store = read_store_raw(app.handle()).unwrap_or(json!({}));
            let shortcuts = store
                .get("prefs")
                .and_then(|p| p.get("shortcuts"))
                .cloned()
                .unwrap_or(json!({}));
            let _ = register_global_shortcuts(app.handle(), &shortcuts);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                if let Some(state) = app.try_state::<AppState>() {
                    if !state.is_quitting.load(Ordering::SeqCst) {
                        api.prevent_exit();
                    }
                }
            }
        });
}
