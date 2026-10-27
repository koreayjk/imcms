-- 기자 소개(작성자 프로필): 사진·소개·공개 이메일 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   영문 홈페이지에서 기사 위 "By 이름" 을 누르면 나오는 작성자 소개 화면(사진·이메일·소개·쓴 기사)에 쓰인다.
--   본인이 내 정보에서 직접 적는다 (기존 "본인 정보 수정" 규칙 그대로). 홈페이지 방문자는 기사를 발행한 기자의 프로필만 읽을 수 있다
alter table profiles add column if not exists bio text check (bio is null or char_length(bio) <= 1500);
alter table profiles add column if not exists photo_url text check (photo_url is null or char_length(photo_url) <= 500);
alter table profiles add column if not exists public_email text check (public_email is null or char_length(public_email) <= 120);

select count(*) filter (where bio is not null) as "소개 있는 계정", count(*) filter (where photo_url is not null) as "사진 있는 계정" from profiles;
