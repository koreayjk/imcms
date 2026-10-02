-- 기사 수정 이력 (Supabase SQL 에디터에서 실행)
--   발행됐거나 승인신청 중인 기사의 제목·부제·본문·기자명이 바뀌면, 바뀌기 전 내용을 자동으로 남긴다
--   (작성중 기사는 자동 저장이 잦아서 기록하지 않는다)
--   정정보도·분쟁 때 “언제 누가 무엇을 고쳤는지” 확인하는 용도. 편집국에서 기사를 볼 수 있는 사람만 이력도 본다

create table if not exists article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references articles(id) on delete cascade,
  -- 이 내용을 고친 사람·시각 (아래 칸들은 고치기 전 내용)
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  title text,
  excerpt text,
  body text,
  byline text,
  status text,
  published_at timestamptz
);
create index if not exists article_revisions_article on article_revisions(article_id, changed_at desc);

alter table article_revisions enable row level security;
drop policy if exists "article_revisions_read" on article_revisions;
create policy "article_revisions_read" on article_revisions for select to authenticated
  using (exists (select 1 from articles a where a.id = article_revisions.article_id));

create or replace function record_article_revision()
returns trigger as $$
begin
  if old.status in ('published', 'in_review')
     and (new.title is distinct from old.title or new.body is distinct from old.body or new.excerpt is distinct from old.excerpt
          or (to_jsonb(new) ->> 'byline') is distinct from (to_jsonb(old) ->> 'byline')) then
    insert into article_revisions (article_id, changed_by, title, excerpt, body, byline, status, published_at)
    values (old.id, auth.uid(), old.title, old.excerpt, old.body, to_jsonb(old) ->> 'byline', old.status, old.published_at);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists articles_record_revision on articles;
create trigger articles_record_revision before update on articles for each row execute function record_article_revision();
