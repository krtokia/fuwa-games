# 후와 게임 — game.fuwa.dad

빌드 없는 정적 사이트. Cloudflare Pages 가 main 을 그대로 배포한다.

- `/` — 게이트웨이(게임 목록). 게임을 추가하면 `index.html` 의 `.games` 에 카드를 하나 더 넣는다.
- `/cat-outing/` — 고양이 나들이. 판 = 칸 수(3~7) × 난이도(쉬움~아주 어려움, `DIFFS` 표) × 판 번호(1~99999), 셋이 같으면 같은 판. 기록·별·고양이 빈도는 localStorage `cat-outing.v2`. 고양이 이름은 실제 이름이라 고정(그림 번호: 01 후와 · 04 슈리 · 02 나비 · 03 두부 · 07 봉봉 · 08 로로 · 05 꼬미 · 06 나무 순서. 기본 등장은 후와·슈리·나비 2배), 사람별로는 등장 빈도만 바꾼다. 고양이 그림은 `cat-outing/cats/<번호>-<칸수>.webp`(320px, 위를 보는 모습, L칸이면 세로 L배). 원본 512px PNG 는 GPT 가 up.fuwa.dad 로 올린 것.

새 게임은 폴더 하나(`/<이름>/index.html`)로 넣는다. 경로는 폴더 안 상대 경로로 쓸 것.

## 후와 달리기 시제품

- `/cat-runner/` — 후와 한 마리가 자동으로 달리고 화면/큰 버튼/스페이스/↑ 키로 점프하는 1분 시제품.
- 느긋하게/보통 속도, 기운 3개, 상자, 간식, 일시정지·재시작, 선택 효과음, 기기 내 최고 간식 기록.
- 한 손가락 조작, 넉넉한 장애물 간격, 충돌 전 안내, 탭을 떠나면 자동 일시정지. 동작 줄이기 설정에서는 배경 흐름과 고양이 흔들림을 줄인다.
- 속도·판 길이·보상과 임시 벡터 캐릭터는 **첫 조작 검증을 위한 가정**이며 최종 기획/미술 확정이 아니다. 캐릭터 해금·계정·순위표·백엔드는 없다.
- 원본 외모 참고: https://fuwa.dad/assets/#ref 와 https://fuwa.dad/assets/ref/fuwa/fuwa-pose-stand-side.png. `cat-runner/assets/`는 외부 이미지 호출 없이 쓰는 임시 자체 벡터 그림이다.
- 별도 localStorage 키 `fuwa-runner.v1` 사용. 기존 `cat-outing/` 코드·그림·기록에는 영향을 주지 않는다.

### 로컬 실행 / 검사

빌드·패키지 설치 없이 저장소 루트에서:

```sh
python3 -m http.server 8000
# http://localhost:8000/cat-runner/ 접속
node --test cat-runner/tests/*.test.mjs
node --check cat-runner/game.mjs
```

Cloudflare Pages는 기존처럼 저장소 루트를 정적으로 서빙한다. 빌드 명령과 서버/컨테이너는 필요 없다. 기능 브랜치에 푸시하면 현재 Pages의 브랜치 미리보기 설정에 따라 별도 미리보기가 생기며, main에 병합하면 기존 production에 새 경로와 목록 카드가 배포된다. 브랜치에서 검증 후 별도로 병합한다.

오프라인 검토용 단일 HTML이 필요하면 `python3 cat-runner/scripts/build-standalone.py /tmp/fuwa-runner.html`로 만든 뒤 브라우저에서 연다. 이는 선택 사항이며 Pages 배포에는 빌드가 필요 없다.

검사 범위: 순수 게임 규칙, 두 속도의 60초 완주, 점프 안내 후 0~0.4초 반응 여유, 입력·일시정지·재시작·저장 실패의 DOM 계약 검사를 자동화했다. DOM 모형 검사는 실제 모바일 브라우저/화면 확인을 대신하지 않는다. 첫 공개 전 실제 Safari/Chrome의 터치·화면 회전·소리를 추가 확인한다.
