-- 저장 파일 관리 (편집국 "저장 파일" 화면) + 영상 저장소 설치 (Supabase SQL 에디터에서 1회 실행)
--   * 편집장 이상: 그 매체 사진·영상 전체 / 기자: 자기가 올린 파일만
--   * 기사·수정 이력·광고 배너·매체 설정(로고)에서 쓰는 파일은 "사용 중"으로 표시하고 지우지 못하게 한다
--   * video-storage.sql 의 내용(영상 저장소·올리기 권한·용량 집계)도 같이 설치한다. 이미 했어도 다시 실행해도 된다
--
-- 일부 항목이 실패해도 나머지는 설치되고, 맨 아래 표에서 무엇이 설치됐는지 볼 수 있다.
-- 실행 전 확인: Supabase 대시보드 → Storage → Settings → "Upload file size limit" 이 1GB 이상인지

-- 1) 영상 저장소
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 1073741824, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2) 저장소 권한: 하나가 실패해도 다음 것을 계속한다
create or replace function pg_temp.try_policy(name text, ddl text) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on storage.objects', name);
  execute ddl;
exception when others then
  raise warning '정책 % 설치 실패: %', name, sqlerrm;
end $$;

select pg_temp.try_policy('videos_upload',
  $p$create policy "videos_upload" on storage.objects for insert to authenticated
     with check (bucket_id = 'videos' and coalesce(public.is_approved(), false))$p$);
select pg_temp.try_policy('videos_update_own',
  $p$create policy "videos_update_own" on storage.objects for update to authenticated
     using (bucket_id = 'videos' and owner = auth.uid())$p$);
select pg_temp.try_policy('videos_delete_own',
  $p$create policy "videos_delete_own" on storage.objects for delete to authenticated
     using (bucket_id = 'videos' and owner = auth.uid())$p$);
select pg_temp.try_policy('videos_delete_super',
  $p$create policy "videos_delete_super" on storage.objects for delete to authenticated
     using (bucket_id = 'videos' and coalesce(public.is_super(), false))$p$);
-- 편집장·발행인은 그 매체 폴더의 파일(사진·영상)을 지울 수 있다
select pg_temp.try_policy('files_delete_editor',
  $p$create policy "files_delete_editor" on storage.objects for delete to authenticated
     using (bucket_id in ('media', 'videos') and exists (
       select 1 from public.outlet_members m
       where m.profile_id = auth.uid() and m.role in ('editor', 'admin')
         and m.outlet_id::text = split_part(storage.objects.name, '/', 1)))$p$);

-- 지우려면 파일이 "보여야" 한다 (조회 권한이 없으면 지우기가 오류 없이 0건으로 끝난다)
--   자기 매체 폴더의 파일과 자기가 올린 파일만 보인다. 사진·영상 주소로 보는 것(공개)과는 별개다
select pg_temp.try_policy('files_select_member',
  $p$create policy "files_select_member" on storage.objects for select to authenticated
     using (bucket_id in ('media', 'videos') and (
       owner = auth.uid() or coalesce(public.is_super(), false)
       or exists (select 1 from public.outlet_members m
                  where m.profile_id = auth.uid() and m.outlet_id::text = split_part(storage.objects.name, '/', 1))))$p$);

-- 3) 매체 저장 용량 (사진+영상)
create or replace function public.outlet_storage_bytes(o uuid)
returns table (photos bigint, videos bigint)
language plpgsql stable security definer set search_path = public, storage as $$
#variable_conflict use_column
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

-- 4) 이 파일을 어딘가에서 쓰는지: 기사 본문·대표 사진·수정 이력·광고 배너·매체 설정(로고 등)
--    앱 코드에서 직접 부르지 못하게 하고, 아래 함수들만 부른다
create or replace function public.file_in_use(n text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if to_regclass('public.articles') is not null and exists (
    select 1 from public.articles a where position(n in coalesce(a.body, '')) > 0 or position(n in coalesce(a.thumbnail_url, '')) > 0) then
    return true;
  end if;
  if to_regclass('public.article_revisions') is not null and exists (
    select 1 from public.article_revisions r where position(n in coalesce(r.body, '')) > 0) then
    return true;
  end if;
  if to_regclass('public.ad_banners') is not null and exists (
    select 1 from public.ad_banners b where position(n in coalesce(b.image_url, '')) > 0 or position(n in coalesce(b.mobile_image_url, '')) > 0) then
    return true;
  end if;
  if to_regclass('public.outlets') is not null and exists (
    select 1 from public.outlets o where position(n in coalesce(o.site::text, '')) > 0) then
    return true;
  end if;
  return false;
end $$;
revoke all on function public.file_in_use(text) from public, anon, authenticated;

-- 5) 파일 목록: 편집장 이상은 매체 전체(올린 사람으로 거를 수 있음), 기자는 자기가 올린 것만
create or replace function public.outlet_files(
  o uuid, p_kind text default 'photo', p_owner uuid default null, p_unused boolean default false,
  p_limit integer default 40, p_offset integer default 0)
