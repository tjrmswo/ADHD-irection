//! 캡처 창이 뜨기 직전에 사용자가 쓰던 앱을 알아낸다.

use active_win_pos_rs::get_active_window;

/// API 스키마의 길이 제한과 맞춘다.
const MAX_APP_NAME_CHARS: usize = 200;
const MAX_WINDOW_TITLE_CHARS: usize = 500;

#[derive(Debug, Default, PartialEq)]
pub struct ActiveApp {
    pub name: Option<String>,
    /// macOS에서는 화면 기록 권한이 있어야 채워진다. 없으면 `None`.
    pub window_title: Option<String>,
}

/// 맨 앞에 있는 앱. 알아낼 수 없거나 이 앱 자신이면 빈 값을 돌려준다.
pub fn frontmost() -> ActiveApp {
    match get_active_window() {
        Ok(window) if window.process_id != u64::from(std::process::id()) => ActiveApp {
            name: non_empty(&window.app_name, MAX_APP_NAME_CHARS),
            window_title: non_empty(&window.title, MAX_WINDOW_TITLE_CHARS),
        },
        _ => ActiveApp::default(),
    }
}

fn non_empty(value: &str, max_chars: usize) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.chars().take(max_chars).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 빈_문자열은_없는_값으로_본다() {
        assert_eq!(non_empty("", 10), None);
        assert_eq!(non_empty("   ", 10), None);
    }

    #[test]
    fn 앞뒤_공백을_지우고_글자_수로_자른다() {
        assert_eq!(non_empty("  Code ", 10), Some("Code".into()));
        assert_eq!(non_empty("가나다라마", 3), Some("가나다".into()));
    }

    #[test]
    fn 맨_앞_앱_조회가_패닉_없이_끝난다() {
        let _ = frontmost();
    }
}
