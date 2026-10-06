use std::fs;

// 웹뷰(Vite)와 Rust가 같은 설정을 쓰도록, apps/desktop의 .env 파일에서 값을 읽어 바이너리에 넣는다.
// Vite의 규칙을 따른다: 배포용 빌드(tauri build)는 .env.production을 먼저, 없으면 .env를 본다.
// 개발 빌드(tauri dev)는 .env만 본다. 그래서 개발은 localhost, 배포용 앱은 배포한 서버를 가리킬 수 있다.
fn env_files() -> Vec<&'static str> {
    let release = std::env::var("PROFILE").is_ok_and(|profile| profile == "release");
    if release {
        vec!["../.env.production", "../.env"]
    } else {
        vec!["../.env"]
    }
}

/// 파일들에서 `NAME=값`을 찾아 처음 나온 값을 돌려준다. 없으면 빈 문자열.
fn read_env(name: &str) -> String {
    let prefix = format!("{name}=");
    env_files()
        .into_iter()
        .filter_map(|path| fs::read_to_string(path).ok())
        .find_map(|content| {
            content.lines().find_map(|line| {
                line.strip_prefix(&prefix)
                    .map(|value| value.trim().trim_matches('"').to_string())
            })
        })
        .unwrap_or_default()
}

fn main() {
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-changed=../.env.production");
    // API에 보내는 키 (API의 DESKTOP_API_KEY와 같은 값)
    println!("cargo:rustc-env=ADHD_API_KEY={}", read_env("VITE_API_KEY"));
    // API 주소. 비어 있으면 Rust 쪽 기본값(localhost)을 쓴다.
    println!("cargo:rustc-env=ADHD_API_URL={}", read_env("VITE_API_URL"));
    tauri_build::build()
}
