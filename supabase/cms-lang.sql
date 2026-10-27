-- 편집국 언어: 계정마다 한국어/English 고르기 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   · profiles.cms_lang 이 비어 있으면 그 매체의 "편집국 언어"(홈페이지 설정, site.cmsLang)를 따르고, 그것도 없으면 한국어
--   · 본인 이름·언어는 본인이 바꿀 수 있다 (기존 "본인 정보 수정" 규칙 그대로)
alter table profiles add column if not exists cms_lang text check (cms_lang is null or cms_lang in ('ko', 'en'));

select count(*) filter (where cms_lang is null) as "언어 미지정 계정", count(*) filter (where cms_lang = 'en') as "English", count(*) filter (where cms_lang = 'ko') as "한국어" from profiles;
