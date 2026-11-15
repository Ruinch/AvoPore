-- Fictional US studios and classes for the AvoPore demo.
-- Safe to rerun: existing sessions keep their original dates and bookings.
insert into public.studios (slug, name, neighborhood, address, description, city, timezone)
values
  ('clay-house', 'Clay House', 'Greenpoint', 'Greenpoint, Brooklyn, NY',
    'A small ceramics studio with a working pottery wheel room and shelves full of test glazes.', 'New York City', 'America/New_York'),
  ('pull-press', 'Pull Press Studio', 'Bushwick', 'Bushwick, Brooklyn, NY',
    'A print shop for hands-on workshops in paper, ink, and original editions.', 'New York City', 'America/New_York'),
  ('common-thread', 'Common Thread', 'Long Island City', 'Long Island City, Queens, NY',
    'An open textiles workshop with small looms, colorful yarn, and generous table space.', 'New York City', 'America/New_York'),
  ('color-field', 'Color Field Studio', 'Lower East Side', 'Lower East Side, Manhattan, NY',
    'A light-filled painting studio offering guided classes around New York cityscapes.', 'New York City', 'America/New_York'),
  ('fieldwork-florals', 'Fieldwork Florals', 'Park Slope', 'Park Slope, Brooklyn, NY',
    'A neighborhood flower workshop working with seasonal stems and local growers.', 'New York City', 'America/New_York'),
  ('blue-kiln-chicago', 'Blue Kiln Workshop', 'Pilsen', 'Pilsen, Chicago, IL',
    'A ceramics workshop with long handbuilding tables and a shelf of sample glazes.', 'Chicago', 'America/Chicago'),
  ('paper-yard-chicago', 'Paper Yard Print Shop', 'Logan Square', 'Logan Square, Chicago, IL',
    'A small print shop with a paper drying rack and bench space for cutting stencils.', 'Chicago', 'America/Chicago'),
  ('shoreline-color-chicago', 'Shoreline Color Room', 'Hyde Park', 'Hyde Park, Chicago, IL',
    'A painting room for small groups working from reference photographs and still lifes.', 'Chicago', 'America/Chicago'),
  ('mesa-clay-los-angeles', 'Mesa Clay Room', 'Frogtown', 'Frogtown, Los Angeles, CA',
    'A ceramics room with textured clay samples and shared handbuilding tables.', 'Los Angeles', 'America/Los_Angeles'),
  ('loose-thread-los-angeles', 'Loose Thread Workshop', 'Highland Park', 'Highland Park, Los Angeles, CA',
    'A textiles workshop with frame looms, reclaimed yarn and space for hand stitching.', 'Los Angeles', 'America/Los_Angeles'),
  ('wild-stems-los-angeles', 'Wild Stems Workroom', 'Atwater Village', 'Atwater Village, Los Angeles, CA',
    'A flower workroom offering small classes in fresh and dried arrangements.', 'Los Angeles', 'America/Los_Angeles')
on conflict (slug) do nothing;

insert into public.class_templates (
  studio_id, slug, title, category, description, included, experience,
  take_home, duration_minutes, image_key, level, token_cost, payout_cents
)
select d.id, t.slug, t.title, t.category, t.description, t.included, t.experience,
  t.take_home, t.duration_minutes, t.image_key, t.level, t.token_cost, t.payout_cents
