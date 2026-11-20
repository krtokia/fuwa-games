# 간식 팡팡 고양이 그림 요청서

그림 AI(GPT 이미지 등)에게 주는 요청서다. 이 문서만 읽고 그릴 수 있게 썼다.
For an image-generation AI: everything needed to draw the cat art for the match-3 game "간식 팡팡" (Snack Pop) is in this file.

- 게임 미리보기: https://feat-snack-pop.fuwa-games.pages.dev/snack-pop/ (브랜치 `feat/snack-pop`)
- 고양이 생김새 기준(실사 기반, 꼭 첨부): https://fuwa.dad/assets/#ref · 기계용 목록 https://fuwa.dad/assets/ref/index.json
- 지금은 다른 게임(`cat-outing/cats/01-1.webp` 등) 그림을 빌려 쓰고, 옆으로 눕힌 걸 빼꼼으로 쓰고 있다. 이걸 전부 바꾼다.

## 고양이 셋과 성격

생김새는 반드시 기준 그림에 맞춘다(털색·무늬·눈색·체형). 성격은 표정과 자세로만 드러낸다.
성격의 원본은 캐릭터 바이블(실제 관찰 기반, 릴레이방 「Fuwa·Shuri·Nabi 캐릭터 바이블」)이다. 아래 표는 그걸 게임용으로 줄인 것이다.

| id | 이름 | 생김새 (기준 그림 요약) | 게임 속 성격 | 대사 예 |
|---|---|---|---|---|
| `fuwa` | 후와 | 장모 회색·베이지, 아주 큰 목 갈기, 풍성한 꼬리, 귀 끝 장식털, 황록색 눈, 분홍 코, 늘 살짝 시큰둥 | 도도한 얼음공주(은근한 츤데레). 드물게 크게 부탁 | "생선… 있으면 두고 가." / "…고마워. 한 번만 말할 거야." / "됐어. 안 기다렸어." |
| `shuri` | 슈리 | 갈색 고등어 태비 단모, 큰 귀, 이마 M자, 꼬리 검은 고리(끝 검정), 황록색 눈, 날씬 | 누구에게나 다정한 애교쟁이. 중간 | "생선! 생선 줘, 응?" / "고마워! 최고야!" / "힝… 다음엔 꼭 줘!" |
| `nabi` | 나비 | 차콜 회색 턱시도 단모, 흰 주둥이·가슴·배·발, 아랫입술 작은 검은 점, 노란 눈, 검은 코 | 겁 많은 수다쟁이 장난꾸러기. 자주 작게 조름 | "저, 저기… 생선 있어? 줘, 줘!" / "우와와! 고마워 고마워!" / "냐아… 숨을래." |

기준 그림 주의:
- 슈리 정면 그림은 꼬리가 머리 뒤로 솟아 머리에서 난 것처럼 보인다. 꼬리는 몸 뒤에서 난다.
- 나비 머리 위 작은 고리 모양은 흉터라 그리지 않는다.

## 그림 스타일

