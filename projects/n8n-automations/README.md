# n8n 자동화 프로젝트

> n8n으로 구축한 자동화 워크플로우 모음입니다.
> 각 워크플로우는 JSON으로 저장되어 있으며, n8n에서 import하면 바로 사용 가능합니다.

---

## 워크플로우 목록

| 이름 | 설명 | 상태 | 파일 |
|------|------|------|------|
| (준비중) | - | - | - |

---

## 워크플로우 추가 방법

1. n8n에서 워크플로우 완성 후 **Export to File** (JSON 다운로드)
2. `projects/n8n-automations/워크플로우명.json` 으로 저장
3. 같은 이름의 `워크플로우명.md` 설명 파일 작성
4. `WORK_HISTORY.md` 에 작업 이력 추가
5. git commit & push

---

## 워크플로우 import 방법

1. n8n 접속
2. 상단 메뉴 > **Import from File**
3. JSON 파일 선택

---

## n8n 연결 정보

- **Host**: `.env` 파일의 `N8N_HOST` 참고
- **API Key**: `.env` 파일의 `N8N_API_KEY` 참고

---

## office-ai 연동

구축된 자동화 솔루션은 office-ai 홈페이지에 소개됩니다.
소개 페이지 초안은 `../../notes/office-ai-solutions/` 에 작성하세요.
