# 가라온 브로즈 — 개발 작업 내역서

> 날짜: 2026-03-01 ~ 2026-03-02
> 총 커밋: 82건
> 프로젝트 경로: `C:\dev\office-ai\garaon-bros\`
> 배포: https://office-ai.app/garaon-bros/index.html

---

## 주요 파일 구조

| 파일 | 역할 |
|------|------|
| `index.html` | 메인 (체크인/세션/홈) + iframe SPA 네비게이션 |
| `gbhq.html` | 관리자 페이지 (방문자/게임/설정/방문기록 관리) |
| `recommend.html` | 보드게임 추천 |
| `review.html` | 방문자 후기 |
| `pixel-base.html` | 픽셀 기지 (미니게임) |
| `upload.html` | QR 촬영 업로드 (모바일용, 토큰 기반 일회용) |
| `js/config.js` | 설정 (Supabase, Telegram, Spotify 웹훅) |
| `js/music-player.js` | Spotify 배경음악 플레이어 (전 페이지 공유) |
| `js/app.js` | 공통 유틸 |

---

## 기능별 상세 내역

### 1. 텔레그램 연동

#### 1-1. 집주인 호출 → 텔레그램 알림
- **파일**: `index.html`
- **커밋**: `108f786`
- **동작**: 아이들이 간식 호출 → Telegram Bot API `sendMessage` + 인라인 키보드(확인/거절) → `getUpdates` 폴링으로 응답 감지
- **관련 함수**: `callAdmin()`, `pollTelegramReply()`

#### 1-2. 집주인 → 아이들 역방향 메시지
- **파일**: `index.html`
- **커밋**: `e0e5dff`, `3ccac47`
- **동작**: 부모가 텔레그램으로 텍스트 전송 → `getUpdates` 폴링 → 웹앱 모달 + 알림음(Web Audio API 사인파) → 아이가 확인 클릭 → 텔레그램에 "✅ 아이들이 확인했어요!" 전송
- **관련 함수**: `pollOwnerMsg()`, `showOwnerMsg()`, `closeOwnerMsg()`, `playNotificationSound()`
- **특이사항**: `_ownerUpdateOffset` 통합 폴링 (호출 응답 + 역방향 메시지 동시 처리)

### 2. 호출 메뉴 솔드아웃(품절)
- **파일**: `gbhq.html`, `index.html`
- **커밋**: `f8ebb07`
- **DB**: `call_menu.is_soldout` 컬럼 (boolean)
- **동작**: 관리자 설정에서 품절 토글 → 호출 모달에서 품절 아이템 그레이아웃 + "품절" 배지 + 클릭 불가
- **관련 CSS**: `.call-item.soldout`

### 3. 방문자 프로필 사진/아바타
- **파일**: `gbhq.html`
- **커밋**: `50fda60`, `9f00ccb`
- **DB**: `visitors.photo_url` 컬럼 추가
- **동작**: 방문자 추가/수정 시 라디오 버튼으로 이모지 아바타 vs 실제 사진 선택 → 사진은 QR 촬영(`openQrUpload` 콜백 패턴) → Supabase Storage 저장
- **관련 함수**: `openVisitorPhotoQr()`, `switchProfileTab()`, `enablePhotoRadio()`

### 4. QR 촬영 업로드 시스템
- **파일**: `upload.html`, `gbhq.html`
- **커밋**: `aaa54bc`
- **동작**: 토큰 생성(`upload_tokens` 테이블) → QR 코드 표시 → 모바일 스캔 → 카메라 촬영 → Supabase Storage 업로드 → 폴링으로 완료 감지 → 콜백 실행
- **범용 패턴**: `openQrUpload(callback, title)` — 게임 사진, 프로필 사진, 단체사진에 재사용

### 5. 방문기록 카드형 UI
- **파일**: `gbhq.html`
- **커밋**: `2a74948`, `269bbef`
- **DB**: `visit_photos` 테이블 (id, visit_date, photo_url, caption, created_at)
- **동작**: 날짜별 카드에 방문자 얼굴(사진/아바타), 체류시간, 간식 요약, 단체사진 갤러리 표시
- **단체사진**: QR 촬영 업로드, 날짜당 최대 5장, X 버튼 삭제
- **관련 함수**: `loadVisitHistory()`, `addVisitPhoto()`, `deleteVisitPhoto()`
- **관련 CSS**: `.vh-card`, `.vh-face`, `.vh-card-photo-wrap`

### 6. Spotify 배경음악 플레이어
- **파일**: `js/music-player.js`
- **커밋**: `9b6a78b`, `bbe8e4c`, `5819e19`
- **UI**: 상단 고정 바 (44px) + 검색/프리셋 슬라이드 패널 + Spotify embed iframe
- **기능**:
  - 프리셋 플레이리스트 8개 (파티, 힐링, 보드게임, 8bit 등)
  - Spotify 검색 (n8n 웹훅 프록시 → Spotify API) — 곡/앨범/플레이리스트
  - localStorage로 마지막 선택 기억 + 자동 복원
  - 배너 모드 / 확장(재생목록) 모드 전환
- **n8n 웹훅**: `POST https://jknetworks.app.n8n.cloud/webhook/spotify-search`

