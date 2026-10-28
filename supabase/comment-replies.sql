-- 편집국이 독자 댓글에 바로 답글을 다는 기능 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다. comments.sql 을 먼저 실행해 둘 것)
--   · 답글은 승인 없이 바로 공개되고, 이름 옆에 "편집국" 표시가 붙는다
--   · 답글을 달면 원 댓글도 함께 공개(승인)된다
alter table comments add column if not exists parent_id uuid references comments(id) on delete cascade;
alter table comments add column if not exists staff_reply boolean not null default false;
create index if not exists comments_parent on comments (parent_id) where parent_id is not null;

-- 공개되는 댓글 목록: 답글(parent_id)과 편집국 표시(staff)를 함께 준다. 원 댓글이 공개 상태일 때만 답글도 보인다
drop function if exists public.comments_public(text, uuid);
create or replace function public.comments_public(secret text, p_article uuid)
returns table (id uuid, name text, body text, created_at timestamptz, guest boolean, parent_id uuid, staff boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return query
    select c.id, coalesce(r.name, c.guest_name, left(split_part(r.email, '@', 1), 3) || '***'), c.body, c.created_at,
           (c.reader_id is null and not c.staff_reply), c.parent_id, c.staff_reply
    from comments c left join readers r on r.id = c.reader_id
    where c.article_id = p_article and c.status = 'approved'
      and (c.parent_id is null or exists (select 1 from comments p where p.id = c.parent_id and p.status = 'approved'))
    order by c.created_at limit 300;
end $$;
revoke all on function public.comments_public(text, uuid) from public;
grant execute on function public.comments_public(text, uuid) to anon, authenticated;
