-- 기사 사진 저장소 (Supabase SQL 에디터에서 1회 실행)
-- 공개 버킷: 누구나 사진 주소로 볼 수 있고, 로그인한 편집국 계정만 올릴 수 있다

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "media_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media');

create policy "media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());
