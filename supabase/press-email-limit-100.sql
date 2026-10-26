-- 보도자료 메일 자동 수신: 요금제와 상관없이 하루 100건으로 통일 (Supabase SQL 에디터에서 1회 실행, 여러 번 실행해도 된다)
--   · 전에는 베이직 10 · 스탠다드 30 · 프리미엄 50 · 그 밖 100 이었다. 유료(부가 서비스를 켜거나 프리미엄 포함)가 되면 모두 하루 100건
--   · 부가 서비스를 켜지 않은 베이직·스탠다드는 한도와 상관없이 체험 3통까지만 받는다 (press_mail_trial_limit)
--   · 매체마다 따로 정해 둔 한도(편집국 → 보도자료 → 메일로 받기의 "언론사별 하루 한도")는 그대로 남는다. 따로 정한 매체를 100으로 맞추려면 그 칸을 "기본값으로"로 되돌리세요
insert into private.settings (key, value) values
  ('press_mail_limit_basic', '100'), ('press_mail_limit_standard', '100'), ('press_mail_limit_premium', '100'), ('press_mail_limit_other', '100')
on conflict (key) do update set value = excluded.value;
