-- 이용안내 영상 저장소 (회원 전용). Supabase SQL 에디터에서 1회 실행.
--   * 'guide-videos' 저장소는 비공개: 로그인한 승인 회원만 볼 수 있고, 올리기·바꾸기·지우기는 운영팀만 한다
--   * 영상 파일 이름은 영상 번호.mp4 (예: start.mp4). 같은 이름으로 다시 올리면 순서·주소 그대로 새 영상으로 바뀐다
--   * 파일 하나 최대 200MB. 프로젝트 전체 업로드 한도(기본 50MB)보다 큰 영상은 Storage → Settings 에서 한도를 올려야 한다

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-videos', 'guide-videos', false, 209715200, array['video/mp4'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guide_videos_read" on storage.objects;
create policy "guide_videos_read" on storage.objects for select to authenticated
  using (bucket_id = 'guide-videos' and coalesce(public.is_approved(), false));

drop policy if exists "guide_videos_insert" on storage.objects;
create policy "guide_videos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'guide-videos' and coalesce(public.is_staff(), false));

drop policy if exists "guide_videos_update" on storage.objects;
create policy "guide_videos_update" on storage.objects for update to authenticated
  using (bucket_id = 'guide-videos' and coalesce(public.is_staff(), false));

drop policy if exists "guide_videos_delete" on storage.objects;
create policy "guide_videos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'guide-videos' and coalesce(public.is_staff(), false));
