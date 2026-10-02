//! 자동 캡처 트리거: 유휴 상태가 임계값 이상 이어진 뒤 활동이 재개되는 순간을 잡는다.

use std::thread;
use std::time::{Duration, SystemTime};

use tauri::AppHandle;
use user_idle::UserIdle;

/// 이 시간 이상 입력이 없으면 "이탈"로 본다 (decision-log 6-5절의 gap 분포 근거).
const DEFAULT_IDLE_THRESHOLD: Duration = Duration::from_secs(20 * 60);
/// 평소 폴링 주기. 이탈 판정에는 분 단위 정밀도면 충분하다.
const ACTIVE_POLL: Duration = Duration::from_secs(60);
/// 이탈 중 폴링 주기. 복귀하자마자 창을 띄우려면 짧아야 한다.
const AWAY_POLL: Duration = Duration::from_secs(1);

/// 유휴시간 관측값을 받아 "이탈 → 복귀" 전환을 판정한다.
pub struct ResumeDetector {
    threshold: Duration,
    away: bool,
}

impl ResumeDetector {
    pub fn new(threshold: Duration) -> Self {
        Self {
            threshold,
            away: false,
        }
    }

    pub fn is_away(&self) -> bool {
        self.away
    }

    /// `idle`: 마지막 입력 이후 지난 시간. `since_last_poll`: 직전 관측 이후 지난 실제 시간.
    /// 복귀한 순간에만 true를 돌려준다.
    pub fn observe(&mut self, idle: Duration, since_last_poll: Duration) -> bool {
        // 잠자기에서 깨어난 경우: 잠든 동안에는 폴링이 멈추므로 유휴시간만으로는
        // 이탈을 못 본다. 관측 간격이 임계값 이상 벌어졌으면 이탈했던 것으로 본다.
        if since_last_poll >= self.threshold {
            self.away = true;
        }

        if idle >= self.threshold {
            self.away = true;
            return false;
        }

        // 유휴시간이 관측 간격보다 짧다 = 그 사이에 입력이 있었다.
        let had_input = idle < since_last_poll;
        if self.away && had_input {
            self.away = false;
            return true;
        }
        false
    }
}

fn duration_from_env(name: &str, default: Duration) -> Duration {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .map(Duration::from_secs)
        .unwrap_or(default)
}

/// 개발 중에는 `ADHD_IDLE_THRESHOLD_SECS=10`처럼 줄여서 확인한다.
pub fn idle_threshold() -> Duration {
    duration_from_env("ADHD_IDLE_THRESHOLD_SECS", DEFAULT_IDLE_THRESHOLD)
}

/// 백그라운드 스레드에서 유휴시간을 폴링하다가 복귀 시점에 `on_resume`을 호출한다.
pub fn spawn_watcher(app: AppHandle, on_resume: impl Fn(&AppHandle) + Send + 'static) {
    let threshold = idle_threshold();
    eprintln!("[idle] 감시 시작: 유휴 임계값 {}초", threshold.as_secs());
    thread::spawn(move || {
        let mut detector = ResumeDetector::new(threshold);
        let mut last_poll = SystemTime::now();
        loop {
            let poll = if detector.is_away() {
                AWAY_POLL
            } else {
                // 관측 간격이 임계값에 닿으면 잠자기로 오인하므로 절반 이하로 유지한다.
                ACTIVE_POLL.min(threshold / 2)
            };
            thread::sleep(poll);

            // 잠자기 시간을 포함해야 하므로 Instant가 아니라 벽시계 시간을 쓴다.
            let now = SystemTime::now();
            let since_last_poll = now.duration_since(last_poll).unwrap_or_default();
            last_poll = now;

            let Ok(idle) = UserIdle::get_time() else {
                continue;
            };
            let was_away = detector.is_away();
            if detector.observe(idle.duration(), since_last_poll) {
                eprintln!("[idle] 복귀 감지");
                on_resume(&app);
            } else if !was_away && detector.is_away() {
                eprintln!("[idle] 이탈 판정 (유휴 {}초)", idle.duration().as_secs());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const THRESHOLD: Duration = Duration::from_secs(20 * 60);

    fn secs(n: u64) -> Duration {
        Duration::from_secs(n)
    }

    #[test]
    fn 시스템_유휴시간을_읽을_수_있다() {
        assert!(UserIdle::get_time().is_ok());
    }

    #[test]
    fn 계속_활동_중이면_트리거하지_않는다() {
        let mut detector = ResumeDetector::new(THRESHOLD);
        assert!(!detector.observe(secs(3), secs(60)));
        assert!(!detector.observe(secs(0), secs(60)));
    }

    #[test]
    fn 임계값_미만의_유휴는_이탈이_아니다() {
        let mut detector = ResumeDetector::new(THRESHOLD);
        assert!(!detector.observe(secs(19 * 60), secs(60)));
        assert!(!detector.observe(secs(2), secs(60)));
    }

    #[test]
    fn 임계값_이상_유휴_후_입력이_재개되면_한_번만_트리거한다() {
        let mut detector = ResumeDetector::new(THRESHOLD);
        assert!(!detector.observe(secs(20 * 60), secs(60)));
        assert!(detector.is_away());
        // 이탈 중에는 계속 false
        assert!(!detector.observe(secs(20 * 60 + 1), secs(1)));
        // 복귀
        assert!(detector.observe(secs(0), secs(1)));
        assert!(!detector.is_away());
        // 복귀 후 계속 활동해도 다시 트리거하지 않는다
        assert!(!detector.observe(secs(0), secs(60)));
    }

    #[test]
    fn 잠자기에서_깨어나_입력이_있으면_트리거한다() {
        let mut detector = ResumeDetector::new(THRESHOLD);
        assert!(!detector.observe(secs(5), secs(60)));
        // 한 시간 잠들었다가 깨어나 바로 입력
        assert!(detector.observe(secs(2), secs(60 * 60)));
    }

    #[test]
    fn 잠자기에서_깨어났지만_아직_입력이_없으면_입력을_기다린다() {
        let mut detector = ResumeDetector::new(THRESHOLD);
        // 깨어났지만 유휴시간이 임계값을 넘어 있다 (알림 등으로 혼자 깨어난 경우)
        assert!(!detector.observe(secs(60 * 60), secs(60 * 60)));
        assert!(detector.is_away());
        assert!(detector.observe(secs(0), secs(1)));
    }
}
