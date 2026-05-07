# 콜로소 마케팅 디자인 산출물 관리 대시보드

Google Sheet `gid=0`의 상단 구조를 기준으로 CSV 운영 기준표를 내보내고 다시 업로드할 수 있는 화면입니다.

- 필터: 사이트, 언어(GL 사이트만), 코스 유형, 코스 포맷, 현지화 유형, 런칭 타임라인
- 가이드 링크: 통합, KR, JP, GL
- 리스트: 구분, 산출물, 규격, 파일 확장자
- CSV 관리 컬럼: `업무유무`, `유형적합여부`
- `현지화유형`은 `현지화` 코스 유형에서 `폐강옵션`, `정규`, `더빙`, `확장`을 관리합니다.
- `코스포맷`은 오리지널/현지화 모두 `코스`, `시그니처`, `딕셔너리`, `에셋`, `클래스`, `클래스 +`, `프로젝트`, `신규` 순서로 사용합니다.
- `구분`은 `온사이트`(기존 사이트 업무), `오가닉`(공계용 피드, 공계용 스토리, 연사용 피드, 트레일러 썸네일), `페이드`(광고), `CRM`(EDM, 카카오톡) 기준으로 정리합니다.
- `상세페이지`는 `상세페이지 이미지 제작`, `상세페이지 어드민 작업` 2개 업무로 분리합니다.
- 오가닉 파일 확장자는 `트레일러 썸네일`만 `jpg`, 나머지는 `png`를 사용합니다.
- `페이드 / 광고`의 기본 규격은 `광고 소재에 따라 상이`입니다.
- `파일 확장자`는 운영 기준 편집과 CSV에서 직접 수정할 수 있습니다. DB 동기화를 위해 `file_extension` 컬럼이 필요합니다.
- DB에서 운영 기준을 불러올 때 1,000행 단위로 페이지 조회해 전체 저장값을 복원합니다.
- `업무유무` 또는 `유형적합여부`를 `N`, `X`, `NO`, `FALSE`, `0`, `불필요`, `미노출`로 입력하면 프론트에서 숨김 처리됩니다.
- `규격`은 CSV에 입력한 값 그대로 화면에 반영됩니다.
- 화면의 `운영 기준 편집` 테이블에서도 `규격`, `업무유무`, `유형적합여부`를 바로 수정할 수 있습니다.
- Supabase 설정을 연결하면 저장값이 DB에 저장되고 다른 브라우저/사용자에게 실시간 반영됩니다.

## DB 실시간 연동

기본 상태에서는 브라우저의 로컬 저장소에 저장됩니다. 여러 사람이 같은 기준을 공유하려면 Supabase 프로젝트를 만들고 아래 순서로 연결합니다.

1. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
2. 같은 SQL Editor에서 원하는 편집 인증번호를 설정합니다.
3. `config.js`에 Supabase Project URL과 anon public key를 입력합니다.

```sql
select public.set_marketing_output_passcode('원하는인증번호');
```

```js
window.COLOSO_DB_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_PUBLIC_KEY",
};
```

현재 SQL은 링크를 아는 사용자가 읽기/수정할 수 있는 운영용 공개 정책입니다. 외부 노출을 제한해야 하면 Supabase Auth 또는 별도 API 서버를 붙여 권한 정책을 강화해야 합니다.

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
