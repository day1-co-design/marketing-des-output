# 콜로소 마케팅 디자인 산출물 관리 대시보드

Google Sheet `gid=0`의 상단 구조를 기준으로 CSV 운영 기준표를 내보내고 다시 업로드할 수 있는 화면입니다.

- 필터: 사이트, 언어, 코스 유형, 코스 포맷, 업무 구간
- 리스트: 구분, 산출물, 규격
- CSV 관리 컬럼: `업무유무`, `유형적합여부`
- `업무유무` 또는 `유형적합여부`를 `N`, `X`, `NO`, `FALSE`, `0`, `불필요`, `미노출`로 입력하면 프론트에서 숨김 처리됩니다.
- `규격`은 CSV에 입력한 값 그대로 화면에 반영됩니다.
- 화면의 `운영 기준 편집` 테이블에서도 `규격`, `업무유무`, `유형적합여부`를 바로 수정할 수 있습니다.

## GitHub 연결

저장소: https://github.com/day1-co-design/marketing-des-output

배포 URL: https://day1-co-design.github.io/marketing-des-output/

CSV나 작업 산출물 파일을 GitHub에 자동 반영하려면 이 프로젝트 폴더 안에 저장합니다. 예: `outputs/coloso-work-tasks.csv`.

## 배포

GitHub Pages에서 `main` 브랜치의 `/ (root)`를 배포 소스로 지정합니다. 이후 `main`에 푸시될 때마다 루트의 `index.html`, `app.js`, `styles.css`가 사이트에 반영됩니다.

설정 경로:

```text
Settings > Pages > Build and deployment > Source: Deploy from a branch
Branch: main
Folder: / (root)
```

## 자동 커밋/푸시

파일 변경을 감시하다가 20초 동안 파일 쓰기가 멈추면 자동으로 커밋하고 `origin/main`에 푸시합니다. 평소 작업할 때는 터미널에서 감시 프로세스를 켜두는 방식을 권장합니다.

시작:

```bash
cd "/Users/semikim/Documents/New project"
./scripts/start-auto-push.sh
```

상태 확인:

```bash
./scripts/status-auto-push.sh
```

중지:

```bash
./scripts/stop-auto-push.sh
```

자동 커밋 메시지는 `Auto-sync marketing outputs: YYYY-MM-DD HH:MM:SS +0900` 형식입니다.

로그인 후 자동 실행까지 필요하면 macOS LaunchAgent를 설치할 수 있습니다.

LaunchAgent 설치:

```bash
./scripts/install-auto-push-launch-agent.sh
```

상태 확인:

```bash
launchctl print "gui/$(id -u)/com.day1-co-design.marketing-des-output.autopush"
tail -f /private/tmp/marketing-des-output-auto-push.out.log
```

LaunchAgent 해제:

```bash
./scripts/uninstall-auto-push-launch-agent.sh
```

macOS가 백그라운드 작업의 `Documents` 폴더 접근을 막으면 LaunchAgent가 실행되지 않을 수 있습니다. 이 경우 시스템 설정에서 사용 중인 터미널 또는 `/bin/bash`, `/usr/bin/git`에 파일 접근 권한을 허용한 뒤 설치 스크립트를 다시 실행합니다.
