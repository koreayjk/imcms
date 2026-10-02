-- 회원 탈퇴(계정 삭제) — 총관리자만 (Supabase SQL 에디터에서 실행, staff-outlets.sql 다음)
--   계정을 지우면 로그인할 수 없다. 되돌릴 수 없다
--   쓴 기사는 그대로 남는다: 기자명(바이라인)은 원래 이름으로 고정하고, 작성자 계정만 탈퇴를 처리한 총관리자로 넘긴다
--   다른 사람의 업무요청에 남긴 답변·첨부도 남긴다 (총관리자 이름으로 넘김). 본인이 올린 업무요청은 함께 지워진다

create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  t profiles%rowtype;
begin
  if not coalesce(public.is_super(), false) then raise exception '회원 탈퇴는 총관리자만 할 수 있습니다.'; end if;
  if target = me then raise exception '내 계정은 여기서 탈퇴시킬 수 없습니다.'; end if;
  select * into t from profiles where id = target;
  if t.id is null then raise exception '회원을 찾지 못했습니다.'; end if;
  if coalesce(t.is_super, false) then raise exception '총관리자 계정은 탈퇴시킬 수 없습니다.'; end if;

  -- 기사: 기자명은 원래 이름으로 남기고 작성자 계정만 넘긴다
  update articles set byline = coalesce(nullif(trim(byline), ''), t.full_name), author_id = me where author_id = target;
  update articles set reviewed_by = null where reviewed_by = target;
  update home_layouts set updated_by = me where updated_by = target;

  -- 다른 사람의 업무요청에 남긴 답변·첨부는 남긴다
  update support_replies r set author_id = me
    from support_tickets s where s.id = r.ticket_id and r.author_id = target and s.requester_id <> target;
  update support_files f set uploaded_by = me
    from support_tickets s where s.id = f.ticket_id and f.uploaded_by = target and s.requester_id <> target;

  -- 계정 삭제 (회원 정보·소속·담당 매체·본인 업무요청은 함께 지워진다)
  delete from auth.users where id = target;
end $$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
