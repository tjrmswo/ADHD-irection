//! 사용 흔적: 자리에 있는 동안 주기적으로 맨 앞 앱을 API에 저장한다.
//! 커밋하지 않은 작업도 "그 시간에 무엇을 쓰고 있었는지"로 남기기 위한 신호다.
//!
//! 저장은 웹뷰를 거치지 않고 여기서 직접 한다. 캡처 창이 숨겨져 있는 동안에는
//! macOS가 웹뷰를 멈춰 두어서, 웹뷰에 맡기면 창이 떠 있을 때만 저장된다.

use std::thread;
use std::time::Duration;

use serde::Serialize;
use user_idle::UserIdle;

use crate::active_app;
use crate::idle::duration_from_env;

/// 1분마다 기록한다. 작업 블록(30분 칸)만 보면 더 길어도 되지만, 복귀 요약의
/// "마지막 흔적 시각"과 "보던 화면"이 이 주기만큼 어긋나므로 짧게 둔다.
/// 하루 10시간을 써도 600행이라 저장 부담은 없다.
const DEFAULT_INTERVAL: Duration = Duration::from_secs(60);
/// 웹뷰의 `VITE_API_URL` 기본값과 같다. `ADHD_API_URL`로 바꾼다.
const DEFAULT_API_URL: &str = "http://localhost:4000";
/// API에 보내는 키. 빌드할 때 build.rs가 apps/desktop/.env에서 읽어 넣는다.
const API_KEY: &str = env!("ADHD_API_KEY");
/// API가 응답하지 않아도 다음 주기를 밀지 않도록 짧게 끊는다.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

/// `POST /usage` 본문. 관측 시각은 보내지 않고 API가 받은 시각을 쓴다.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppUsage {
    active_app: String,
    window_title: Option<String>,
}

/// 지난 주기 동안 입력이 한 번이라도 있었으면 자리에 있었던 것으로 본다.
fn was_present(idle: Duration, interval: Duration) -> bool {
    idle < interval
}

/// 개발 중에는 `ADHD_USAGE_INTERVAL_SECS=10`처럼 줄여서 확인한다.
fn interval() -> Duration {
    duration_from_env("ADHD_USAGE_INTERVAL_SECS", DEFAULT_INTERVAL)
}

fn usage_url() -> String {
    let base = std::env::var("ADHD_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string());
    format!("{}/usage", base.trim_end_matches('/'))
}

/// 백그라운드 스레드에서 주기마다 맨 앞 앱을 저장한다.
pub fn spawn_recorder() {
    let interval = interval();
    let url = usage_url();
    eprintln!("[usage] 기록 시작: {}초마다 → {}", interval.as_secs(), url);
    thread::spawn(move || {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(REQUEST_TIMEOUT))
            .build()
            .into();
        loop {
            thread::sleep(interval);
            let Ok(idle) = UserIdle::get_time() else {
                continue;
            };
            if !was_present(idle.duration(), interval) {
                continue;
            }
            // 이 앱 자신이 맨 앞이거나 알아낼 수 없으면 건너뛴다.
            let frontmost = active_app::frontmost();
            let Some(active_app) = frontmost.name else {
                continue;
            };
            let usage = AppUsage {
                active_app,
                window_title: frontmost.window_title,
            };
            // API가 꺼져 있으면 그 주기는 그냥 빠진다.
            match agent
                .post(&url)
                .header("x-api-key", API_KEY)
                .send_json(&usage)
            {
                Ok(_) => eprintln!(
                    "[usage] 저장: 앱 {:?} / 창 제목 {:?}",
                    usage.active_app, usage.window_title
                ),
                Err(error) => eprintln!("[usage] 저장 실패: {error}"),
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 주기_안에_입력이_있었으면_자리에_있던_것이다() {
        let interval = Duration::from_secs(60);
        assert!(was_present(Duration::from_secs(0), interval));
        assert!(was_present(Duration::from_secs(59), interval));
    }

    #[test]
    fn 주기_내내_입력이_없었으면_기록하지_않는다() {
        let interval = Duration::from_secs(60);
        assert!(!was_present(Duration::from_secs(60), interval));
        assert!(!was_present(Duration::from_secs(3600), interval));
    }

    #[test]
    fn 본문은_api가_받는_camel_case_키로_만든다() {
        let body = serde_json::to_value(AppUsage {
            active_app: "Code".into(),
            window_title: None,
        })
        .unwrap();
        assert_eq!(
            body,
            serde_json::json!({ "activeApp": "Code", "windowTitle": null })
        );
    }
}
