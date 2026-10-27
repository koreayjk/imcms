-- 치앙마이 타임즈: 사진이 없던 1차 기사 1건(부가세 7% 해설)에 자료사진 넣기 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   대표 사진과 본문 첫 단락 아래 사진·캡션을 넣고, AI 메모에 사진 이용 조건을 더한다
--   사진: /sites/chiangmaitimes/photos/cmt-iv-11.webp (배포가 끝난 뒤에 보인다)
update articles a
set thumbnail_url = '/sites/chiangmaitimes/photos/cmt-iv-11.webp',
    body = regexp_replace(a.body, '</p>',
      '</p><img src="/sites/chiangmaitimes/photos/cmt-iv-11.webp" alt="노트북과 계산기, 서류가 놓인 업무용 책상(자료사진, 2016년 촬영). 태국 국세청과 관련된 사진 아님. 사진=Oliver Thomas Klein, 위키미디어 공용 (CC0)"><p><em>▲ 노트북과 계산기, 서류가 놓인 업무용 책상(자료사진, 2016년 촬영). 태국 국세청과 관련된 사진 아님. 사진=Oliver Thomas Klein, 위키미디어 공용 (CC0)</em></p>'),
    ai_notes = coalesce(a.ai_notes, '') || E'\n• 사진 추가: CC0 (Wikimedia Commons, 작가 Oliver Thomas Klein(Unsplash, 2016년 업로드분), 파일명 Desktop with laptop and calculator (Unsplash).jpg)'
from outlets o
where o.id = a.outlet_id
  and (o.name in ('치앙마이 타임즈', '치앙마이타임즈') or (o.name ilike '%치앙마이%타임즈%' and o.name not ilike '%미션%'))
  and a.title = '태국 부가세 7% 1년 더…법인세·신고 기본 정리'
  and a.body not like '%cmt-iv-11.webp%';

-- 확인: 사진 없는 치앙마이 타임즈 기사가 0건이면 끝
select count(*) as "사진 없는 기사"
from articles a join outlets o on o.id = a.outlet_id
where (o.name in ('치앙마이 타임즈', '치앙마이타임즈') or (o.name ilike '%치앙마이%타임즈%' and o.name not ilike '%미션%'))
  and (a.thumbnail_url is null or a.thumbnail_url = '');
