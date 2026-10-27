-- 뉴스폭탄 기자명 점검 (읽기만 한다. 아무것도 바뀌지 않는다)
-- ① 뉴스폭탄 계정: 지금 이름 (이호현 계정이 이문희로 바뀌었는지 확인)
select p.full_name, (select u.email from auth.users u where u.id = p.id) as email, p.role, p.created_at
from profiles p join outlets o on o.id = p.outlet_id
where o.name = '뉴스폭탄' order by p.created_at;

-- ② 기사 목록: 화면에 나오는 기자명(지금) / 본문 첫머리 이름 / 고치기 전 본문의 이름(수정 이력)
select a.title,
       coalesce(nullif(btrim(a.byline), ''), p.full_name) as 지금_기자명,
       (regexp_match(a.body, '\[[^\]=]+=\s*([^\]]+?)\s*기자\]'))[1] as 본문_첫머리,
       (select (regexp_match(r.body, '\[[^\]=]+=\s*([^\]]+?)\s*기자\]'))[1]
          from article_revisions r where r.article_id = a.id order by r.changed_at limit 1) as 처음_본문_이름,
       a.published_at
from articles a
join outlets o on o.id = a.outlet_id
left join profiles p on p.id = a.author_id
where o.name = '뉴스폭탄'
order by a.published_at desc nulls last
limit 100;
