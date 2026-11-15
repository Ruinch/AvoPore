-- Fictional AvoPore inventory. Each state starts with one demo city and nine workshop categories.
-- Re-running this seed adds upcoming dates without changing any existing bookings.

with destinations(state_code, city_slug, city, timezone) as (
  values
    ('AL', 'birmingham', 'Birmingham', 'America/Chicago'),
    ('AK', 'anchorage', 'Anchorage', 'America/Anchorage'),
    ('AZ', 'phoenix', 'Phoenix', 'America/Phoenix'),
    ('AR', 'little-rock', 'Little Rock', 'America/Chicago'),
    ('CA', 'los-angeles', 'Los Angeles', 'America/Los_Angeles'),
    ('CO', 'denver', 'Denver', 'America/Denver'),
    ('CT', 'new-haven', 'New Haven', 'America/New_York'),
    ('DE', 'wilmington', 'Wilmington', 'America/New_York'),
    ('FL', 'miami', 'Miami', 'America/New_York'),
    ('GA', 'atlanta', 'Atlanta', 'America/New_York'),
    ('HI', 'honolulu', 'Honolulu', 'Pacific/Honolulu'),
    ('ID', 'boise', 'Boise', 'America/Boise'),
    ('IL', 'chicago', 'Chicago', 'America/Chicago'),
    ('IN', 'indianapolis', 'Indianapolis', 'America/Indiana/Indianapolis'),
    ('IA', 'des-moines', 'Des Moines', 'America/Chicago'),
    ('KS', 'wichita', 'Wichita', 'America/Chicago'),
    ('KY', 'louisville', 'Louisville', 'America/Kentucky/Louisville'),
    ('LA', 'new-orleans', 'New Orleans', 'America/Chicago'),
    ('ME', 'bangor', 'Bangor', 'America/New_York'),
    ('MD', 'baltimore', 'Baltimore', 'America/New_York'),
    ('MA', 'boston', 'Boston', 'America/New_York'),
    ('MI', 'detroit', 'Detroit', 'America/Detroit'),
    ('MN', 'minneapolis', 'Minneapolis', 'America/Chicago'),
    ('MS', 'jackson', 'Jackson', 'America/Chicago'),
    ('MO', 'st-louis', 'St. Louis', 'America/Chicago'),
    ('MT', 'billings', 'Billings', 'America/Denver'),
    ('NE', 'omaha', 'Omaha', 'America/Chicago'),
    ('NV', 'las-vegas', 'Las Vegas', 'America/Los_Angeles'),
    ('NH', 'manchester', 'Manchester', 'America/New_York'),
    ('NJ', 'newark', 'Newark', 'America/New_York'),
    ('NM', 'albuquerque', 'Albuquerque', 'America/Denver'),
    ('NY', 'new-york', 'New York City', 'America/New_York'),
    ('NC', 'charlotte', 'Charlotte', 'America/New_York'),
    ('ND', 'fargo', 'Fargo', 'America/Chicago'),
    ('OH', 'columbus', 'Columbus', 'America/New_York'),
    ('OK', 'oklahoma-city', 'Oklahoma City', 'America/Chicago'),
    ('OR', 'portland', 'Portland', 'America/Los_Angeles'),
    ('PA', 'philadelphia', 'Philadelphia', 'America/New_York'),
    ('RI', 'providence', 'Providence', 'America/New_York'),
    ('SC', 'charleston', 'Charleston', 'America/New_York'),
    ('SD', 'sioux-falls', 'Sioux Falls', 'America/Chicago'),
    ('TN', 'nashville', 'Nashville', 'America/Chicago'),
    ('TX', 'austin', 'Austin', 'America/Chicago'),
    ('UT', 'salt-lake-city', 'Salt Lake City', 'America/Denver'),
    ('VT', 'burlington', 'Burlington', 'America/New_York'),
    ('VA', 'richmond', 'Richmond', 'America/New_York'),
    ('WA', 'seattle', 'Seattle', 'America/Los_Angeles'),
    ('WV', 'morgantown', 'Morgantown', 'America/New_York'),
    ('WI', 'milwaukee', 'Milwaukee', 'America/Chicago'),
    ('WY', 'cheyenne', 'Cheyenne', 'America/Denver')
), inserted_studios as (
  insert into public.studios (slug, name, neighborhood, address, description, city, timezone, state_code)
  select 'demo-workshop-lab-' || city_slug || '-' || lower(state_code),
    city || ' Workshop Lab', 'Demo studio', city || ', ' || state_code,
    'An illustrative studio program for the AvoPore demo in ' || city || '.',
    city, timezone, state_code
  from destinations
  on conflict (slug) do nothing
  returning id, slug, city, timezone, state_code
), demo_studios as (
  select id, slug, city, timezone, state_code from inserted_studios
  union all
  select s.id, s.slug, s.city, s.timezone, s.state_code
  from public.studios s
  join destinations d on s.slug = 'demo-workshop-lab-' || d.city_slug || '-' || lower(d.state_code)
), formats(category, variant, slug, title, description, included, take_home, level, duration_minutes, token_cost, payout_cents) as (
  values
    ('ceramics', 0, 'clay-herb-markers', 'Clay Herb Markers', 'Roll a slab, cut a set of plant markers, and use stamps to add names and texture. Finish the set with colored underglaze.', 'Clay, rolling guides, letter stamps, underglaze, and firing.', 'A set of fired markers for your own plants, ready for later pickup.', 'Beginner', 100, 7, 1500),
    ('ceramics', 1, 'slab-built-trays', 'Slab-Built Clay Trays', 'Shape a clay tray over a form. Smooth and trim the edges, then test a surface pattern on a clay offcut.', 'Clay, templates, trimming tools, glaze, and firing.', 'One finished tray, ready for pickup after firing.', 'Beginner', 115, 8, 1750),
    ('printmaking', 0, 'botanical-monoprinting', 'Botanical Monoprinting', 'Arrange leaves and small stencils on a printing plate. Build two contrasting layers, then pull a one-of-a-kind print.', 'Reusable plates, ink, brayers, botanicals, and paper.', 'A small set of botanical prints.', 'All levels', 95, 6, 1150),
    ('printmaking', 1, 'two-block-relief-prints', 'Two-Block Relief Prints', 'Break a drawing into two shapes, transfer them to soft blocks, and test registration before printing both layers.', 'Soft blocks, carving tools, ink, paper, and registration guides.', 'An edition of two-color prints and your reusable blocks.', 'Beginner', 120, 8, 1650),
    ('textiles', 0, 'hand-embroidery', 'Hand Embroidery Essentials', 'Practice outline and fill stitches, then combine them in a small floral or geometric design.', 'An embroidery hoop, needles, fabric, thread, and a pattern sheet.', 'One finished hoop design and your practice samples.', 'Beginner', 100, 6, 1200),
    ('textiles', 1, 'shibori-bandanas', 'Shibori Bandanas', 'Fold and bind a cotton bandana before dyeing. Unwrap the cloth to compare the patterns made by different folds and ties.', 'Cotton bandanas, dye, binding tools, gloves, and care instructions.', 'One dyed cotton bandana.', 'Beginner', 105, 7, 1450),
    ('painting', 0, 'gouache-postcards', 'Gouache Postcards', 'Use opaque watercolor to make bright postcard-sized scenes. Practice layering simple shapes and mixing a limited palette.', 'Gouache, brushes, paper, palettes, and reference images.', 'A set of hand-painted postcards.', 'Beginner', 90, 6, 1100),
    ('painting', 1, 'watercolor-botanicals', 'Watercolor Botanicals', 'Sketch a leaf or sprig, paint a pale wash, then add details with a small brush once the first layer dries.', 'Watercolor paper, paints, brushes, palettes, and specimen references.', 'A botanical watercolor and a practice sheet.', 'All levels', 100, 7, 1300),
    ('florals', 0, 'pressed-flower-frames', 'Pressed Flower Frames', 'Arrange pressed flowers in a small frame. Try two layouts before mounting your final selection.', 'Pressed botanicals, tweezers, archival paper, and a tabletop frame.', 'One framed botanical composition.', 'Beginner', 90, 8, 1700),
    ('florals', 1, 'market-bouquet-design', 'Market Bouquet Design', 'Trim seasonal stems, choose a focal flower, and practice tying a bouquet that holds its shape.', 'Seasonal flowers, foliage, loaner clippers, wraps, and twine.', 'Your wrapped seasonal bouquet and a stem care card.', 'Beginner', 100, 9, 1950),
    ('jewelry', 0, 'wire-wrapped-pendants', 'Wire-Wrapped Pendants', 'Shape and wrap metal wire around a stone. Learn to make a clean hanging loop and fit it to a cord.', 'Jewelry wire, a stone, a necklace cord, and loaner tools.', 'One stone pendant on a cord.', 'Beginner', 105, 8, 1550),
    ('jewelry', 1, 'metal-stamped-charms', 'Metal-Stamped Charms', 'Lay out letters and symbols on a metal blank. Practice impression depth on scrap before making your charm.', 'Metal blanks, stamps, striking blocks, and findings.', 'Two stamped charms to attach to a chain or keyring.', 'Beginner', 95, 8, 1550),
    ('woodworking', 0, 'cedar-keepsake-boxes', 'Cedar Keepsake Boxes', 'Fit pre-cut cedar pieces into a box, assemble the sides, and hand-sand the edges before applying finish.', 'Pre-cut cedar, clamps, sandpaper, glue, and finishing oil.', 'One assembled cedar box.', 'Beginner', 130, 10, 2150),
    ('woodworking', 1, 'wooden-phone-stands', 'Wooden Phone Stands', 'Use a supplied hardwood blank to fit a groove to your phone, then sand and finish the piece by hand.', 'A hardwood blank, loaner hand tools, sandpaper, and finishing oil.', 'A wooden phone stand made to fit your device.', 'Beginner', 110, 9, 1850),
    ('cooking', 0, 'fresh-pasta-by-hand', 'Fresh Pasta by Hand', 'Mix and knead a simple pasta dough, roll it by hand, and cut ribbons to cook together in class.', 'Ingredients, aprons, bowls, rollers, and a printed recipe.', 'A recipe card and tasting portion prepared in class.', 'Beginner', 125, 10, 2200),
    ('cooking', 1, 'seasonal-dumplings', 'Seasonal Dumplings', 'Prepare a seasonal vegetable filling, practice two folding shapes, and cook a small batch together.', 'Ingredients, prep tools, a loaner apron, and recipe notes.', 'A tasting portion and a recipe to make dumplings at home.', 'Beginner', 120, 10, 2150),
    ('photography', 0, 'neighborhood-photo-walk', 'Neighborhood Photo Walk', 'Practice framing, perspective, and exposure on a short walk, then review a few favorite images together.', 'A prompt sheet and an instructor-led image review. Bring a phone or camera.', 'Your own series of images and a framing checklist.', 'All levels', 105, 7, 1300),
    ('photography', 1, 'still-life-photography', 'Still-Life Photography', 'Use window light and a simple reflector to photograph a tabletop scene. Move the subject and adjust the camera angle to compare shadows.', 'Props, a backdrop, reflectors, and an instructor-led review. Bring a phone or camera.', 'A set of still-life images and notes on your lighting setup.', 'All levels', 105, 7, 1300)
), planned_workshops as (
  select s.id as studio_id, s.timezone,
    f.slug || '-' || d.city_slug || '-' || lower(d.state_code) as slug,
    f.title, f.category, f.description, f.included, f.take_home, f.level,
    f.duration_minutes, f.token_cost, f.payout_cents
  from demo_studios s
  join destinations d on d.city = s.city and d.state_code = s.state_code
  join formats f on f.variant = get_byte(decode(md5(s.slug || ':' || f.category), 'hex'), 0) % 2
), inserted_workshops as (
  insert into public.class_templates (
    studio_id, slug, title, category, description, included, experience,
    take_home, duration_minutes, image_key, level, token_cost, payout_cents
  )
  select studio_id, slug, title, category, description, included,
    case when level = 'Beginner' then 'No previous experience required.' else 'Beginners and experienced participants are welcome.' end,
    take_home, duration_minutes, category, level, token_cost, payout_cents
  from planned_workshops
  on conflict (slug) do nothing
  returning id, slug
), demo_workshops as (
  select id, slug from inserted_workshops
  union all
  select t.id, t.slug from public.class_templates t join planned_workshops p using (slug)
), timetable(category, weekday, local_time, capacity, quota) as (
  values
    ('ceramics', 1, '18:30'::time, 10, 8),
    ('printmaking', 2, '18:00', 12, 8),
    ('textiles', 3, '18:00', 10, 8),
    ('painting', 5, '11:00', 14, 10),
    ('florals', 6, '11:30', 10, 8),
    ('jewelry', 4, '18:00', 10, 8),
    ('woodworking', 5, '14:30', 8, 6),
    ('cooking', 3, '18:30', 12, 8),
    ('photography', 6, '14:00', 14, 10)
)
insert into public.sessions (template_id, starts_at, capacity, quota)
select w.id,
  ((first_slot.local_day + 7 * dates.week_offset) + t.local_time) at time zone p.timezone,
  t.capacity, t.quota
from demo_workshops w
join planned_workshops p using (slug)
join timetable t using (category)
cross join lateral (
  select date_trunc('week', now() at time zone p.timezone)::date + t.weekday as local_day
) as this_week
cross join lateral (
  select this_week.local_day + case
    when (this_week.local_day + t.local_time) at time zone p.timezone < now() + interval '24 hours' then 7
    else 0
  end as local_day
) as first_slot
cross join (values (0), (1), (2), (4)) as dates(week_offset)
on conflict (template_id, starts_at) do nothing;