returns table (bucket_name text, file_name text, file_size bigint, uploaded_at timestamptz, owner_id uuid, owner_name text, in_use boolean, total bigint)
language plpgsql stable security definer set search_path = public, storage as $$
#variable_conflict use_column
declare
  sup boolean := coalesce(public.is_super(), false);
  r text;
  eplus boolean;
  b text := case when p_kind = 'video' then 'videos' else 'media' end;
  own uuid := p_owner;
  lim integer := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if not sup then
    select m.role into r from outlet_members m where m.profile_id = auth.uid() and m.outlet_id = o;
    if r is null then raise exception '이 매체의 파일은 볼 수 없습니다.'; end if;
  end if;
  eplus := sup or r in ('editor', 'admin');
  if not eplus then own := auth.uid(); end if;

  if p_unused then
    -- 쓰이지 않는 파일만: 전체를 확인해야 해서 조금 느리다
    return query
      with base as (
        select so.bucket_id::text as bk, so.name::text as nm, coalesce((so.metadata->>'size')::bigint, 0) as sz, so.created_at as ca, so.owner as ow
        from storage.objects so
        where so.bucket_id = b and so.name like o::text || '/%' and (own is null or so.owner = own)
      ), un as (
        select * from base where not public.file_in_use(base.nm)
      )
      select un.bk, un.nm, un.sz, un.ca, un.ow, pr.full_name::text, false, count(*) over ()
      from un left join public.profiles pr on pr.id = un.ow
      order by un.ca desc limit lim offset greatest(coalesce(p_offset, 0), 0);
  else
    return query
      with pg as (
        select so.bucket_id::text as bk, so.name::text as nm, coalesce((so.metadata->>'size')::bigint, 0) as sz, so.created_at as ca, so.owner as ow,
               count(*) over () as tt
        from storage.objects so
        where so.bucket_id = b and so.name like o::text || '/%' and (own is null or so.owner = own)
        order by so.created_at desc limit lim offset greatest(coalesce(p_offset, 0), 0)
      )
      select pg.bk, pg.nm, pg.sz, pg.ca, pg.ow, pr.full_name::text, public.file_in_use(pg.nm), pg.tt
      from pg left join public.profiles pr on pr.id = pg.ow
      order by pg.ca desc;
  end if;
end $$;
revoke all on function public.outlet_files(uuid, text, uuid, boolean, integer, integer) from public, anon;
grant execute on function public.outlet_files(uuid, text, uuid, boolean, integer, integer) to authenticated;

-- 6) 지우기 전 확인: 이 사람이 지울 수 있는 파일이고 어디서도 안 쓰는지 (지우기 버튼이 부른다)
create or replace function public.outlet_file_status(o uuid, p_names text[])
returns table (file_name text, can_delete boolean, in_use boolean)
language plpgsql stable security definer set search_path = public, storage as $$
#variable_conflict use_column
declare
  sup boolean := coalesce(public.is_super(), false);
  r text;
  eplus boolean;
begin
  if not sup then
    select m.role into r from outlet_members m where m.profile_id = auth.uid() and m.outlet_id = o;
    if r is null then raise exception '이 매체의 파일은 지울 수 없습니다.'; end if;
  end if;
  eplus := sup or r in ('editor', 'admin');
  return query
    select n.nm, (so.name is not null and (eplus or so.owner = auth.uid())), public.file_in_use(n.nm)
    from unnest(p_names) as n(nm)
    left join storage.objects so on so.name = n.nm and so.bucket_id in ('media', 'videos') and so.name like o::text || '/%';
end $$;
revoke all on function public.outlet_file_status(uuid, text[]) from public, anon;
grant execute on function public.outlet_file_status(uuid, text[]) to authenticated;

-- 7) 설치 확인 (모두 true 여야 한다)
select '영상 저장소' as 항목, exists (select 1 from storage.buckets where id = 'videos') as 설치됨
union all select '영상 올리기 권한', exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'videos_upload')
union all select '편집장 파일 삭제 권한', exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'files_delete_editor')
union all select '파일 조회 권한', exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'files_select_member')
union all select '용량 집계', to_regprocedure('public.outlet_storage_bytes(uuid)') is not null
union all select '파일 목록', to_regprocedure('public.outlet_files(uuid,text,uuid,boolean,integer,integer)') is not null
union all select '지우기 확인', to_regprocedure('public.outlet_file_status(uuid,text[])') is not null;
