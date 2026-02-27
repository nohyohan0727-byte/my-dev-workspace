# [2026-02-27 오후] admin-upload.html 보안·기능 완성

| 항목 | 내용 |
|------|------|
| **작업자** | nohyohan0727-byte + Claude (Sonnet 4.6) |
| **상태** | ✅ 완료 |

---

## 배포된 페이지 URL 목록

| 페이지 | URL | 설명 |
|--------|-----|------|
| 메인 | https://office-ai.app | 홍보 홈페이지 |
| 데모 | https://office-ai.app/demo.html | RAG 챗봇 체험 |
| 등록 | https://office-ai.app/register.html | 유저 등록 + API 키 발급 |
| 관리자 업로드 | https://office-ai.app/admin-upload.html | 문서 업로드 (관리자 전용) |

---

## n8n 워크플로우 현황

| 워크플로우 | ID | 엔드포인트 | 상태 |
|-----------|-----|-----------|------|
| RAG-3-User-Registration | i5zSroOP6ZZ6g_w8bHBFs | POST /rag-register | ✅ Active |
| RAG-4-Secure-Chat-FIXED | DUhC36eo7SJNw2Wc | POST /rag-category-chat | ✅ Active |
| RAG-Webhook-Admin-Upload | BnNM5zFuBsqrSyeM | POST /admin-upload | ✅ Active |
| RAG-Admin-Category-List | B2c5XBa9iW0GTVUB | POST /admin-categories | ✅ Active |

---

## 관리자 키

```
admin_JKN_7kX2pM9vR5tN3wQ8
```
> n8n `RAG-Webhook-Admin-Upload` 및 `RAG-Admin-Category-List` 워크플로우의 `Validate Admin Key` 코드 노드 안에 저장됨

---

## 구글시트 구조

| 시트 용도 | 시트 ID |
|----------|---------|
| 유저 목록 (RAG 인증용) | `1pth-I92vh4SmwILpAlKzeSeiwTrBNrdUcBLgTEJ8mas` |
| 유저 토큰 차감 (RAG-4) | `1ObjurBWNTlMT7jHQns8VpVO82IkOcG6lwSGDBdCnmWU` |
| 업로드 이력 (Admin Upload) | `1pth-I92vh4SmwILpAlKzeSeiwTrBNrdUcBLgTEJ8mas` (Sheet1) |

### 유저 목록 컬럼
`user_id` | `name` | `email` | `api_key` | `status` | `expires_at` | `tokens_total` | `tokens_used` | `created_at`

### 업로드 이력 컬럼
`업로드시간` | `파일명` | `프로젝트` | `테이블` | `파일크기(bytes)` | `업로드ID` | `상태`

---

## 작업 상세

### 1. admin-upload.html 신규 생성
- 드래그&드롭 파일 선택 (다중 업로드)
- 카테고리 필수 선택 + `기타` 직접 입력 (카테고리명 + RAG 테이블명)
- 업로드 진행 상태 실시간 표시 (성공/실패 로그)
- 지원 파일: PDF, TXT, DOCX, MD, CSV, XLSX, PPTX, HWP

### 2. 보안: 서버사이드 admin_key 검증
- 기존: HTML 소스에 비밀번호 하드코딩 (`jknetworks2026!`) → 소스 보기로 노출
- 변경: n8n 워크플로우에서 admin_key 검증, HTML에 키 없음
- 로그인 시 n8n 호출 → 인증 실패 시 401, 성공 시 sessionStorage 저장

### 3. n8n RAG-Webhook-Admin-Upload 수정
추가된 노드:
- `Validate Admin Key` (Code): admin_key 검증 + 원본 데이터 pass-through (`...input`)
- `Is Admin?` (IF): `$json.authorized === true` 분기
- `Return Admin 401` (RespondToWebhook): 인증 실패 응답

수정된 노드:
- `Base64 to Binary`: `_validate_only: true` 처리 추가 (파일 없이 키만 검증 가능)

연결 구조:
```
Webhook → Validate Admin Key → Is Admin? → Base64 to Binary → Upload to Drive
                                         ↘ Return Admin 401   ↘ Supabase Vector Store
                                                               ↘ Prepare Log → Log to Sheets
                                                                           ↓
                                                               Respond to Webhook
```

### 4. n8n RAG-Admin-Category-List 신규 생성
- `POST /webhook/admin-categories`
- admin_key 인증 후 업로드 이력 시트 전체 읽기
- 기본 카테고리 7개 제외, 커스텀 카테고리만 중복 제거하여 반환
- admin-upload.html 로그인 시 자동 호출 → 드롭다운에 이전 카테고리 표시

### 5. demo.html API 키 보안 개선
- 기존: `register.html` → `demo.html?api_key=xxx&name=xxx` (URL에 키 노출)
- 변경: sessionStorage에 저장 후 clean URL로 이동
- URL에 파라미터가 있으면 즉시 sessionStorage로 이전 + `history.replaceState`로 URL 정리

### 6. 신규 유저 토큰 100개 제한
- `RAG-3-User-Registration` 워크플로우 `Check & Prepare` 노드
- `tokens_total: 1000` → `tokens_total: 100`
- 과부하 방지 목적

### 7. 토큰 소진 안내 메시지
- demo.html 에러 처리에 연락처 추가
- "토큰 추가 구매 문의: 제이케이네트웍스 대표 노진광 📞 010-3127-4528"

---

## 발견된 버그 및 수정

| 버그 | 원인 | 수정 |
|------|------|------|
| 업로드 "object is not iterable" 에러 | `Validate Admin Key`가 `{authorized:true}`만 반환, 원본 파일 데이터 소실 | `{...input, authorized:true}` pass-through로 수정 |
| 로그인 검증 시 500 에러를 성공으로 오인 | `_validate_only`일 때 `fileContent` 없어서 에러 발생 | `Base64 to Binary`에 `_validate_only` 조기 반환 처리 추가 |

---

## 다음 작업 제안

- [ ] admin-upload.html DOCX 실제 업로드 테스트 (Supabase 저장 확인)
- [ ] 구글시트 업로드 이력 시트 헤더 확인 (한글 컬럼명 깨짐 여부)
- [ ] RAG-Admin-Category-List가 반환하는 카테고리 목록 실제 확인
- [ ] demo.html 카테고리별 RAG 동작 전체 테스트
