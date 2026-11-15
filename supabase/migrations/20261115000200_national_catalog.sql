alter table public.studios
  add column if not exists state_code text;

alter table public.studios
  drop constraint if exists studios_state_code_check;

alter table public.studios
  add constraint studios_state_code_check check (state_code in (
    'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA',
    'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS',
    'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA',
    'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
  ));

update public.studios as studio
set state_code = location.state_code
from (values
  ('New York City', 'America/New_York', 'NY'),
  ('Chicago', 'America/Chicago', 'IL'),
  ('Los Angeles', 'America/Los_Angeles', 'CA')
) as location(city, timezone, state_code)
where studio.state_code is null
  and studio.city = location.city
  and studio.timezone = location.timezone
  and right(studio.address, 4) = ', ' || location.state_code;

create index if not exists studios_state_city_idx on public.studios (state_code, city);

alter table public.class_templates
  drop constraint if exists class_templates_category_check;

alter table public.class_templates
  add constraint class_templates_category_check check (category in (
    'ceramics', 'printmaking', 'textiles', 'painting', 'florals',
    'jewelry', 'woodworking', 'cooking', 'photography'
  ));
