-- 메일 보도자료 첨부파일 정리 (Supabase SQL 에디터에서 1회 실행, 여러 번 실행해도 된다)
--   · 메일로 받은 첨부(press_attachments.data)는 DB를 차지한다. 7일이 지난 첨부 중 "기사로 쓰이지 않은 것"만 지운다
--   · 기사로 만든 보도자료의 첨부는 7일이 지나도 남긴다 (기사 작업·확인용)
--   · 보도자료 글(제목·본문)은 지우지 않는다. 첨부 파일만 지운다
--   · 매일 새벽 4시(한국 시간)에 자동 실행. 일수는 private.settings 의 press_attachment_keep_days 로 바꾼다 (기본 7)
insert into private.settings (key, value) values ('press_attachment_keep_days', '7') on conflict (key) do nothing;

create or replace function public.press_attachments_cleanup() returns int
language plpgsql security definer set search_path = public, private as $$
declare n int; d int;
begin
  select coalesce((select value::int from private.settings where key = 'press_attachment_keep_days'), 7) into d;
  if d < 3 then d := 3; end if;   -- 실수로 너무 짧게 정해도 3일 아래로는 지우지 않는다
  delete from press_attachments a
   where a.created_at < now() - make_interval(days => d)
     and not exists (select 1 from articles x where x.press_release_id = a.press_release_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.press_attachments_cleanup() from public, anon, authenticated;

-- 매일 19:00 UTC = 한국 시간 새벽 4시
select cron.unschedule(jobid) from cron.job where jobname = 'press-attachments-cleanup';
select cron.schedule('press-attachments-cleanup', '0 19 * * *', $$select public.press_attachments_cleanup()$$);
