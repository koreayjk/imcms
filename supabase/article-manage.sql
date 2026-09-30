-- 기사 삭제·기자명 변경 (Supabase SQL 에디터에서 1회 실행)

-- 1) 기사마다 표시할 기자명. 비어 있으면 작성자 회원 이름을 쓴다 (예: "특별취재팀", "홍길동 객원")
alter table articles add column if not exists byline text;

-- 2) 삭제: 본인이 쓴 기사, 또는 편집장·관리자
drop policy if exists "articles_delete" on articles;
create policy "articles_delete" on articles for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin'))
  );

-- 3) 수정: 본인 기사, 또는 편집장·관리자는 모든 기사 (기존과 같음, 확인용으로 다시 적용)
drop policy if exists "articles_update" on articles;
create policy "articles_update" on articles for update to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin'))
  );
