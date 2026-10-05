mod active_app;
mod idle;
mod usage;

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const CAPTURE_WINDOW: &str = "main";
const CAPTURE_SHOWN_EVENT: &str = "capture-shown";

/// 캡처 창이 마지막으로 뜬 시각. 자동 트리거의 재발생 제한에 쓴다.
#[derive(Default)]
struct LastShown(Mutex<Option<Instant>>);

/// 캡처 창이 뜬 순간의 맥락. 저장할 때 웹뷰가 가져가 캡처에 함께 보낸다.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureContext {
    trigger_type: &'static str,
    active_app: Option<String>,
    window_title: Option<String>,
}

#[derive(Default)]
struct LastContext(Mutex<Option<CaptureContext>>);

#[tauri::command]
fn capture_context(state: State<LastContext>) -> Option<CaptureContext> {
    state.0.lock().unwrap().clone()
}

enum Trigger {
    /// 전역 단축키. 사용자가 직접 불렀으므로 바로 키 입력을 받는다.
    Manual,
    /// idle→resume. 사용자가 다른 앱에 입력하던 중일 수 있어 포커스를 뺏지 않는다.
    IdleResume,
}

impl Trigger {
    /// API의 `triggerType` 값.
    fn as_str(&self) -> &'static str {
        match self {
            Trigger::Manual => "manual",
            Trigger::IdleResume => "idle_resume",
        }
    }
}

fn show_capture_window(app: &AppHandle, trigger: Trigger) {
    let Some(window) = app.get_webview_window(CAPTURE_WINDOW) else {
        return;
    };
    // 이미 떠 있는 창을 다시 부른 경우에는 처음 뜬 순간의 맥락을 유지한다.
    // 창을 띄우기 전에 읽어야 이 앱이 아니라 사용자가 쓰던 앱이 잡힌다.
    if !window.is_visible().unwrap_or(false) {
        let frontmost = active_app::frontmost();
        let context = CaptureContext {
            trigger_type: trigger.as_str(),
            active_app: frontmost.name,
            window_title: frontmost.window_title,
        };
        eprintln!(
            "[capture] 계기 {} / 앱 {:?} / 창 제목 {:?}",
            context.trigger_type, context.active_app, context.window_title
        );
        *app.state::<LastContext>().0.lock().unwrap() = Some(context);
    }
    *app.state::<LastShown>().0.lock().unwrap() = Some(Instant::now());
    // 웹뷰는 창이 숨겨져 있는 동안에도 살아 있으므로, 뜰 때마다 알려서 복귀 요약을 새로 불러오게 한다.
    let context = app.state::<LastContext>().0.lock().unwrap().clone();
    let _ = window.emit(CAPTURE_SHOWN_EVENT, context);
    let _ = window.show();
    if matches!(trigger, Trigger::Manual) {
        let _ = window.set_focus();
    }
}

/// 직전에 캡처 창이 뜬 지 `cooldown`이 지나지 않았으면 자동 트리거를 건너뛴다.
fn in_cooldown(app: &AppHandle, cooldown: Duration) -> bool {
    app.state::<LastShown>()
        .0
        .lock()
        .unwrap()
        .is_some_and(|shown| shown.elapsed() < cooldown)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 수동 캡처 트리거: Option+Shift+C
    let capture_shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::KeyC);

    tauri::Builder::default()
        .manage(LastShown::default())
        .manage(LastContext::default())
        .invoke_handler(tauri::generate_handler![capture_context])
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &capture_shortcut && event.state() == ShortcutState::Pressed {
                        show_capture_window(app, Trigger::Manual);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            app.global_shortcut().register(capture_shortcut)?;

            // Dock 대신 메뉴바에 상주한다. 창이 숨겨져 있어도 여기서 캡처·종료할 수 있다.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let capture_item = MenuItem::with_id(app, "capture", "캡처 (⌥⇧C)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&capture_item, &quit_item])?;
            TrayIconBuilder::with_id("main")
                .icon(tauri::include_image!("icons/tray.png"))
                .icon_as_template(true)
                .tooltip("ADHD-irection")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "capture" => show_capture_window(app, Trigger::Manual),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // 자동 캡처 트리거: 유휴 → 복귀. 재발생 제한은 유휴 임계값과 같은 길이로 둔다.
            let cooldown = idle::idle_threshold();
            idle::spawn_watcher(app.handle().clone(), move |app| {
                if in_cooldown(app, cooldown) {
                    eprintln!("[idle] 재발생 제한 시간 안이라 건너뜀");
                } else {
                    show_capture_window(app, Trigger::IdleResume);
                }
            });
            // 사용 흔적: 자리에 있는 동안 주기적으로 맨 앞 앱을 기록한다.
            usage::spawn_recorder();
            Ok(())
        })
        // 창을 닫아도 앱은 계속 떠 있어야 트리거가 살아 있다 — 닫는 대신 숨긴다.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
