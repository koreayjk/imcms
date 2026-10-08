-- 업무요청 AI 첫 답변 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. support.sql·mail.sql 다음)
--   요청이 들어오면 AI가 먼저 사용법을 안내하는 답글을 단다. 요청한 사람이 [해결됐어요]를 누르면 완료,
--   [담당자 답변이 필요해요]를 누르면 운영팀 차례로 남는다. AI는 안내만 하고 아무것도 바꾸지 않는다
--   AI 답글은 서버만 달 수 있다 (서버 열쇠 payment_db_secret 확인). 회원이 'AI 답변'을 흉내 낼 수 없다

-- AI 답글은 사람이 쓴 글이 아니라 글쓴이가 없다
alter table support_replies add column if not exists is_ai boolean not null default false;
alter table support_replies alter column author_id drop not null;

-- 요청에 AI가 붙인 분류와 진행 상태
--   ai_state: answered(AI가 답함) · handoff(담당자 필요 — AI가 판단했거나 요청자가 누름) · resolved(요청자가 해결됨) · failed(AI 실패)
alter table support_tickets add column if not exists ai_state text;
alter table support_tickets drop constraint if exists support_tickets_ai_state_check;
alter table support_tickets add constraint support_tickets_ai_state_check check (ai_state is null or ai_state in ('answered', 'handoff', 'resolved', 'failed'));
alter table support_tickets add column if not exists ai_kind text check (ai_kind is null or char_length(ai_kind) <= 20);
alter table support_tickets add column if not exists ai_urgency text check (ai_urgency is null or ai_urgency in ('low', 'normal', 'high'));
alter table support_tickets add column if not exists ai_summary text check (ai_summary is null or char_length(ai_summary) <= 300);

-- 답글 트리거: AI 답글은 이 함수 안에서만 표시가 붙고, 요청 상태는 바꾸지 않는다
create or replace function public.on_support_reply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_ai and coalesce(current_setting('app.support_ai', true), '') = 'on' then
    new.is_staff := false;
    new.author_id := null;
    update support_tickets set updated_at = now() where id = new.ticket_id;
    return new;
  end if;
  new.is_ai := false;
  if new.author_id is null then new.author_id := auth.uid(); end if;
  new.is_staff := public.is_staff();
  if new.is_staff then
    update support_tickets set updated_at = now(), last_staff_reply_at = now(),
      status = case when status = 'received' then 'in_progress' else status end,
      ai_state = case when ai_state in ('answered', 'handoff') then null else ai_state end
    where id = new.ticket_id;
  else
    update support_tickets set updated_at = now(), requester_read_at = now(),
      status = case when status = 'done' then 'in_progress' else status end, done_at = case when status = 'done' then null else done_at end
    where id = new.ticket_id;
  end if;
  return new;
end $$;

-- 서버가 AI 답글을 단다 (요청 하나에 한 번만)
create or replace function public.support_ai_reply(secret text, t uuid, p_body text, p_kind text, p_urgency text, p_summary text, p_handoff boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'not allowed'; end if;
  if exists (select 1 from support_replies where ticket_id = t and is_ai) then return false; end if;
  if not exists (select 1 from support_tickets where id = t and status <> 'done') then return false; end if;
  if p_body is not null and char_length(trim(p_body)) > 0 then
    perform set_config('app.support_ai', 'on', true);
    insert into support_replies (ticket_id, author_id, is_ai, body) values (t, null, true, left(p_body, 6000));
    perform set_config('app.support_ai', 'off', true);
  end if;
  update support_tickets set
    ai_state = case when p_handoff or p_body is null then 'handoff' else 'answered' end,
    ai_kind = left(p_kind, 20),
    ai_urgency = case when p_urgency in ('low', 'normal', 'high') then p_urgency else 'normal' end,
    ai_summary = left(p_summary, 300)
  where id = t;
  return true;
end $$;

-- AI가 답하지 못했을 때 표시
create or replace function public.support_ai_failed(secret text, t uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'not allowed'; end if;
  update support_tickets set ai_state = 'failed' where id = t and ai_state is null;
end $$;

-- 요청한 사람: AI 답변으로 해결됐는지 알려 준다
create or replace function public.support_ai_feedback(t uuid, solved boolean) returns text language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from support_tickets where id = t and requester_id = auth.uid()) then raise exception '내 요청만 바꿀 수 있습니다.'; end if;
  if solved then
    update support_tickets set ai_state = 'resolved', status = 'done', done_at = now(), updated_at = now()
    where id = t and ai_state in ('answered', 'handoff');
  else
    update support_tickets set ai_state = 'handoff', updated_at = now()
    where id = t and ai_state = 'answered';
  end if;
  return (select ai_state from support_tickets where id = t);
end $$;

revoke all on function public.support_ai_reply(text, uuid, text, text, text, text, boolean) from public;
revoke all on function public.support_ai_failed(text, uuid) from public;
revoke all on function public.support_ai_feedback(uuid, boolean) from public;
grant execute on function public.support_ai_reply(text, uuid, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.support_ai_failed(text, uuid) to anon, authenticated;
grant execute on function public.support_ai_feedback(uuid, boolean) to authenticated;

-- 확인
select '업무요청 AI 첫 답변' as "기능",
  case when to_regprocedure('public.support_ai_reply(text,uuid,text,text,text,text,boolean)') is not null
        and exists (select 1 from information_schema.columns where table_name = 'support_replies' and column_name = 'is_ai')
       then '준비됨' else '아직 안 됨' end as "결과";
