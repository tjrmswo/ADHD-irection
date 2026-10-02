#!/bin/sh
# 따로따로 띄운 것까지 포함해 개발용 프로세스와 로컬 DB를 한 번에 끈다.
# DB 데이터는 볼륨에 남는다.

# 데스크톱 앱(개발 빌드와 배포용 앱)
pkill -f "target/debug/desktop" 2>/dev/null
pkill -f "ADHD-irection.app/Contents/MacOS/desktop" 2>/dev/null

# dev 서버를 띄운 프로세스: API(nest), 웹(next), 데스크톱(tauri + vite)
pkill -f "nest.js start" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "tauri.js dev" 2>/dev/null

# 위에서 못 잡은 것이 포트를 쥐고 있으면 마저 끈다 (API 4000, 웹 3000, Tauri dev 1420).
for port in 4000 3000 1420; do
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null)
  [ -n "$pids" ] && kill $pids 2>/dev/null
done

docker compose down
echo "모두 종료했습니다."
