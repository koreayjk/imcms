-- 함께 송고(공동 게재) 기능 (Supabase SQL 에디터에서 1회 실행)

-- 사본이 어느 원본에서 왔는지, 원본이 어느 매체에 함께 송고되는지
alter table articles add column if not exists source_article_id uuid references articles(id) on delete set null;
alter table articles add column if not exists syndicate_to uuid[] not null default '{}';
create index if not exists articles_source_idx on articles(source_article_id);

-- 편집장/관리자는 원 기자 이름으로 다른 매체에 사본을 만들 수 있어야 한다
drop policy if exists "articles_insert" on articles;
create policy "articles_insert" on articles for insert to authenticated
  with check (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin'))
  );
