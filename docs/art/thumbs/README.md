# 게임 카드 키 아트

내장 이미지 생성 도구로 게임마다 후보 두 장을 만들었다. 검토용 후보 PNG는 `.thumb-candidates/`에 둔다. 채택한 그림은 중앙에서 정확한 16:10으로 몇 픽셀 잘라 이 폴더에 보관했다. 배포용 WebP는 루트에서 `node tools/make-thumbs.mjs`로 다시 만든다.

## 기준 그림

- [고양이별 기준 그림과 설명](https://fuwa.dad/assets/ref/index.json) · [후와네 사이트 안내](https://fuwa.dad/llms.txt)
- 나들이에는 [후와 ¾](https://fuwa.dad/assets/ref/fuwa/fuwa-three-quarter.png), [슈리 ¾](https://fuwa.dad/assets/ref/shuri/shuri-three-quarter.png), [나비 ¾](https://fuwa.dad/assets/ref/nabi/nabi-three-quarter.png) 원본과 `cat-outing/cats/01-1.webp`, `cat-outing/cats/04-1.webp`를 첨부했다.
- 간식에는 [후와 정면](https://fuwa.dad/assets/ref/fuwa/fuwa-front.png)과 `snack-pop/assets/cats/fuwa-peek-happy.png`를 첨부했다. 간식 모양과 색은 `snack-pop/js/render/sprites.js`를 참고했다.
- 달리기에는 후와 ¾·정면 원본과 `cat-runner/assets/moonlit-alley-v1.png`를 첨부했다.

## 선정

- **고양이 나들이** 1번의 밝은 문이 오른쪽에 있고, 세 고양이가 서로 다른 바닥 칸을 따라 같은 방향을 바라봐 퍼즐 장면이 읽힌다. 후와의 회베이지 장모와 갈기, 슈리의 갈색 고등어 줄무늬와 고리 꼬리, 나비의 짙은 턱시도 무늬와 흰 주둥이·발, 각 고양이의 눈 색을 기준 그림과 대조했다.
- **간식 팡팡 1번** 후와가 앞발을 걸치고 올라다보는 모습과 여섯 간식의 모양이 카드 크기에서도 읽힌다. 회베이지 장모, 갈기, 귀끝 털, 분홍 코, 황록빛 눈매를 기준 그림과 대조했다.
- **후와 달리기 2번** 달빛을 등진 후와의 앞뒤 다리가 길게 뻗고 발 아래로 하늘이 보여 도약이 읽힌다. 풍성한 꼬리와 목 갈기, 이마의 짙은 무늬를 살렸고 생선·별·민트색 시간 포션이 진행 방향을 보여 준다.

## 생성 프롬프트

### 고양이 나들이

```text
New 16:10 landscape app store game illustration. Attachments 1–3 define cat appearance, 4–5 define thick dark brown lines and flat cel style. Three cats on staggered warm checkerboard wooden floor lanes head for a sunlit open door with green garden; mint sofa. Fuwa is fluffy taupe gray and beige with huge cream ruff, plume tail, tufted ears, gray forehead markings, yellow-green eyes, pink nose. Shuri is a slim brown mackerel tabby with tall ears, M forehead, narrow black stripes, black rings and tip on tail, yellow-green eyes and pink nose. Nabi is a charcoal tuxedo with white muzzle, bib, belly and paws, yellow eyes, black nose and small black dot under mouth. Clearly show all faces above bottom fifth; spare empty floor below. Cream highlights, moderate saturation, big readable shapes. No people, photo, text, logos, watermark, UI, borders.
```

각 후보에는 아래 구도 지시를 하나씩 덧붙였다.

1. Isometric view with sunny door upper right, three distinct staggered lanes.
2. Dollhouse angle with centered sunny door, Fuwa prominent left facing threshold, Shuri and Nabi around the corner.

### 간식 팡팡과 후와 달리기

아래 공통 프롬프트 뒤에 게임별 프롬프트와 후보별 구도 지시를 붙였다.

```text
Draw one brand-new polished 2D cartoon game key art landscape, ideally exactly 16:10. Crisp bold dark brown outline on hero, flat cel colors, warm cream highlights and controlled medium-bright saturation, clean big shapes readable at 300 pixels. Put faces and all essential features above bottom 20%; bottom is quiet expendable scenery. No humans, photography, letters, symbols resembling text, logos, watermark, UI, border, or collage. Physical-appearance attachments are identity references only, redraw as cartoon. Fuwa is a gray-brown/taupe and beige longhair with enormous cream-beige neck ruff, very bushy taupe plume tail, tufted ears, gray forehead stripes with beige muzzle, yellow-green eyes, pink nose, and slightly unimpressed almond eye shape. Preserve the pictured coat map.
```

#### snack-pop

```text
First attachment is Fuwa appearance, second is the character's in-game cartoon drawing style. Only Fuwa. Happy peek with softened eyes, both paws gripping a block. An explosion of six distinctly readable outlined match pieces: blue fish, yellow bell, pink yarn ball, orange paw cookie, purple star candy, green leaf. Show a small group of rounded square pieces still lined up beside the bright impact and others flying off with sparkling motion. Warm rose, coral and golden colors, quiet rose lower fifth.
```

1. Fuwa peeks in from the upper right, match blast at left center, clean peach-pink diagonal composition.
2. Fuwa's face at upper left and a diagonal explosion expands toward upper right, with lavender and strawberry colors.

#### cat-runner

```text
First two references are Fuwa's identity; third is the moonlit Korean hanok setting. Show only Fuwa, springing forcefully upward across the gap over a tiled hanok roof and a stone garden wall. Clear silhouette of fully airborne cat with front paws reaching diagonally upward forwards and hind legs extended visibly backwards lower, huge streaming tail, visible sky gap between paws and rooftops. Face and full body high in frame. Ahead, three distinct collectible icons: a small blue fish, a golden star, and a mint-green corked time potion with tiny hourglass inset. Midnight teal/blue with warm amber paper windows and cream moon rim-light; bright readable midtones and uncluttered lower fifth of rooftops.
```

1. Side three-quarter view towards the right, crescent upper left, jump boldly from center-left to upper-right.
2. Low-angle view, leaping rightward across the moonlit alley, long forward-reaching foreleg silhouetted against pale moonlight.
