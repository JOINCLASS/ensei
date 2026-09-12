-- サンプルで入れた旅に印を付ける。
-- 「サンプルを片づける」で、自分で作った旅を巻き込まずにまとめて消せるようにするため。
alter table public.trips
  add column if not exists is_sample boolean not null default false;

create index if not exists trips_sample_idx on public.trips (user_id) where is_sample;
