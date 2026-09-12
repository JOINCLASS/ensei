-- 招待リンク。ログイン中の人がリンクを発行し、渡された人がそれで登録できる。
-- 新規登録は閉じたままなので、このリンクが唯一の入口になる。

create table if not exists public.invites (
  -- idがそのまま招待コード。URLに載るので推測できない値にする。
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  -- 使われたら記録する。1枚につき1人まで。
  used_at     timestamptz,
  used_by     uuid references auth.users(id) on delete set null
);

create index if not exists invites_created_by_idx on public.invites (created_by, created_at desc);

-- 未使用の招待を溜め込めないようにする（1人5枚まで）。
-- 無制限だと、1人のアカウントが乗っ取られただけで登録が野放しになる。
create or replace function public.limit_active_invites()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.invites
    where created_by = new.created_by and used_at is null and expires_at > now()
  ) >= 5 then
    raise exception '未使用の招待は5枚までです';
  end if;
  return new;
end;
$$;

drop trigger if exists invites_limit_active on public.invites;
create trigger invites_limit_active
  before insert on public.invites
  for each row execute function public.limit_active_invites();

-- 権限：ログイン済みの人が、自分の招待を作って眺められるだけ。
-- 書き換えと削除は渡さない（使用済みにするのはサーバー側の仕事）。
grant select, insert on public.invites to authenticated;
grant select, insert, update on public.invites to service_role;

alter table public.invites enable row level security;

drop policy if exists "invites are visible to their creator" on public.invites;
drop policy if exists "invites are created by their creator" on public.invites;

create policy "invites are visible to their creator"
  on public.invites for select
  using (auth.uid() = created_by);

create policy "invites are created by their creator"
  on public.invites for insert
  with check (auth.uid() = created_by);
