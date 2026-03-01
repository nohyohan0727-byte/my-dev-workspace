#!/usr/bin/env python3
"""
Supabase Management API SQL 실행 스크립트
사용법: python3 run_sql.py <sql_query>
"""
import urllib.request, urllib.error
import json, sys, os

def run_sql(query, project_id, token):
    url = f'https://api.supabase.com/v1/projects/{project_id}/database/query'
    body = json.dumps({'query': query}).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            result = r.read().decode('utf-8')
            return json.loads(result) if result.strip() else []
    except urllib.error.HTTPError as e:
        return {'error': e.read().decode('utf-8')}

# .env 파일 로드
env = {}
env_path = os.path.join(os.path.dirname(__file__), '../../../.env')
try:
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
except:
    pass

PROJECT = env.get('TRUSTRAG_SUPABASE_PROJECT_ID', os.environ.get('TRUSTRAG_SUPABASE_PROJECT_ID', ''))
TOKEN = env.get('SUPABASE_TOKEN', os.environ.get('SUPABASE_TOKEN', ''))

if not PROJECT or not TOKEN:
    print("ERROR: TRUSTRAG_SUPABASE_PROJECT_ID 또는 SUPABASE_TOKEN 없음")
    sys.exit(1)

if len(sys.argv) > 1:
    query = ' '.join(sys.argv[1:])
    result = run_sql(query, PROJECT, TOKEN)
    print(json.dumps(result, ensure_ascii=False, indent=2))
