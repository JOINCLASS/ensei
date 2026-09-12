-- サンプルを1回の通信で入れる。
--
-- これまでは、旅ごとに「登録 → 自動で入った4項目を取り直す → 1件ずつ書き込む」
-- としていたので、4つの旅で25回の往復になっていた。
-- サンプルの中身は決まっているので、まとめて渡して中で処理する。
--
-- security invoker なので RLS はそのまま効く。user_id は auth.uid() の既定値が入る。
create or replace function public.create_sample_trips(samples jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  s        jsonb;
  item     jsonb;
  v_trip_id uuid;   -- arrangements.trip_id と名前がぶつからないようにする
  result   jsonb;
begin
  for s in select * from jsonb_array_elements(samples)
  loop
    insert into public.trips (title, place, start_date, end_date, color, memo, is_sample)
    values (
      s->>'title',
      nullif(s->>'place', ''),
      (s->>'start')::date,
      (s->>'end')::date,
      coalesce(s->>'color', 'purple'),
      nullif(s->>'memo', ''),
      true
    )
    returning id into v_trip_id;

    -- 旅を作るとトリガが チケット・行き・帰り・ホテル を作る。
    -- それを種類で突き合わせて中身を入れる。
    for item in select * from jsonb_array_elements(s->'items')
    loop
      update public.arrangements set
        status     = coalesce(item->>'status', 'todo'),
        name       = nullif(item->>'name', ''),
        from_place = nullif(item->>'from', ''),
        to_place   = nullif(item->>'to', ''),
        depart_at  = nullif(item->>'dep', '')::timestamp,
        arrive_at  = nullif(item->>'arr', '')::timestamp,
        check_in   = nullif(item->>'checkIn', '')::date,
        check_out  = nullif(item->>'checkOut', '')::date,
        memo       = nullif(item->>'memo', '')
      where arrangements.trip_id = v_trip_id
        and arrangements.type = item->>'type';
    end loop;
  end loop;

  -- 入れ終わった全件を、一覧がそのまま使える形で返す（取り直しの往復をなくす）
  select coalesce(jsonb_agg(t order by t.start_date, t.id), '[]'::jsonb) into result
  from (
    select
      tr.id, tr.title, tr.place, tr.start_date, tr.end_date, tr.color, tr.memo, tr.is_sample,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'type', a.type, 'status', a.status, 'name', a.name,
          'from_place', a.from_place, 'to_place', a.to_place,
          'depart_at', a.depart_at, 'arrive_at', a.arrive_at,
          'check_in', a.check_in, 'check_out', a.check_out,
          'memo', a.memo, 'position', a.position
        ) order by a.position, a.created_at)
        from public.arrangements a where a.trip_id = tr.id
      ), '[]'::jsonb) as arrangements
    from public.trips tr
    where tr.user_id = auth.uid()
  ) t;

  return result;
end;
$$;

revoke all on function public.create_sample_trips(jsonb) from public;
grant execute on function public.create_sample_trips(jsonb) to authenticated;
