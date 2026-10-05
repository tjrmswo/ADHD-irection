use std::fs;

// 데스크톱 앱이 API에 보내는 키를 apps/desktop/.env의 VITE_API_KEY에서 읽어 바이너리에 넣는다.
// 웹뷰(Vite)와 Rust가 같은 파일의 같은 값을 쓰게 하기 위해서다. 파일이나 값이 없으면 빈 값으로 둔다.
fn api_key() -> String {
    println!("cargo:rerun-if-changed=../.env");
    fs::read_to_string("../.env")
        .ok()
        .and_then(|content| {
            content.lines().find_map(|line| {
                line.strip_prefix("VITE_API_KEY=")
                    .map(|value| value.trim().trim_matches('"').to_string())
            })
        })
        .unwrap_or_default()
}

fn main() {
    println!("cargo:rustc-env=ADHD_API_KEY={}", api_key());
    tauri_build::build()
}
