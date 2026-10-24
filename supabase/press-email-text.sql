-- 메일로 받은 보도자료의 첨부파일(한글·워드·PDF·텍스트) 내용을 보도자료 본문에 넣었는지 표시 (Supabase SQL 에디터에서 1회 실행. press-email.sql 다음)
--   스탠다드 요금제부터 보도자료를 처음 열 때 첨부 글자를 본문 아래에 자동으로 넣습니다 (베이직은 내려받기만)
alter table press_attachments add column if not exists text_done boolean not null default false;