### 7. 페이지 이동 시 음악 유지 (iframe SPA)
- **파일**: `js/music-player.js`, `index.html`
- **커밋**: `52e5287`, `7a1265c`
- **동작**:
  - index.html에서 서브 페이지 클릭 → `<iframe>` 안에 로드 (음악 플레이어는 부모에 유지)
  - 서브 페이지 내 홈 버튼 → `postMessage('gb-close-iframe')` → iframe 닫기
  - 서브 페이지 간 이동 → `postMessage({type:'gb-navigate', href})` → 부모가 iframe src 교체
  - 서브 페이지 직접 접속(URL/북마크) → `index.html?sub=` 으로 리다이렉트 후 iframe 로드
  - `onclick="location.href=..."` 도 인터셉트
- **관련 HTML**: `#gb-subpage-wrap`, `#gb-subpage-frame`

### 8. 설정 패널 정리 + 이모지 피커
- **파일**: `gbhq.html`
- **커밋**: `ac8c2da`
- **변경**: n8n 웹훅 URL 수동 입력 섹션 제거, 메뉴 추가 시 이모지 선택 그리드 (30개 프리셋)

### 9. 기타 (이전 세션 포함)
- 보드게임 정보 관리 (추가/수정/삭제, AI 검색, Wikipedia 이미지)
- 방문자 체크인/아웃, 세션 관리, 이용시간 기록
- 보드게임 추천 시스템 + 후기
- 픽셀 기지 (미니게임)
- YouTube 검색/인라인 재생
- 카테고리 분류 (균형/스킬/경쟁/기억/창의/언어/공포/롤플레이)
- 비밀번호 진입 (일반: 0910, 관리자: 0727)

---

## Supabase 테이블 (가라온브로즈)

| 테이블 | 용도 |
|--------|------|
| `visitors` | 방문자 (name, nickname, avatar, photo_url, age_group, gender) |
| `visit_logs` | 방문 기록 (visitor_id, visit_date, check_in, check_out, duration_min) |
| `visit_photos` | 단체사진 (visit_date, photo_url, caption) |
| `games` | 보드게임 정보 |
| `reviews` | 방문자 후기 |
| `call_menu` | 호출 메뉴 (label, emoji, is_soldout) |
| `call_history` | 호출 기록 (visit_date, item_label, item_emoji, qty, note) |
| `upload_tokens` | QR 업로드 토큰 (token, used, image_url) |
| `settings` | 앱 설정 (key-value) |

## 외부 서비스

| 서비스 | 용도 |
|--------|------|
| Supabase (`mkmxhmoocqnkltjxdfbm`) | DB + Storage + Auth |
| Telegram Bot (`8602303372`) | 집주인 호출/메시지 |
| n8n (`jknetworks.app.n8n.cloud`) | Spotify 검색 프록시, 호출 웹훅 |
| Netlify (`elaborate-cendol-e22a61`) | 정적 배포 |
| Spotify Embed | 배경음악 재생 |
