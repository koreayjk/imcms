-- IM 체험뉴스 샘플 기사 더 넣기 (Supabase SQL 에디터에서 실행, trial.sql 다음. 여러 번 실행해도 된다 — 같은 제목은 건너뛴다)
--   우리 매체(더케어타임즈·Shipping Times·Israel Today)의 발행·승인대기 기사 중 사진(표지 그림) 있는 기사를 매체마다 최대 30건 복사
--   섹션: 더케어타임즈 → 건강·복지·사회(경제·문화), Shipping Times → 경제·산업, Israel Today 현지 뉴스 → 국제, 성지·문화 → 문화
--   본문의 [매체=기자] 표시는 [IM 체험뉴스=샘플 기자]로 바꾸고, 모두 '샘플 기사'(수정·삭제 불가)로 넣는다
--   건강·복지·산업은 '전문 섹션'으로 지정해 홈에 전문뉴스 줄이 보이게 한다

do $$
declare
  o uuid := public.trial_outlet();
  n int;
begin
  if o is null then raise exception '체험신문이 없습니다. trial.sql 을 먼저 실행해 주세요.'; end if;

  with src as (
    select a.*, so.name as src_outlet, coalesce(c.slug, '') as src_slug,
           row_number() over (partition by a.outlet_id order by a.created_at desc) as n
    from articles a
    join outlets so on so.id = a.outlet_id
    left join categories c on c.id = a.category_id
    where so.name in ('더케어타임즈', 'Shipping Times', 'Israel Today')
      and a.status in ('published', 'in_review')
      and a.thumbnail_url is not null
      and a.source_article_id is null
      and coalesce(c.slug, '') not in ('opinion', 'shop', 'video')
      -- Israel Today 는 현지 뉴스·성지 기사만 (말씀·선교 교육 기사는 일반 신문 샘플로 맞지 않는다)
      and (so.name <> 'Israel Today' or coalesce(c.slug, '') ~ '^(israel|holyland)')
      and not exists (select 1 from articles t where t.outlet_id = o and t.title = a.title)
  ), picked as (
    select s.*,
      case
        when s.src_outlet = '더케어타임즈' then
          case when s.src_slug in ('politics', 'society') then 'society'
               when s.src_slug = 'economy' then 'economy'
               when s.src_slug = 'culture' then 'culture'
               -- 복지·돌봄 기사 셋 중 하나는 사회 섹션으로 (사회 섹션이 비지 않게)
               when s.n % 3 = 0 then 'society'
               else 'health' end
        when s.src_outlet = 'Shipping Times' then case when s.n % 2 = 0 then 'industry' else 'economy' end
        else case when s.src_slug ~ '^holyland' then 'culture' else 'world' end
      end as slug
    from src s
    where s.n <= 30
  )
  insert into articles (outlet_id, category_id, author_id, title, excerpt, body, thumbnail_url, tags, status, published_at, byline, is_sample)
  select o,
         (select id from categories where outlet_id = o and slug = p.slug),
         p.author_id, p.title, p.excerpt,
         regexp_replace(p.body, '\[(더케어타임즈|Shipping Times|Israel Today)\s*=\s*[^\]]*\]', '[IM 체험뉴스=샘플 기자]', 'g'),
         p.thumbnail_url, p.tags, 'published',
         least(coalesce(p.published_at, p.created_at), now()),
         '샘플 기자', true
  from picked p;
  get diagnostics n = row_count;
  raise notice '샘플 기사 %건을 더 넣었습니다.', n;

  -- 처음에 넣은 샘플의 본문 기자 표시도 맞춘다
  update articles
     set body = regexp_replace(body, '\[(더케어타임즈|Shipping Times|Israel Today)\s*=\s*[^\]]*\]', '[IM 체험뉴스=샘플 기자]', 'g')
   where outlet_id = o and is_sample and body ~ '\[(더케어타임즈|Shipping Times|Israel Today)\s*=';

  -- 전문뉴스 줄이 보이도록 두 섹션을 전문 섹션으로
  update categories set specialty = true, description = coalesce(description, case slug when 'health' then '보건·복지·의료·돌봄 전문 소식' else '산업·물류·기업 전문 소식' end)
   where outlet_id = o and slug in ('health', 'industry') and not coalesce(specialty, false);
end $$;

-- 결과: 섹션별 샘플 기사 수
select c.name as "섹션", count(a.id) as "샘플 기사"
from categories c
left join articles a on a.category_id = c.id and a.is_sample
where c.outlet_id = public.trial_outlet()
group by c.name, c.sort_order
order by c.sort_order;
