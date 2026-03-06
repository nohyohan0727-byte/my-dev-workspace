# 2026-03-06 LaunchKit 프론트엔드 안정화

## 완료 작업

### 수정 요청 리다이렉트 루프 수정 (핵심 버그)
- **원인**: result.html에서 "수정 요청" 클릭 -> interview.html?id=X 이동 -> loadExistingProject에서 status가 ir_done/complete -> result.html로 리다이렉트 -> 무한 루프
- **수정**:
  - result.html goEdit()에 `&edit=1` 파라미터 추가
  - interview.html loadExistingProject에서 edit 모드 감지 시 상태와 무관하게 채팅 진입
  - DB status를 interview로 변경

### generating 상태 추가 (이탈 보호)
- confirmYes() 시작 시 DB status -> `generating` 변경
- loadExistingProject에서 `generating` 감지 -> 생성 진행 화면 + 5초 간격 Supabase 폴링
- ir_done/complete 감지 시 result.html 자동 이동
- 에러 시 status -> confirming 복원
- 최대 60회(5분) 폴링 후 타임아웃

### 이벤트 중복 바인딩 수정
- confirm 버튼의 onclick 속성 + addEventListener 이중 실행 제거
- confirmEdit() sync XHR -> async fetch 변환

### result.html 네비게이션 개선
- topbar에 "프로젝트 목록" 링크 추가

### 기타
- 테스트 계정 tokens_total: 10,000 / tokens_used: 0 설정
- 전체 서비스(dev-console, launchkit, trustrag, reference) 로고에 office-ai.app 홈 링크 추가

## 커밋 이력
1. `08beb9e` - 각 서비스 로고에 office-ai.app 홈 링크 추가
2. `bdf0b8d` - 수정요청 버그 수정 - 이벤트 중복/sync XHR 제거
3. `65e2349` - 수정모드 sessionStorage 백업
4. `aad077d` - result.html에 프로젝트 목록 돌아가기 링크 추가
5. `440275b` - 수정요청 리다이렉트 루프 근본 수정
6. `0e100ef` - generating 상태 추가 - 이탈 시 중복생성/토큰낭비 방지
