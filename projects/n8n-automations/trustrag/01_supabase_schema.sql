-- ============================================================
-- TrustRAG 다중 테넌트 Supabase 스키마
-- 생성일: 2026-03-01
-- 실행 순서: Supabase SQL Editor에서 전체 실행
-- ============================================================

-- pgvector 확장 (이미 있으면 무시)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. 회사 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS tr_companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,          -- URL 식별자 (소문자·숫자·하이픈)
  plan        TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. 사용자 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS tr_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES tr_companies(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'user',
    -- super_admin | company_admin | group_admin | user
  api_key          TEXT NOT NULL UNIQUE,
  tokens_remaining INTEGER NOT NULL DEFAULT 1000,
  tokens_used      INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, email)
);

-- ============================================================
-- 3. 카테고리 테이블 (회사별 지식베이스)
-- ============================================================
CREATE TABLE IF NOT EXISTS tr_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES tr_companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  table_name   TEXT NOT NULL UNIQUE,    -- 실제 벡터 테이블명 (tr_docs_{slug}_{catslug})
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- ============================================================
-- 4. 사용자-카테고리 권한 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS tr_user_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES tr_users(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES tr_categories(id) ON DELETE CASCADE,
  can_upload    BOOLEAN NOT NULL DEFAULT false,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- ============================================================
-- 5. 감사 로그 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS tr_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES tr_users(id) ON DELETE SET NULL,
  company_id  UUID REFERENCES tr_companies(id) ON DELETE CASCADE,
  user_name   TEXT,
  action      TEXT NOT NULL,   -- chat | upload | login | admin_action
  query_text  TEXT,
  session_id  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. 초기 슈퍼 관리자 계정 (JK Networks)
-- ============================================================
-- 회사 생성
INSERT INTO tr_companies (id, name, slug, plan)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'JK Networks',
  'jknetworks',
  'enterprise'
) ON CONFLICT (slug) DO NOTHING;

-- 슈퍼 어드민 계정 생성
INSERT INTO tr_users (id, company_id, email, name, role, api_key, tokens_remaining)
VALUES (
  'u0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'admin@jknetworks.com',
  'JK 운영자',
  'super_admin',
  'trust_SUPER_ADMIN_KEY_CHANGE_THIS',
  999999
) ON CONFLICT (api_key) DO NOTHING;

-- ============================================================
-- 7. validate-key용 RPC 함수
-- ============================================================
CREATE OR REPLACE FUNCTION tr_validate_key(p_api_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user    tr_users%ROWTYPE;
  v_company tr_companies%ROWTYPE;
  v_cats    JSONB;
BEGIN
  -- 사용자 조회
  SELECT * INTO v_user FROM tr_users WHERE api_key = p_api_key AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 API 키입니다');
  END IF;

  -- 회사 조회
  SELECT * INTO v_company FROM tr_companies WHERE id = v_user.company_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '비활성화된 계정입니다');
  END IF;

  -- 토큰 확인
  IF v_user.tokens_remaining <= 0 AND v_user.role NOT IN ('super_admin', 'company_admin') THEN
    RETURN jsonb_build_object('success', false, 'message', '토큰이 소진되었습니다. 관리자에게 문의하세요.');
  END IF;

  -- 카테고리 권한 조회
  IF v_user.role = 'super_admin' THEN
    -- super_admin: 회사의 모든 카테고리
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_id', c.id,
      'name', c.name,
      'table_name', c.table_name,
      'can_upload', true
    )), '[]'::jsonb)
    INTO v_cats
    FROM tr_categories c
    WHERE c.company_id = v_user.company_id AND c.is_active = true;
  ELSIF v_user.role IN ('company_admin', 'group_admin') THEN
    -- company_admin/group_admin: 회사의 모든 카테고리 (업로드는 개별 설정)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_id', c.id,
      'name', c.name,
      'table_name', c.table_name,
      'can_upload', COALESCE(p.can_upload, false)
    )), '[]'::jsonb)
    INTO v_cats
    FROM tr_categories c
    LEFT JOIN tr_user_permissions p ON p.category_id = c.id AND p.user_id = v_user.id
    WHERE c.company_id = v_user.company_id AND c.is_active = true;
  ELSE
    -- user: 권한 부여된 카테고리만
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_id', c.id,
      'name', c.name,
      'table_name', c.table_name,
      'can_upload', p.can_upload
    )), '[]'::jsonb)
    INTO v_cats
    FROM tr_user_permissions p
    JOIN tr_categories c ON c.id = p.category_id AND c.is_active = true
    WHERE p.user_id = v_user.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_user.id,
    'name', v_user.name,
    'email', v_user.email,
    'role', v_user.role,
    'company', v_company.name,
    'company_id', v_user.company_id,
    'tokens_remaining', v_user.tokens_remaining,
    'categories', v_cats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. 토큰 차감 함수
-- ============================================================
CREATE OR REPLACE FUNCTION tr_deduct_token(p_user_id UUID, p_session_id TEXT, p_query TEXT)
RETURNS JSONB AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  UPDATE tr_users
  SET tokens_remaining = tokens_remaining - 1,
      tokens_used = tokens_used + 1
  WHERE id = p_user_id AND tokens_remaining > 0
  RETURNING tokens_remaining INTO v_remaining;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '토큰 부족');
  END IF;

  -- 감사 로그
  INSERT INTO tr_audit_logs (user_id, company_id, action, query_text, session_id)
  SELECT p_user_id, company_id, 'chat', p_query, p_session_id FROM tr_users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'tokens_remaining', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. 문서 벡터 테이블 생성 함수 (카테고리 생성 시 호출)
-- ============================================================
CREATE OR REPLACE FUNCTION tr_create_doc_table(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id         BIGSERIAL PRIMARY KEY,
      content    TEXT,
      metadata   JSONB,
      embedding  VECTOR(1536)
    )', p_table_name);

  -- 벡터 인덱스 생성
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS %I ON %I USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)',
    p_table_name || '_embedding_idx', p_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. 벡터 유사도 검색 함수 (chat에서 사용)
-- ============================================================
CREATE OR REPLACE FUNCTION tr_match_documents(
  p_table_name TEXT,
  p_query_embedding VECTOR(1536),
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  content    TEXT,
  metadata   JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT content, metadata, 1 - (embedding <=> $1) AS similarity
    FROM %I
    WHERE 1 - (embedding <=> $1) > $2
    ORDER BY embedding <=> $1
    LIMIT $3',
    p_table_name)
  USING p_query_embedding, p_match_threshold, p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 완료 메시지
-- ============================================================
SELECT 'TrustRAG 스키마 생성 완료' AS status,
  (SELECT COUNT(*) FROM tr_companies) AS companies,
  (SELECT COUNT(*) FROM tr_users) AS users;
