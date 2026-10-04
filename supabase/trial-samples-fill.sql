-- IM 체험뉴스 국제·문화·사회 섹션 채우기 (Supabase SQL 에디터에서 실행, 한 번만)
--   목표: 국제 20건 이상, 문화 20건 이상, 사회 지금보다 10건 더
--   1) 더케어타임즈·Shipping Times 의 사진 있는 기사 중 섹션에 맞는 기사를 새로 복사한다
--        국제 ← Shipping Times 무역·통관 / 제목에 해외·국가·무역 관련 말이 있는 기사
--        문화 ← 더케어타임즈 문화 / 제목에 공연·전시·축제·여행·체육 등이 있는 기사
--        사회 ← 더케어타임즈 사회·정치 / 제목에 정책·지역·교육·안전 등이 있는 기사
--   2) 그래도 모자라면 다른 섹션(8건 넘게 있는 섹션)의 샘플 중 제목이 맞는 기사를 옮긴다
--   Israel Today 기사(사진 없음)와 사진 없는 기사는 넣지 않는다. 다시 실행하면 사회가 10건 더 늘어난다

do $$
declare
  o uuid := public.trial_outlet();
  t record;
  cat uuid;
  have int;
  need int;
  n_new int;
  n_move int;
  msg text := '';
begin
  if o is null then raise exception '체험신문이 없습니다. trial.sql 을 먼저 실행해 주세요.'; end if;

  for t in
    select * from (values
      (1, 'world', '국제', 20, 0,
       array['trade'],
       '(해외|국제|글로벌|세계|외국|美|미국|중국|中|일본|日|유럽|EU|영국|독일|프랑스|러시아|우크라이나|중동|이란|이스라엘|사우디|인도|베트남|동남아|아세안|대만|호주|캐나다|멕시코|브라질|아프리카|수출|수입|무역|관세|통관|FTA|트럼프|IMO|유엔|UN|WHO|OECD|홍해|파나마|수에즈|항로|선사|해운|컨테이너)'),
      (2, 'culture', '문화', 20, 0,
       array['culture'],
       '(문화|공연|전시|축제|영화|음악|콘서트|합창|연주|책|도서|출판|여행|관광|예술|미술|사진전|체육|스포츠|운동|걷기|마라톤|올림픽|드라마|방송|한류|전통|역사|박물관|미술관|기념|행사|체험|캠프|여가|취미|봉사|나눔)'),
      (3, 'society', '사회', 0, 10,
       array['society', 'politics'],
       '(사회|정치|정책|법|국회|의원|정부|장관|지자체|시청|구청|군청|도청|시장|경찰|사건|사고|안전|재난|교육|학교|학생|노동|일자리|채용|인구|저출산|고령|지역|주민|시민|복지|돌봄|장애|아동|청년|가족|협약|위원회)')
    ) as v(ord, slug, name, target, more, src_slugs, words)
    order by ord
  loop
    cat := (select id from categories where outlet_id = o and slug = t.slug);
    if cat is null then
      msg := msg || format(' / %s 섹션 없음', t.name);
      continue;
    end if;
    select count(*) into have from articles where outlet_id = o and is_sample and category_id = cat;
    need := greatest(t.target - have, t.more, 0);
    n_new := 0;
    n_move := 0;

    -- 1) 새로 복사 (섹션이 같은 기사 먼저, 그다음 제목이 맞는 기사, 최근 기사 순)
    if need > 0 then
      with src as (
        select a.*, so.name as src_outlet,
               (coalesce(c.slug, '') = any (t.src_slugs)) as same_section,
               row_number() over (partition by a.title order by a.created_at desc) as dup
        from articles a
        join outlets so on so.id = a.outlet_id
        left join categories c on c.id = a.category_id
        where so.name in ('더케어타임즈', 'Shipping Times')
          and a.status in ('published', 'in_review')
          and nullif(btrim(coalesce(a.thumbnail_url, '')), '') is not null
          and a.thumbnail_url not like '%/sites/israeltoday/covers/%'
          and a.source_article_id is null
          and coalesce(c.slug, '') not in ('opinion', 'shop', 'video', 'people')
          and (coalesce(c.slug, '') = any (t.src_slugs) or a.title ~ t.words)
          and not exists (select 1 from articles x where x.outlet_id = o and x.title = a.title)
      ), picked as (
        select * from src where dup = 1
        order by same_section desc, coalesce(published_at, created_at) desc
        limit need
      )
      insert into articles (outlet_id, category_id, author_id, title, excerpt, body, thumbnail_url, tags, status, published_at, byline, is_sample)
      select o, cat, p.author_id, p.title, p.excerpt,
             regexp_replace(p.body, '\[(더케어타임즈|Shipping Times|Israel Today)\s*=\s*[^\]]*\]', '[IM 체험뉴스=샘플 기자]', 'g'),
             p.thumbnail_url, p.tags, 'published',
             least(coalesce(p.published_at, p.created_at), now()),
             '샘플 기자', true
      from picked p;
      get diagnostics n_new = row_count;
    end if;

    -- 2) 모자라면 다른 섹션 샘플 중 제목이 맞는 기사를 옮긴다 (8건 넘게 있는 섹션에서만, 8건은 남긴다)
    if need - n_new > 0 then
      with pool as (
        select a.id, a.category_id,
               row_number() over (partition by a.category_id order by a.published_at) as k,
               count(*) over (partition by a.category_id) as total
        from articles a
        join categories c on c.id = a.category_id
        where a.outlet_id = o and a.is_sample
          and c.slug not in ('world', 'culture', 'society')
          and a.title ~ t.words
      ), movable as (
        select p.id from pool p
        where (select count(*) from articles z where z.outlet_id = o and z.is_sample and z.category_id = p.category_id) - p.k >= 8
        order by p.k
        limit need - n_new
      )
      update articles a set category_id = cat
        from movable m where a.id = m.id;
      get diagnostics n_move = row_count;
    end if;

    msg := msg || format(' / %s: 새로 %s건, 옮김 %s건%s', t.name, n_new, n_move,
                         case when need - n_new - n_move > 0 then format(' (%s건 모자람)', need - n_new - n_move) else '' end);
  end loop;

  -- 홈 편집판에 고정해 둔 자리는 비운다 (섹션이 바뀐 기사가 걸려 있을 수 있다)
  delete from home_layouts where outlet_id = o;

  raise notice '%', substr(msg, 4);
end $$;

-- 결과: 섹션별 샘플 기사 수
select c.name as "섹션", count(a.id) as "샘플 기사"
from categories c
left join articles a on a.category_id = c.id and a.is_sample
where c.outlet_id = public.trial_outlet()
group by c.name, c.sort_order
order by c.sort_order;
