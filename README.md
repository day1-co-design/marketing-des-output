# 콜로소 마케팅 디자인 산출물 관리 대시보드

Google Sheet `gid=0`의 상단 구조만 반영한 기본 화면입니다.

- 필터: 사이트, 언어, 코스 유형, 코스 포맷, 업무 구간
- 리스트: 구분, 산출물, 규격

## GitHub 연결

저장소: https://github.com/day1-co-design/marketing-des-output

CSV나 작업 산출물 파일을 GitHub에 자동 반영하려면 이 프로젝트 폴더 안에 저장합니다. 예: `outputs/coloso-work-tasks.csv`.

## 자동 푸시

macOS LaunchAgent로 파일 변경을 감시할 수 있습니다. 변경이 감지되면 20초 동안 파일 쓰기가 멈춘 뒤 자동으로 커밋하고 `origin/main`에 푸시합니다.

설치:

```bash
./scripts/install-auto-push-launch-agent.sh
```

상태 확인:

```bash
launchctl print "gui/$(id -u)/com.day1-co-design.marketing-des-output.autopush"
tail -f /private/tmp/marketing-des-output-auto-push.out.log
```

해제:

```bash
./scripts/uninstall-auto-push-launch-agent.sh
```

자동 커밋 메시지는 `Auto-sync marketing outputs: YYYY-MM-DD HH:MM:SS +0900` 형식입니다.

macOS가 백그라운드 작업의 `Documents` 폴더 접근을 막으면 LaunchAgent가 실행되지 않을 수 있습니다. 이 경우 시스템 설정에서 사용 중인 터미널 또는 `/bin/bash`, `/usr/bin/git`에 파일 접근 권한을 허용한 뒤 설치 스크립트를 다시 실행합니다.
