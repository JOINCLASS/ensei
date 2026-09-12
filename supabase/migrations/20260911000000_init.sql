-- 遠征の手配 — テーブル・RLS・自動処理
-- Supabase SQL Editor にそのまま貼って実行できる（何度実行しても同じ結果になる）

-- ============================================================
-- 1. 共通：updated_at を自動で更新する
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2. trips（旅）
-- ============================================================
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  place       text,
  start_date  date not null,
  end_date    date not null,
  color       text not null default 'purple'
                check (color in ('red','pink','orange','yellow','green','sky','blue','purple','white')),
  memo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 帰る日は、出発する日と同じか後の日
  constraint trips_dates_ordered check (end_date >= start_date)
);

-- 一覧は user_id で絞って start_date の昇順に並べる
create index if not exists trips_user_start_idx on public.trips (user_id, start_date);

drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 3. arrangements（手配）
-- ============================================================
create table if not exists public.arrangements (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null check (type in ('ticket','go','back','hotel','other')),
  status      text not null default 'todo' check (status in ('todo','wait','done')),
  name        text,
  from_place  text,
  to_place    text,

  -- 入力した現地時刻をそのまま保存する。タイムゾーン変換をしない。
  -- 海外遠征で「現地の 9:15 発」が端末のタイムゾーンでずれないようにするため、
  -- timestamptz ではなく timestamp（without time zone）を使う。
  depart_at   timestamp,
  arrive_at   timestamp,

  check_in    date,
  check_out   date,
  memo        text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 当落待ちはチケットだけ
  constraint arrangements_wait_only_ticket
    check (status <> 'wait' or type = 'ticket'),

  -- 泊まる日の前後関係
  constraint arrangements_stay_ordered
    check (check_out is null or check_in is null or check_out >= check_in)
);

-- 詳細画面は trip_id で絞って position の昇順に並べる
create index if not exists arrangements_trip_position_idx on public.arrangements (trip_id, position, created_at);
create index if not exists arrangements_user_idx on public.arrangements (user_id);

drop trigger if exists arrangements_touch_updated_at on public.arrangements;
create trigger arrangements_touch_updated_at
  before update on public.arrangements
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 4. 旅を作ると、チケット・行き・帰り・ホテルの4項目を自動で作る
-- ============================================================
create or replace function public.create_default_arrangements()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.arrangements (trip_id, user_id, type, status, position)
  select new.id, new.user_id, t.type, 'todo', t.pos
  from (values ('ticket', 0), ('go', 1), ('back', 2), ('hotel', 3)) as t(type, pos);
  return new;
end;
$$;

drop trigger if exists trips_create_default_arrangements on public.trips;
create trigger trips_create_default_arrangements
  after insert on public.trips
  for each row execute function public.create_default_arrangements();

-- ============================================================
-- 5. 権限 — ログイン済みの人だけがテーブルに触れる
--    （RLSは「行を絞る」仕組みで、「テーブルに触れてよいか」は別に許可が要る。
--      どちらか一方だけでは動かない。anon には何も渡さない）
-- ============================================================
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.trips        to authenticated, service_role;
grant select, insert, update, delete on public.arrangements to authenticated, service_role;

-- ============================================================
-- 6. RLS — 本人のデータだけを読み書きできる
-- ============================================================
alter table public.trips        enable row level security;
alter table public.arrangements enable row level security;

-- trips
drop policy if exists "trips are visible to their owner"   on public.trips;
drop policy if exists "trips are inserted by their owner"  on public.trips;
drop policy if exists "trips are updated by their owner"   on public.trips;
drop policy if exists "trips are deleted by their owner"   on public.trips;

create policy "trips are visible to their owner"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "trips are inserted by their owner"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "trips are updated by their owner"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trips are deleted by their owner"
  on public.trips for delete
  using (auth.uid() = user_id);

-- arrangements
-- user_id が本人であることに加えて、つなぐ先の旅も本人のものであることを確かめる。
-- （他人の旅に自分名義の手配をぶら下げられないようにするため）
drop policy if exists "arrangements are visible to their owner"  on public.arrangements;
drop policy if exists "arrangements are inserted by their owner" on public.arrangements;
drop policy if exists "arrangements are updated by their owner"  on public.arrangements;
drop policy if exists "arrangements are deleted by their owner"  on public.arrangements;

create policy "arrangements are visible to their owner"
  on public.arrangements for select
  using (auth.uid() = user_id);

create policy "arrangements are inserted by their owner"
  on public.arrangements for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create policy "arrangements are updated by their owner"
  on public.arrangements for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create policy "arrangements are deleted by their owner"
  on public.arrangements for delete
  using (auth.uid() = user_id);
