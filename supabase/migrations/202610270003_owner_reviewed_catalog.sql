-- Owner-approved catalog photos can be played without inventing missing credits.
-- Run once in Supabase SQL Editor. Existing daily selections are preserved.
begin;
create or replace view public.blurrle_playable_people as
select p.id,p.name,p.accepted_answers,p.hint,
  r.id as portrait_id,r.storage_bucket,r.storage_path,
  coalesce(r.image_source_url,r.source_dataset_url) as image_source_url,
  coalesce(r.image_license_name,'Dataset license: ' || r.dataset_license_name) as image_license_name,
  coalesce(r.image_license_url,r.dataset_license_url) as image_license_url,
  coalesce(r.attribution,'Individual photographer not supplied by source dataset') as attribution,
  coalesce((select array_agg(pc.category_slug order by pc.category_slug)
    from public.person_categories pc where pc.person_id=p.id),'{}') as categories
from public.people p
cross join lateral (
  select photo.* from public.portraits photo
  where photo.person_id=p.id and photo.review_status='approved'
    and (
      (nullif(photo.image_source_url,'') is not null
       and nullif(photo.image_license_name,'') is not null
       and nullif(photo.image_license_url,'') is not null)
      or photo.source_metadata->'owner_review'->>'approved_for_game'='true'
    )
    and exists(select 1 from storage.objects o where o.bucket_id=photo.storage_bucket and o.name=photo.storage_path)
  -- Prefer the individually credited portrait when multiple photos exist.
  order by (nullif(photo.image_license_url,'') is not null) desc,photo.imported_at desc,photo.id limit 1
) r
where p.review_status='approved' and nullif(trim(p.hint),'') is not null;
revoke all on public.blurrle_playable_people from public,anon,authenticated;
grant select on public.blurrle_playable_people to service_role;
commit;
