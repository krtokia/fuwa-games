# 후와 게임 — game.fuwa.dad

빌드 없는 정적 사이트. Cloudflare Pages 가 main 을 그대로 배포한다.

- `/` — 게이트웨이(게임 목록). 게임을 추가하면 `index.html` 의 `.games` 에 카드를 하나 더 넣는다.
- `/cat-outing/` — 고양이 나들이. 고양이 그림은 `cat-outing/cats/<번호>-<칸수>.webp`(320px, 위를 보는 모습, L칸이면 세로 L배). 원본 512px PNG 는 GPT 가 up.fuwa.dad 로 올린 것.

새 게임은 폴더 하나(`/<이름>/index.html`)로 넣는다. 경로는 폴더 안 상대 경로로 쓸 것.