from (
  values
    ('clay-house', 'wheel-throwing', 'Wheel Throwing', 'ceramics',
      'Center a ball of clay and learn how to pull the walls of a small bowl. Your instructor will demonstrate each step and help you finish a piece on your own wheel.',
      'Clay, wheel time, tools, a studio apron, glaze, and firing.',
      'No ceramics experience needed. Arrive ten minutes early to get settled.',
      'One glazed bowl. Pick it up from the studio in two to three weeks.',
      120, 'ceramics', 'Beginner', 8, 1800),
    ('clay-house', 'handbuilt-mugs', 'Handbuilt Mugs', 'ceramics',
      'Build a mug from slabs, learn how to attach a handle, and make a set of small glaze color choices. Your instructor will fire the finished piece for you.',
      'Clay, texture tools, a studio apron, glaze, and firing.',
      'Everyone is welcome, including first-time potters.',
      'One fired and glazed mug. Studio pickup in two to three weeks.',
      120, 'ceramics', 'Beginner', 8, 1800),
    ('pull-press', 'screen-printing', 'Screen Printing', 'printmaking',
      'Sketch a graphic, cut a paper stencil, and pull a run of prints in one color. Learn how pressure and ink affect the final image.',
      'Paper, screen, squeegee, stencil supplies, and water-based inks.',
      'No drawing or printmaking experience needed.',
      'A small edition of prints to frame or share.',
      105, 'printmaking', 'Beginner', 7, 1500),
    ('pull-press', 'linocut-postcards', 'Linocut Postcards', 'printmaking',
      'Carve a small design into a soft block, test your lines, and hand-print a set of postcards with a brayer.',
      'A carving block, paper, carving tools, and water-based ink.',
      'No previous printmaking experience needed. Your instructor demonstrates safe tool handling.',
      'Your reusable print block and a set of printed postcards.',
      105, 'printmaking', 'Beginner', 6, 1200),
    ('common-thread', 'frame-loom-weaving', 'Frame Loom Weaving', 'textiles',
      'Set up a frame loom, experiment with yarn textures, and weave a small wall hanging. Choose your own palette and practice the finishing knots.',
      'A loaner frame loom, seasonal yarn, wool roving, and a hanging dowel.',
      'No weaving experience needed.',
      'A finished tapestry on a wooden dowel.',
      120, 'textiles', 'Beginner', 7, 1450),
    ('common-thread', 'visible-mending', 'Visible Mending', 'textiles',
      'Work on a well-loved garment with hand stitching and a fabric patch. Learn a straight stitch, a repair pattern, and ways to make a patch durable.',
      'Thread, needles, hoops, sample cloth, and patch fabric. Bring a garment if you have one.',
      'Beginner-friendly. You can practice on the supplied fabric first.',
      'Your repaired garment or a stitched sampler, plus a stitch guide.',
      90, 'textiles', 'Beginner', 5, 950),
    ('color-field', 'watercolor-cityscapes', 'Watercolor Cityscapes', 'painting',
      'Paint a New York streetscape in layers. Start with a simple composition, practice a transparent wash, then add architectural details.',
      'Brushes, watercolor paper, paints, reference photos, and palette.',
      'All levels welcome. Follow the reference or bring your own photo.',
      'A small watercolor painting and a set of practice washes.',
      105, 'painting', 'All levels', 6, 1250),
    ('color-field', 'color-mixing-acrylics', 'Color Mixing with Acrylics', 'painting',
      'Mix a neutral and a vivid palette from a few base colors, then use them to paint a still life with simple shapes on a panel.',
      'Brushes, acrylic paint, palette, apron, still life props, and a canvas panel.',
      'No prior painting experience needed.',
      'A color chart and an original still life on a canvas panel.',
      115, 'painting', 'Beginner', 7, 1450),
    ('fieldwork-florals', 'seasonal-flower-arranging', 'Seasonal Flower Arranging', 'florals',
      'Learn how to prepare and group stems, build the shape of an arrangement, and care for fresh cut flowers at home.',
      'Seasonal stems, foliage, a vase, loaner clippers, and a care card.',
      'No flower arranging experience needed.',
      'A fresh arrangement in a reusable vase.',
      90, 'florals', 'Beginner', 9, 2050),
    ('fieldwork-florals', 'dried-botanical-wreaths', 'Dried Botanical Wreaths', 'florals',
      'Layer dried leaves and flowers on a simple wreath base. Experiment with asymmetry and learn how to secure stems with floral wire.',
      'Dried botanicals, a wreath base, wire, ribbon, and loaner clippers.',
      'No experience needed.',
      'A finished botanical wreath for your home.',
      100, 'florals', 'Beginner', 8, 1650),
    ('blue-kiln-chicago', 'pinch-pot-planters-chicago', 'Pinch Pot Planters', 'ceramics',
      'Make a small planter and saucer from clay. Shape the walls by hand, add drainage holes, and mark the surface with simple patterns.',
      'Clay, shaping tools, glaze and firing.',
      'Beginners are welcome. Bring a small plant pot if you want to match its size.',
      'One glazed planter and saucer, ready for pickup after firing.',
      110, 'ceramics', 'Beginner', 7, 1450),
    ('paper-yard-chicago', 'two-color-screen-printing-chicago', 'Two-Color Screen Printing', 'printmaking',
      'Make a two-color design with paper stencils. Learn to line up each layer before pulling a small edition of prints.',
      'Screen time, water-based inks, paper, stencils and a loaner squeegee.',
      'Suitable for a first screen printing class.',
      'Three two-color prints on paper.',
      120, 'printmaking', 'Beginner', 8, 1700),
    ('shoreline-color-chicago', 'lakefront-watercolors-chicago', 'Lakefront Watercolors', 'painting',
      'Paint a Lake Michigan view from a photo. Practice the wet-on-wet wash for the sky, then work on reflections and the shoreline.',
      'Watercolor paper, paints, brushes and reference photos.',
      'All levels welcome. A short demonstration covers the basics.',
      'One finished watercolor and a practice sheet.',
      105, 'painting', 'All levels', 6, 1250),
    ('mesa-clay-los-angeles', 'textured-clay-tiles-los-angeles', 'Textured Clay Tiles', 'ceramics',
      'Roll a slab, build a repeating pattern with stamps, and finish three small tiles with your choice of underglaze.',
      'Clay, texture stamps, underglaze and firing.',
      'No clay experience needed.',
      'Three fired tiles, ready for pickup after firing.',
      105, 'ceramics', 'Beginner', 7, 1500),
    ('loose-thread-los-angeles', 'scrap-yarn-weaving-los-angeles', 'Scrap Yarn Weaving', 'textiles',
      'Use reclaimed yarn to weave a sampler on a small frame loom. Try two ways to change color and finish the edge.',
      'Loaner loom, reclaimed yarn, weaving tools and a hanging dowel.',
      'No weaving experience needed. Bring spare yarn if you have it.',
      'A miniature woven wall hanging.',
      120, 'textiles', 'Beginner', 7, 1450),
    ('wild-stems-los-angeles', 'dried-flower-arranging-los-angeles', 'Dried Flower Arranging', 'florals',
      'Arrange dried grasses and stems in a small vase. Learn how to build a shape, handle brittle stems and keep the arrangement in good condition.',
      'Dried foliage and flowers, loaner clippers and a vase.',
      'Suitable for beginners.',
      'A dried arrangement in a reusable vase.',
      90, 'florals', 'Beginner', 8, 1700)
) as t(
  studio_slug, slug, title, category, description, included, experience,
  take_home, duration_minutes, image_key, level, token_cost, payout_cents
)
join public.studios d on d.slug = t.studio_slug
on conflict (slug) do nothing;

