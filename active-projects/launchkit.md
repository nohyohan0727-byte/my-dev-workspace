# LaunchKit - Active Project

## 현재 상태: 프론트엔드 안정화 진행 중

## 2026-03-06 완료 작업

### 1. 수정 요청 리다이렉트 루프 수정
- 원인: result.html "수정 요청" -> interview.html -> status ir_done/complete -> result.html 무한 루프
- 수정: goEdit()에 edit=1 파라미터 추가, loadExistingProject에서 edit 모드 감지 시 상태 무관하게 채팅 진입
- 파일: `launchkit/result.html`, `launchkit/interview.html`

### 2. generating 상태 추가 (이탈 보호)
- confirmYes() 시작 시 DB status -> generating 변경
- 이탈 후 재진입 시 generating 감지 -> 생성 화면 + 5초 폴링 -> 완료 시 자동 이동
- 에러 시 status -> confirming 복원
- 최대 5분 타임아웃

### 3. result.html에 프로젝트 목록 링크 추가
- topbar에 "프로젝트 목록" 링크 추가

### 4. 이벤트 중복 바인딩 수정
- onclick + addEventListener 이중 실행 제거
- sync XHR -> async fetch 변환

### 5. 기타
- 테스트 계정 토큰 10,000으로 충전
- 전체 서비스 로고에 office-ai.app 홈 링크 추가

## 다음 작업
1. 랜딩페이지 디자인 AI 솔루션 변경 (GPT-4o 퀄리티 한계 -> 디자인 전문 AI로 교체)
2. 상세 랜딩 실제 생성 테스트 (프롬프트 배포됨, 테스트 미완료)
3. 에러 핸들링: Prepare 에러 시 IF 노드로 CallOpenAI 건너뛰기
4. 런칭(URL 생성) 기능 (보류)

## 테스트 계정
- logintest@test.com / test0727
- 토큰: 10,000 (충전됨)

## 관련 파일
- `C:\work\office-ai\launchkit\` (전체)
- `launchkit/interview.html` - 인터뷰 + 수정 + 생성 흐름
- `launchkit/result.html` - 결과 미리보기
- `launchkit/HANDOFF.md` - 상세 핸드오프
