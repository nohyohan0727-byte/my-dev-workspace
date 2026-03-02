# 2026-03-02: 가라온 브로즈 — 게임 지원 도구

## 완료 작업

### 신규 파일: game-tools.html
- 7개 인터랙티브 게임 도구 페이지 생성
  - **금지어 생성기**: 9개 카테고리(음식/동물/연예인/영화/일상/직업/스포츠/장소/국가수도), 문제수 설정, 제한시간 타이머+BGM
  - **카운트다운 타이머**: 원형 SVG 타이머, MI-style 긴장감 BGM, 10초 미만 빨간색+확대
  - **초성 퀴즈**: 8개 카테고리, 자동 초성 추출, 문제수 설정
  - **스피드 퀴즈**: 전체화면 모드, 터치+키보드 지원, BGM 포함
  - **5초 준다**: 10개 카테고리(일반/음식/동물/스포츠/연예인/지리/문화/학교/브랜드), 시간 설정, 스페이스바 성공 판정
  - **눈치 게임**: 1~15분 대기, 랜덤 시작, 반복 알림음
  - **속담 퀴즈**: 49개 속담(3단계 난이도), 2모드(빈칸형/몸으로설명)
- Web Audio API 효과음 6종 (chime/tick/buzzer/correct/thud/loudChime)
- MI-style 긴장감 BGM (square wave, 템포 변화)

### 버그 수정
- **뒤로가기 버그**: `goHome()` → `goToolsHome()` 이름 변경으로 music-player.js 충돌 해결
- **집주인 호출 알림 무한반복**: 60초 타임아웃 + visibility 감지 + 오버레이 상태 확인 추가
- **비밀번호 화면 겹침**: `#pw-screen` top:0 → top:44px (뮤직바 아래)

### UI 개선
- game-tools.html 전체 폰트 크기 30~40% 증가
- index.html 메뉴에 "게임 지원" 카드 추가 (골드 보더)

## 수정 파일
- `garaon-bros/game-tools.html` (신규, ~1500줄)
- `garaon-bros/index.html` (카드 추가, 알림 버그 수정, 비밀번호 화면 수정)
- `garaon-bros/js/music-player.js` (SUB_PAGES에 game-tools.html 등록)

## 커밋
- `45eb1f6` → origin/main 푸시 완료
