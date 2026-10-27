-- Run in Supabase SQL Editor. Does not replace any existing daily selections.
begin;

-- A single reviewed portrait per person. Pending Kaggle images are excluded.
create or replace view public.blurrle_playable_people as
select p.id, p.name, p.accepted_answers, p.hint,
  r.id as portrait_id, r.storage_bucket, r.storage_path,
  r.image_source_url, r.image_license_name, r.image_license_url, r.attribution,
  coalesce((select array_agg(pc.category_slug order by pc.category_slug)
    from public.person_categories pc where pc.person_id=p.id), '{}') as categories
from public.people p
cross join lateral (
  select photo.* from public.portraits photo
  where photo.person_id=p.id and photo.review_status='approved'
    and nullif(photo.image_source_url,'') is not null
    and nullif(photo.image_license_name,'') is not null
    and nullif(photo.image_license_url,'') is not null
    and exists(select 1 from storage.objects o where o.bucket_id=photo.storage_bucket and o.name=photo.storage_path)
  order by photo.imported_at desc, photo.id limit 1
) r
where p.review_status='approved' and nullif(trim(p.hint),'') is not null;
revoke all on public.blurrle_playable_people from anon, authenticated;
grant select on public.blurrle_playable_people to service_role;

create or replace function public.generate_blurrle_daily(
  p_day date default ((now() at time zone 'UTC')::date),
  p_category text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  category text;
  selected jsonb;
  existing integer;
  result jsonb := '[]'::jsonb;
  active_categories constant text[] := array['actors','world-leaders','ceos-founders','musicians','athletes','tv-reality','other'];
begin
  if p_day is null then raise exception 'A UTC day is required'; end if;
  if p_category is not null and not (p_category=any(active_categories)) then
    raise exception 'Unknown category';
  end if;
  foreach category in array active_categories loop
    if p_category is not null and p_category<>category then continue; end if;
    -- Cron, a manual run, and the API fallback share this transaction lock.
    perform pg_advisory_xact_lock(hashtextextended('blurrle:' || p_day::text || ':' || category,0));
    select count(*) into existing from public.daily_images d where d.day=p_day and d.category_slug=category;
    if existing=5 then
      result := result || jsonb_build_array(jsonb_build_object('category',category,'status','preserved'));
      continue;
    elsif existing<>0 then
      raise exception 'Incomplete daily selection for % on %; manual repair required',category,p_day;
    end if;
    select jsonb_agg(jsonb_build_object('person_id',draw.id,'portrait_id',draw.portrait_id) order by draw.rank)
      into selected from (
        select eligible.id,eligible.portrait_id,random() as rank
        from public.blurrle_playable_people eligible
        where category=any(eligible.categories)
        order by rank limit 5
      ) draw;
    if coalesce(jsonb_array_length(selected),0)<5 then
      result := result || jsonb_build_array(jsonb_build_object('category',category,'status','insufficient-content'));
      continue;
    end if;
    insert into public.daily_images(day,category_slug,position,person_id,portrait_id)
      select p_day,category,(entry.position-1)::integer,entry.person->>'person_id',entry.person->>'portrait_id'
      from jsonb_array_elements(selected) with ordinality as entry(person,position);
    result := result || jsonb_build_array(jsonb_build_object('category',category,'status','created'));
  end loop;
  return result;
end;
$$;
revoke all on function public.generate_blurrle_daily(date,text) from public,anon,authenticated;
grant execute on function public.generate_blurrle_daily(date,text) to service_role;

-- The daily seed also runs on-demand if Cron was delayed or the project paused.
create extension if not exists pg_cron;
select cron.schedule('blurrle-daily-selection','0 0 * * *',
  $$select public.generate_blurrle_daily((now() at time zone 'UTC')::date);$$);

-- Status can be checked using the server key, without exposing cron tables.
create or replace function public.blurrle_daily_job_status()
returns jsonb language sql security definer set search_path=public,pg_temp
as $$
  select jsonb_build_object('job',
    (select to_jsonb(j) from (select jobname,schedule,active from cron.job where jobname='blurrle-daily-selection') j),
    'lastRun',(select to_jsonb(r) from (
      select status,start_time,end_time from cron.job_run_details
      where jobid=(select jobid from cron.job where jobname='blurrle-daily-selection')
      order by start_time desc limit 1) r));
$$;
revoke all on function public.blurrle_daily_job_status() from public,anon,authenticated;
grant execute on function public.blurrle_daily_job_status() to service_role;
commit;
