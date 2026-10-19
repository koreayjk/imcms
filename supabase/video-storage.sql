-- 기사 영상 저장소 + 매체별 저장 용량 집계 (Supabase SQL 에디터에서 1회 실행)
--   * 영상은 사진과 따로 'videos' 저장소에 둔다 (나중에 영상 전용 서비스로 옮기기 쉽게)
--   * 파일 하나당 최대 1GB, mp4·webm·mov 만 받는다
--   * 매체별 사용량(사진+영상)을 재는 함수 outlet_storage_bytes
--
-- 실행 전에 한 가지: Supabase 대시보드 → Storage → Settings 의 "Upload file size limit"을
--   1GB(1024MB) 이상으로 올려 주세요. (프로젝트 전체 한도가 기본 50MB라서, 저장소 한도만 올려서는 큰 파일이 막힙니다.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 1073741824, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 올리기: 승인된 편집국 계정만 (media 저장소와 같은 조건)
drop policy if exists "videos_upload" on storage.objects;
create policy "videos_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and coalesce(public.is_approved(), false));

drop policy if exists "videos_update_own" on storage.objects;
create policy "videos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and owner = auth.uid());

drop policy if exists "videos_delete_own" on storage.objects;
create policy "videos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and owner = auth.uid());

-- 자료 지우기(총관리자)에서 영상도 지울 수 있게
drop policy if exists "videos_delete_super" on storage.objects;
create policy "videos_delete_super" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and coalesce(public.is_super(), false));

-- 매체 저장 용량: 그 매체 폴더(<매체번호>/…)의 사진·영상 크기 합계 (바이트)
--   그 매체 소속 계정이나 총관리자만 볼 수 있다
create or replace function public.outlet_storage_bytes(o uuid)
returns table (photos bigint, videos bigint)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not (coalesce(public.is_super(), false)
          or exists (select 1 from outlet_members m where m.profile_id = auth.uid() and m.outlet_id = o)) then
    raise exception '이 매체의 용량은 볼 수 없습니다.';
  end if;
  return query
    select
      coalesce(sum((so.metadata->>'size')::bigint) filter (where so.bucket_id = 'media'), 0)::bigint,
      coalesce(sum((so.metadata->>'size')::bigint) filter (where so.bucket_id = 'videos'), 0)::bigint
    from storage.objects so
    where so.bucket_id in ('media', 'videos') and so.name like o::text || '/%';
end $$;
revoke all on function public.outlet_storage_bytes(uuid) from public, anon;
grant execute on function public.outlet_storage_bytes(uuid) to authenticated;

-- 자료 지우기 전에 지울 영상 목록 (총관리자): 그 매체 폴더의 영상 중 다른 매체 기사가 쓰지 않는 것만
create or replace function public.admin_outlet_videos(o uuid) returns setof text
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not coalesce(public.is_super(), false) then raise exception '총관리자만 볼 수 있습니다.'; end if;
  return query execute $q$
    with refs as (
      select coalesce(a.body, '') as t from public.articles a
      where a.outlet_id is distinct from $1 and a.body like '%videos/' || $1::text || '/%'
    )
    select so.name::text from storage.objects so
    where so.bucket_id = 'videos' and so.name like $1::text || '/%'
      and not exists (select 1 from refs where refs.t like '%' || so.name || '%')
  $q$ using o;
end $$;
revoke all on function public.admin_outlet_videos(uuid) from public, anon;
grant execute on function public.admin_outlet_videos(uuid) to authenticated;

select '영상 저장소·용량 집계 설치 완료' as "결과";
