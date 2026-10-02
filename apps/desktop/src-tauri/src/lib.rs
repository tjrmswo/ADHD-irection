mod idle;

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const CAPTURE_WINDOW: &str = "main";

/// 캡처 창이 마지막으로 뜬 시각. 자동 트리거의 재발생 제한에 쓴다.
#[derive(Default)]
struct LastShown(Mutex<Option<Instant>>);

enum Trigger {
    /// 전역 단축키. 사용자가 직접 불렀으므로 바로 키 입력을 받는다.
    Manual,
    /// idle→resume. 사용자가 다른 앱에 입력하던 중일 수 있어 포커스를 뺏지 않는다.
    IdleResume,
}

fn show_capture_window(app: &AppHandle, trigger: Trigger) {
    let Some(window) = app.get_webview_window(CAPTURE_WINDOW) else {
        return;
    };
    *app.state::<LastShown>().0.lock().unwrap() = Some(Instant::now());
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

            // 자동 캡처 트리거: 유휴 → 복귀. 재발생 제한은 유휴 임계값과 같은 길이로 둔다.
            let cooldown = idle::idle_threshold();
            idle::spawn_watcher(app.handle().clone(), move |app| {
                if in_cooldown(app, cooldown) {
                    eprintln!("[idle] 재발생 제한 시간 안이라 건너뜀");
                } else {
                    show_capture_window(app, Trigger::IdleResume);
                }
            });
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