- 게임 블록은 굵은 진갈색 테두리(#3a2a22)의 귀여운 2D 만화 그림이다(생선·털실·쿠키·방울·캣닢·별사탕). 고양이도 같은 결로 맞춘다.
  - 부드러운 2D 만화체, 진갈색 테두리 중간 굵기.
  - 실사·3D·사진 느낌은 안 된다.
- 아주 작게도 보인다(얼굴은 30px). 실루엣과 얼굴이 작아도 읽히게 단순하게 그린다.
- 세 마리의 그림체, 테두리 굵기, 크기 비율을 같게 한다.

## 공통 기술 조건

- PNG, **진짜 투명 배경**(알파). 바닥, 그림자, 빛 번짐, 배경, 글자, 서명, 체크무늬는 넣지 않는다.
- 크기는 아래 표대로 한다. 정사각 캔버스에 고양이를 가운데 두고 여백을 조금 남긴다(빼꼼은 예외, 아래 참고).
- 파일은 `snack-pop/assets/cats/` 에 둔다. 이름은 `<id>-<종류>.png` 이다. 넣은 뒤 WebP 변환과 코드 연결은 개발 쪽에서 한다.

## 필요한 그림 (고양이마다, 총 3 × 4 = 12장 + 후와 2장)

### 1. 빼꼼 — `<id>-peek.png`, `<id>-peek-happy.png`, `<id>-peek-sulk.png` (512×512)

판 오른쪽 화면 끝에서 고개를 내미는 장면이다. 게임에서는 120×120px로 보이고, 오른쪽에서 미끄러져 들어왔다가 다시 나간다.

- **구도(가장 중요):**
  - 고양이 몸은 캔버스 **오른쪽 끝에서 잘려** 있다. 오른쪽 가장자리가 화면 끝(벽)이다.
  - 머리와 앞발 하나 또는 둘이 왼쪽(판 쪽)으로 나와 있다. 얼굴과 시선은 **왼쪽**을 본다.
  - 머리 중심은 캔버스 세로 40~50% 높이에 둔다.
  - 고양이는 캔버스 왼쪽 70% 안에서 끝나야 한다(왼쪽 30%는 투명). 그래야 말풍선과 겹치지 않는다.
- **세 장은 머리 위치, 크기, 구도를 똑같이** 맞추고 표정과 자세만 바꾼다. 같은 자리에서 바꿔 끼우기 때문이다.
  - `peek`: 부탁하는 얼굴. 성격대로 그린다.
    - 후와: 반쯤 감은 눈으로 시큰둥하게 요구.
    - 슈리: 눈 반짝이며 앞발 흔들기.
    - 나비: 고개 살짝 갸웃하며 공손하게.
  - `peek-happy`: 받아서 기쁨.
    - 후와: 티 안 내려다 살짝 만족.
    - 슈리: 활짝 웃음.
    - 나비: 눈 감고 미소.
  - `peek-sulk`: 못 받아서 삐짐. 귀를 뒤로 젖히고 고개를 살짝 돌린다.
    - 후와: 시큰둥 더 심하게.
    - 슈리: 볼 부풀리기.
    - 나비: 시무룩.

### 2. 얼굴 — `<id>-face.png` (256×256)

동그랗게 잘라 쓰는 작은 얼굴이다. 부탁 칩(30px), 판 소개 "오늘의 손님"(42px)에 들어가고, 후와 얼굴은 특수 블록 "후와 싹쓸이"의 노란 동그라미 안(약 40~60px)에도 들어간다.

- 정면 얼굴, 평소 표정. 머리가 캔버스의 80%를 채우게 그린다.
- 가운데 원형으로 잘라도 귀 끝과 볼이 거의 잘리지 않게 그린다.

### 3. 후와만 — `fuwa-sit.png`, `fuwa-cheer.png` (512×512)

- `fuwa-sit`: 정면으로 앉은 전신 그림(기준 그림 `fuwa-pose-sit-front` 참고), 가게 주인 느낌. 쓰이는 곳은 두 군데다.
  - 지도에서 지금 판 위에 둥실 떠 있는 표시(66px)
  - 판 시작 창 맨 위(120px)
- `fuwa-cheer`: 이겼을 때 창 맨 위(120px). 앉은 채 꼬리를 세우고 살짝 뿌듯한 얼굴이다(웃음은 크지 않게).

## 그림 AI에 붙여 넣을 문장

기준 그림 URL에서 해당 고양이 `front`와 `three-quarter`를 받아 **이미지로 첨부**한 뒤, 아래 문장의 `<…>` 를 채워 쓴다.

```text
Use case: game character sprite. Input images are the canonical identity references for <NAME>, a real cat: <APPEARANCE from the table above, in English>.
Draw <NAME> for a cute casual match-3 puzzle game, in a soft 2D cartoon style with a clean dark-brown (#3a2a22) outline of medium weight, simple readable shapes that still read at 30–120px. Keep this cat's exact coat colors, markings, eye color and build from the references; not a generic cat.
Pose: <POSE from this document>. Expression: <EXPRESSION>.
Canvas <SIZE> square. Genuine transparent background with clean alpha. No ground, no shadow, no glow, no scenery, no text, no watermark, no frame, one cat only, one pose only.
```

빼꼼용 구도 문장(Pose 자리에 넣는다):

```text
Peeking in from the RIGHT edge of the canvas: the body is cut off by the right canvas edge as if hiding behind a wall, only the head and one or two front paws lean out to the left, face and gaze turned to the LEFT. Head center at 40–50% of canvas height. The cat stays within the right 70% of the canvas; the left 30% is empty transparent space.
```

결과에 배경이나 빛 번짐이 남으면 한 번 더 이렇게 시킨다:

```text
Edit the provided sprite: keep the cat, pose, face, colors, style and framing exactly. Remove everything outside the cat silhouette — background, glow, haze, shadow — to fully transparent alpha. No matte fringe, no checkerboard.
```

## 받은 뒤 확인할 것 (개발 쪽)

- 세 마리 빼꼼의 머리 위치와 크기가 같은가?
- 120px에서 표정이 구분되는가?
- 30px 얼굴에서 누군지 알아볼 수 있는가?
- 밝은 화면과 어두운 화면 모두에서 테두리가 보이는가?
- 코드 연결: 빼꼼을 눕혀 쓰던 회전을 없애고, 표정마다 그림을 바꾸고, 얼굴 잘라 쓰기를 `-face`로 바꾸고, 지도 표시·창 그림·특수 블록을 교체한다.


## 후와 빼꼼 승인본 및 연출 제안

- 사용자 검토를 거친 기본 빼꼼 승인본: `snack-pop/assets/cats/fuwa-peek.png`.
- 이 커밋은 승인된 이미지 원본을 변경 없이 보관한다. PNG RGBA, **1254×1254**이며 위 요청 규격인 512×512로 아직 변환하지 않았다.
- 알파 채널은 있지만 왼쪽 30% 여백에 알파 1/255의 미세한 잔여 픽셀이 있다. 완전 투명 여백 규격은 아직 충족하지 않으므로, 게임 통합 시 잔여 알파 정리와 512×512 내보내기 및 120px 가독성 검사를 진행한다.
- 현재 추가한 파일은 정지 그림 1장뿐이다. WebP 변환, 기존 그림 교체, 게임 코드 연결 및 애니메이션은 **이 커밋에서 구현하지 않았다**.

### 제안: 등장 → 깜빡임 → 퇴장 (미구현)

오른쪽 화면 밖에서 자연스럽게 들어와 잠시 머무른 뒤, 눈을 한 번 천천히 깜빡이고 다시 오른쪽으로 나가는 연출을 제안한다. 시큰둥한 기본 표정과 머리 위치는 유지한다. 등장·퇴장은 위치 이동으로 만들고, 깜빡임은 같은 구도의 눈 감은 추가 프레임을 준비한 뒤 교체하는 방식이 적합하다. 현재 승인본만으로 눈 깜빡임이 완성된 것은 아니다.

## 게임에 넣은 것 (2026-11-18)

- `fuwa-peek.png`(원본은 그대로 둠)
  - 알파 8 미만 잔여 픽셀을 지웠다.
  - 512×512로 줄여 `fuwa-peek.webp`(30KB)로 만들었다.
  - 같은 그림에서 얼굴을 잘라 `fuwa-face.webp`(256×256)를 만들었다. 전용 얼굴 그림이 오면 바꾼다.
- 빼꼼
  - 전용 그림이 있는 고양이는 눕히지 않고 오른쪽에서 밀어 넣기만 한다. 140px로 보인다.
  - 기뻐함은 통통 뛰고, 삐짐은 살짝 물러나 기운다. 표정 그림이 오기 전까지 같은 그림을 쓴다.
- 얼굴: 부탁 칩, "오늘의 손님", 특수 블록 "후와 싹쓸이"가 `fuwa-face.webp`를 쓴다.
- 슈리·나비는 아직 빌린 그림이다(전용 그림이 없으면 예전 방식으로 대신 쓴다). 지도 표시와 창 그림도 아직 빌린 그림이다.


## 추가 고양이 원본 13장 (2026-11-18)

기존 승인 후와 기본 빼꼼을 유지하고, 다음 PNG 원본을 추가했다. 실사 정면·3/4 기준과 후와 승인본을 참조했으며, 같은 기본 빼꼼을 편집하여 기쁨·삐짐을 만들었다.

- 후와: `fuwa-peek-happy.png`, `fuwa-peek-sulk.png`, `fuwa-face.png`, `fuwa-sit.png`, `fuwa-cheer.png`
- 슈리: `shuri-peek.png`, `shuri-peek-happy.png`, `shuri-peek-sulk.png`, `shuri-face.png`
- 나비: `nabi-peek.png`, `nabi-peek-happy.png`, `nabi-peek-sulk.png`, `nabi-face.png`

저장 위치는 모두 `snack-pop/assets/cats/`. **이 추가 커밋은 그림 원본 납품만이며 게임 연결은 바꾸지 않는다.** 기존 WebP 및 코드 연결은 그대로 보존했다. 새 PNG가 자동으로 게임에 적용된다고 가정하지 않는다.

### 실제 파일 검사와 통합 시 남은 작업

이미지 생성기가 지정 크기 대신 1254×1254를 출력했다. 아래는 실제 검사값이며 아직 요청서의 512×512/256×256 배포 규격을 충족하지 않는다. PNG에 진짜 알파 채널이 있지만 빼꼼 여백에 알파 1/255 수준 잔여 픽셀이 남을 수 있다. 개발 통합 단계에서 기존 후와와 같은 알파 정리·크기 변환·WebP 생성이 필요하다. 캐릭터별 구도와 표정은 육안 검사했으며 픽셀 단위 동일 정렬, 30px 원형 얼굴 크롭, 실제 게임 화면 가독성은 별도 검증해야 한다.

| 파일 | 원본 크기 | 모드 | 왼쪽 30% 최대 알파(0~255) |
|---|---|---|---|
| `fuwa-cheer.png` | 1254×1254 | RGBA | 해당 없음 |
| `fuwa-face.png` | 1254×1254 | RGBA | 해당 없음 |
| `fuwa-peek-happy.png` | 1254×1254 | RGBA | 1 |
| `fuwa-peek-sulk.png` | 1254×1254 | RGBA | 1 |
| `fuwa-peek.png` | 1254×1254 | RGBA | 1 |
| `fuwa-sit.png` | 1254×1254 | RGBA | 해당 없음 |
| `nabi-face.png` | 1254×1254 | RGBA | 해당 없음 |
| `nabi-peek-happy.png` | 1254×1254 | RGBA | 1 |
| `nabi-peek-sulk.png` | 1254×1254 | RGBA | 1 |
| `nabi-peek.png` | 1254×1254 | RGBA | 1 |
| `shuri-face.png` | 1254×1254 | RGBA | 해당 없음 |
| `shuri-peek-happy.png` | 1254×1254 | RGBA | 1 |
| `shuri-peek-sulk.png` | 1254×1254 | RGBA | 1 |
| `shuri-peek.png` | 1254×1254 | RGBA | 1 |

눈 깜빡임 전용 프레임과 애니메이션은 이번 그림 목록에 포함하지 않았다. 기존의 등장→깜빡임→퇴장 문단은 계속 제안이며, 이 커밋에서 구현한 연출이 아니다.

## 13장 게임 연결 (2026-11-18)

- 변환: 알파 8 미만 정리 후 WebP로 만들었다.
  - 빼꼼 512px(20~35KB)
  - 얼굴 256px. 동그라미에 맞게 얼굴 가운데를 채워 자름. 후와는 갈기를 덜 넣는다.
  - 앉음·응원 360px
- 연결
  - 빼꼼은 표정별 그림이다: 부탁·인사는 `-peek`, 고마워는 `-peek-happy`, 삐짐은 `-peek-sulk`. 판 시작 때 세 장을 미리 받아 둔다.
  - 눕혀 쓰던 회전과 빌린 그림(`cat-outing/cats`)은 모두 걷어냈다.
  - 얼굴은 `<id>-face.webp`를 통째로 쓴다(부탁 칩, 오늘의 손님, 후와 싹쓸이).
  - 지도의 현재 판 표시는 `fuwa-sit`(76px), 이긴 창은 `fuwa-cheer`이다.
- 확인(Orca): 1판 후와 고마워, 2판 슈리 부탁, 3판 나비 삐짐 빼꼼과 부탁 칩 얼굴, 지도 표시. 이긴 창 그림은 경로만 바꿨고 화면으로는 보지 않았다.
