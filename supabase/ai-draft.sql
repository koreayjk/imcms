-- AI 초안의 "기자 확인 메모"를 기사에 붙여둔다 (편집 화면에만 보이고 홈페이지에는 나가지 않음)
alter table articles add column if not exists ai_notes text;
