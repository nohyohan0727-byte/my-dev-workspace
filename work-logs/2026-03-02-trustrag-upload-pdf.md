# 2026-03-02: TrustRAG Storage 업로드 + PDF 텍스트 추출

## 세션 요약
Storage 업로드 파이프라인 구축 및 여러 이슈 수정 작업.
**오늘 세션 종료 시점에 미완료 이슈 있음** → 내일 바로 이어서 작업 가능하도록 상세 기록.

---

## 완료된 작업

### 1. get_file_url (다운로드) 완전 수정
- **문제**: `$helpers.httpRequest` 미지원, 빈 배열 0 items 흐름 차단
- **해결**: 단일 Code 노드에서 `this.helpers.httpRequest` 직접 사용
- **파일**: `C:\dev\my-dev-workspace\fix_file_url_final.mjs` (적용 완료)
- **테스트**: curl로 정상 응답 확인 ✅

### 2. Storage 업로드 방식 전환 (base64 → FormData)
- **문제**: 4.5MB 파일 → "Failed to fetch" (n8n JSON 웹훅 ~5MB 제한 초과)
- **추가 문제**: 한글 파일명 → Supabase InvalidKey (유니코드 키 불허)
- **해결**:
  - upload.html: `FileReader/base64` → `FormData` raw binary 전송
  - n8n: UUID 기반 storage_path (ASCII 안전)
  - Supabase 서명 업로드 URL 방식 → 동작 안 함 (현 버전 제약)
- **파일**: `C:\dev\my-dev-workspace\rebuild_upload_v2.mjs` (적용 완료)

### 3. n8n Upload 워크플로우 재구성
워크플로우 ID: `ZrdgEqchaCSoycyP`

**현재 흐름** (오늘 적용):
```
Upload Webhook → Extract Request (binary pass-through) → Validate Auth
→ Is Authorized? → Check Upload Permission → Can Upload?
→ Prepare Storage Upload (getBinaryDataBuffer 사용)
→ Extract Text (파일형식별 텍스트 추출)
→ Chunk Text → Get Chunk Embedding → Insert into Supabase
→ Aggregate Results → Save File Metadata → Write Audit Log → Return Response
```

### 4. chat.html 마크다운 + 다운로드 버튼
- marked.js + DOMPurify CDN 추가
- 봇 응답 마크다운 렌더링
- 소스 파일마다 ⬇ 다운로드 버튼 (get_file_url 호출)
- 배포 완료 ✅

---

## 🚨 오늘 세션 종료 시 미완료: 업로드 에러

### 에러 내용
```
Prepare Storage Upload 노드 실패
message: 파일 바이너리 읽기 실패: undefined [line 25]
```

### 근본 원인
**n8n Code 노드 task runner는 비인접 노드의 binary를 `getBinaryDataBuffer`로 읽지 못함**

현재 코드:
```js
// Prepare Storage Upload 노드 (line 25)
fileBuffer = await this.helpers.getBinaryDataBuffer($('Extract Request').first(), 'file');
//                                                  ↑ 3개 노드 이전 데이터 → 실패
```

`$('Extract Request')` 참조는 JSON은 동작하지만 binary는 n8n task runner에서 resolve 안 됨.
binary는 직전 노드(`$input`)에서만 직접 접근 가능.

### ✅ 수정 방법 (내일 바로 적용)

**원리**: n8n 내부에서 binary는 이미 base64로 저장됨 (`binary.file.data`가 base64 문자열).
Extract Request에서 이 base64를 JSON으로 복사해두면 모든 하위 노드에서 JSON으로 접근 가능.

**수정해야 할 스크립트**: `C:\dev\my-dev-workspace\rebuild_upload_v2.mjs`

**1단계 - Extract Request 노드 jsCode 변경:**
```js
const body = $input.first().json.body || $input.first().json;
const binary = $input.first().binary || {};

// binary.file.data = n8n이 내부 저장하는 base64 문자열
const fileBase64 = binary.file?.data || '';

return [{
  json: {
    api_key:    (body.api_key  || '').trim(),
    category:   body.category  || '',
    filename:   body.filename  || '',
    filesize:   Number(body.filesize) || 0,
    mimetype:   body.mimetype  || 'application/octet-stream',
    fileBase64,  // 하위 노드에서 JSON으로 접근
  },
  binary,  // pass-through (혹시 직접 접근 가능한 경우를 위해 유지)
}];
```

**2단계 - Prepare Storage Upload jsCode 변경** (`getBinaryDataBuffer` 제거):
```js
const req = $('Extract Request').first().json;
// ...
if (!req.fileBase64) throw new Error('파일 데이터 없음 (fileBase64)');
const fileBuffer = Buffer.from(req.fileBase64, 'base64');
// ... (나머지 동일)
```

**3단계 - Extract Text jsCode 변경** (마찬가지):
```js
const req = $('Extract Request').first().json;
const fileBuffer = Buffer.from(req.fileBase64 || '', 'base64');
// ... (나머지 동일)
```

---

## 파일 현황

| 파일 | 경로 | 상태 |
|------|------|------|
| upload.html | `C:\dev\office-ai\trustrag\upload.html` | FormData 방식 배포 완료 |
| chat.html | `C:\dev\office-ai\trustrag\chat.html` | 마크다운+다운로드 배포 완료 |
| rebuild_upload_v2.mjs | `C:\dev\my-dev-workspace\` | n8n 적용 완료, 위 수정 필요 |
| fix_file_url_final.mjs | `C:\dev\my-dev-workspace\` | 적용 완료 ✅ |

## n8n 워크플로우 ID

| 워크플로우 | ID |
|-----------|-----|
| TrustRAG_Upload | `ZrdgEqchaCSoycyP` |
| TrustRAG_Admin | `9c5kGAC7xHGXgvtX` |

## 내일 작업 순서

1. `rebuild_upload_v2.mjs` 열어서 Extract Request, Prepare Storage Upload, Extract Text 노드 코드 위 방법으로 수정 후 `node rebuild_upload_v2.mjs` 실행
2. upload.html에서 파일 업로드 테스트 (files 테이블 + Storage 버킷 확인)
3. chat.html에서 해당 파일 소스로 나오는 질문 → ⬇ 다운로드 테스트
4. PDF 텍스트 추출 품질 검증 (텍스트 기반 PDF)
5. 스캔 PDF 처리 전략 결정 (OCR 통합 여부)
