-- Fictional NYC studios and classes for the AvoPore demo.
-- Safe to rerun: existing sessions keep their original dates and bookings.
insert into public.studios (slug, name, neighborhood, address, description)
values
  ('clay-house', 'Clay House', 'Greenpoint', 'Greenpoint, Brooklyn, NY',
    'A small ceramics studio with a working pottery wheel room and shelves full of test glazes.'),
  ('pull-press', 'Pull Press Studio', 'Bushwick', 'Bushwick, Brooklyn, NY',
    'A print shop for hands-on workshops in paper, ink, and original editions.'),
  ('common-thread', 'Common Thread', 'Long Island City', 'Long Island City, Queens, NY',
    'An open textiles workshop with small looms, colorful yarn, and generous table space.'),
  ('color-field', 'Color Field Studio', 'Lower East Side', 'Lower East Side, Manhattan, NY',
    'A light-filled painting studio offering guided classes around New York cityscapes.'),
  ('fieldwork-florals', 'Fieldwork Florals', 'Park Slope', 'Park Slope, Brooklyn, NY',
    'A neighborhood flower workshop working with seasonal stems and local growers.')
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
      100, 'florals', 'Beginner', 8, 1650)
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
    ('00000000-0000-4000-a000-000000000018', 'dried-botanical-wreaths', 15, '12:00', 10, 7, null)
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
