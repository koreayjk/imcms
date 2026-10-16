-- 내 계정 바로 삭제 — 본인이 "내 정보"에서 (Supabase SQL 에디터에서 실행, member-delete.sql 다음)
--   애플 앱 심사(5.1.1(v)): 앱 안에서 계정을 바로 지울 수 있어야 한다
--   지우면 로그인할 수 없다. 되돌릴 수 없다
--   언론사·그룹·매체는 그대로 남는다 (편집장·발행인이 지워도 마찬가지. 매체와 그룹은 회원 계정에 묶여 있지 않다)
--   쓴 기사도 남는다: 기자명(바이라인)은 원래 이름으로 고정하고, 작성자 계정만 운영 관리자(총관리자)로 넘긴다
--   다른 사람의 업무요청에 남긴 답변·첨부도 남긴다. 본인이 올린 업무요청·개선 요청 글은 함께 지워진다
--   총관리자 계정은 여기서 지울 수 없다

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  t profiles%rowtype;
  heir uuid;
begin
  if me is null then raise exception '로그인이 필요합니다.'; end if;
  select * into t from profiles where id = me;
  if coalesce(t.is_super, false) then raise exception '총관리자 계정은 여기서 지울 수 없습니다.'; end if;
  -- 기사·답변을 넘겨받을 운영 관리자 (가장 먼저 만든 총관리자)
  select id into heir from profiles where coalesce(is_super, false) and id <> me order by created_at limit 1;
  if heir is null then raise exception '기사를 넘겨받을 운영 관리자가 없어 지금은 지울 수 없습니다. 고객센터로 문의해 주세요.'; end if;

  -- 기사: 기자명은 원래 이름으로 남기고 작성자 계정만 넘긴다
  update articles set byline = coalesce(nullif(trim(byline), ''), t.full_name), author_id = heir where author_id = me;
  update articles set reviewed_by = null where reviewed_by = me;
  update home_layouts set updated_by = heir where updated_by = me;

  -- 다른 사람의 업무요청에 남긴 답변·첨부는 남긴다
  update support_replies r set author_id = heir
    from support_tickets s where s.id = r.ticket_id and r.author_id = me and s.requester_id <> me;
  update support_files f set uploaded_by = heir
    from support_tickets s where s.id = f.ticket_id and f.uploaded_by = me and s.requester_id <> me;

  -- 계정 삭제 (회원 정보·소속·로그인 기록·본인 업무요청은 함께 지워진다)
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