-- The first two sessions support same-day check-in and late cancellation.
with late_demo_slot as (
  select min(slot) as starts_at
  from (values (0), (1)) as days(offset_days)
  cross join (values ('11:00'::time), ('18:30'::time)) as times(local_time)
  cross join lateral (
    select (((now() at time zone 'America/New_York')::date + days.offset_days + times.local_time)
      at time zone 'America/New_York') as slot
  ) times_nyc
  where slot > now() + interval '90 minutes'
), demo_schedule as (
  select *
  from (values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'wheel-throwing', 0, '00:00'::time, 8, 6, interval '30 minutes'),
    ('00000000-0000-4000-a000-000000000002', 'wheel-throwing', 0, '00:00', 8, 6, null),
    ('00000000-0000-4000-a000-000000000003', 'wheel-throwing', 3, '18:30', 8, 7, null),
    ('00000000-0000-4000-a000-000000000004', 'wheel-throwing', 10, '11:00', 8, 7, null),
    ('00000000-0000-4000-a000-000000000005', 'handbuilt-mugs', 5, '12:00', 10, 7, null),
    ('00000000-0000-4000-a000-000000000006', 'screen-printing', 2, '18:00', 12, 8, null),
    ('00000000-0000-4000-a000-000000000007', 'screen-printing', 8, '14:00', 12, 8, null),
    ('00000000-0000-4000-a000-000000000008', 'linocut-postcards', 6, '13:00', 10, 6, null),
    ('00000000-0000-4000-a000-000000000009', 'linocut-postcards', 14, '17:30', 10, 8, null),
    ('00000000-0000-4000-a000-000000000010', 'frame-loom-weaving', 4, '18:00', 8, 6, null),
    ('00000000-0000-4000-a000-000000000011', 'frame-loom-weaving', 12, '12:30', 8, 6, null),
    ('00000000-0000-4000-a000-000000000012', 'visible-mending', 7, '11:00', 10, 8, null),
    ('00000000-0000-4000-a000-000000000013', 'watercolor-cityscapes', 3, '19:00', 14, 10, null),
    ('00000000-0000-4000-a000-000000000014', 'watercolor-cityscapes', 9, '11:30', 14, 10, null),
    ('00000000-0000-4000-a000-000000000015', 'color-mixing-acrylics', 13, '18:00', 12, 7, null),
    ('00000000-0000-4000-a000-000000000016', 'seasonal-flower-arranging', 4, '19:00', 10, 6, null),
    ('00000000-0000-4000-a000-000000000017', 'seasonal-flower-arranging', 11, '14:00', 10, 8, null),
    ('00000000-0000-4000-a000-000000000018', 'dried-botanical-wreaths', 15, '12:00', 10, 7, null),
    ('00000000-0000-4000-a000-000000000019', 'pinch-pot-planters-chicago', 2, '18:30', 10, 8, null),
    ('00000000-0000-4000-a000-000000000020', 'pinch-pot-planters-chicago', 9, '11:00', 10, 7, null),
    ('00000000-0000-4000-a000-000000000021', 'two-color-screen-printing-chicago', 4, '18:00', 10, 6, null),
    ('00000000-0000-4000-a000-000000000022', 'two-color-screen-printing-chicago', 12, '13:00', 10, 8, null),
    ('00000000-0000-4000-a000-000000000023', 'lakefront-watercolors-chicago', 5, '12:00', 12, 9, null),
    ('00000000-0000-4000-a000-000000000024', 'lakefront-watercolors-chicago', 13, '19:00', 12, 8, null),
    ('00000000-0000-4000-a000-000000000025', 'textured-clay-tiles-los-angeles', 2, '19:00', 10, 6, null),
    ('00000000-0000-4000-a000-000000000026', 'textured-clay-tiles-los-angeles', 10, '11:30', 10, 7, null),
    ('00000000-0000-4000-a000-000000000027', 'scrap-yarn-weaving-los-angeles', 3, '18:30', 8, 6, null),
    ('00000000-0000-4000-a000-000000000028', 'scrap-yarn-weaving-los-angeles', 11, '13:00', 8, 5, null),
    ('00000000-0000-4000-a000-000000000029', 'dried-flower-arranging-los-angeles', 6, '16:00', 10, 8, null),
    ('00000000-0000-4000-a000-000000000030', 'dried-flower-arranging-los-angeles', 14, '11:00', 10, 7, null)
  ) as t(id, template_slug, day_offset, local_time, capacity, quota, relative_start)
)
insert into public.sessions (id, template_id, starts_at, capacity, quota)
select s.id, c.id, case
  when s.id = '00000000-0000-4000-a000-000000000002' then late_demo_slot.starts_at
  when s.relative_start is not null then now() + s.relative_start
  else ((now() at time zone d.timezone)::date + s.day_offset + s.local_time) at time zone d.timezone
  end,
  s.capacity, s.quota
from demo_schedule s
join public.class_templates c on c.slug = s.template_slug
join public.studios d on d.id = c.studio_id
cross join late_demo_slot
on conflict do nothing;
