# 2026-03-07: Claude Manager 개발현황 개선

## 완료 작업

### 1. 업무별 뷰 프로젝트 필터 탭 추가
- 대시보드 stats와 진행중 섹션 사이에 프로젝트 필터 pill 버튼 배치
- "전체" + 각 프로젝트명 버튼, 프로젝트별 고유 색상(projColors 배열) 적용
- 클릭 시 해당 프로젝트 태스크만 필터링, stats도 동적 업데이트
- 수정 파일:
  - `public/index.html` (L377: dt-project-filter div)
  - `public/js/app.js` (dtFilterProject 상태, dtSelectProject(), dtRenderTaskView() 필터 로직)
  - `public/css/style.css` (dt-proj-filter, dt-proj-filter-btn 스타일)

### 2. Claude Manager 태스크 데이터 등록
- `data/dev-tasks.json`의 proj_cm에 10개 태스크 추가
  - 완료 9개: 초기 구축, 라이선스, 성장 단계, 작업실 채팅, 브레인스토밍, 개발현황, 초기설정, 필터 탭, 백업/복원
  - 예정 1개: 모바일 Dev Console
- path, runCmd 정보도 보충

### 3. active-projects 등록
- `active-projects/claude-manager.md` 생성

## 관련 파일
- `C:\work\claude-manager\public\index.html`
- `C:\work\claude-manager\public\js\app.js`
- `C:\work\claude-manager\public\css\style.css`
- `C:\work\claude-manager\data\dev-tasks.json`
- `C:\dev\my-dev-workspace\active-projects\claude-manager.md`
