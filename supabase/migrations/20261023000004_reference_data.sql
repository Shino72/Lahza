-- Permission catalogue, role defaults, initial categories and site settings.

insert into public.permissions (key, description) values
  ('article.create', 'Create article drafts'),
  ('article.edit_own', 'Edit own drafts and articles in review'),
  ('article.edit_any', 'Edit any unpublished article'),
  ('article.submit', 'Submit articles for review'),
  ('article.publish', 'Approve, publish, schedule, unpublish and archive articles'),
  ('article.delete', 'Delete articles'),
  ('media.upload', 'Upload images'),
  ('media.manage', 'Edit and delete any image'),
  ('category.manage', 'Manage categories'),
  ('homepage.manage', 'Manage homepage order and the breaking-news ticker'),
  ('settings.manage', 'Edit contact details, leadership and page copy'),
  ('inquiry.read', 'Read advertising inquiries'),
  ('inquiry.manage', 'Update and delete advertising inquiries'),
  ('staff.read', 'View staff accounts'),
  ('staff.invite', 'Invite staff and revoke invitations'),
  ('staff.manage', 'Change roles, permissions and account status'),
  ('audit.read', 'View the audit log');

insert into public.role_permissions (role, permission)
select 'manager'::public.app_role, p from unnest(array[
  'article.create', 'article.edit_own', 'article.edit_any', 'article.submit', 'article.publish', 'article.delete',
  'media.upload', 'media.manage', 'category.manage', 'homepage.manage', 'settings.manage',
  'inquiry.read', 'inquiry.manage', 'staff.read'
]) p
union all
select 'editor'::public.app_role, p from unnest(array[
  'article.create', 'article.edit_own', 'article.edit_any', 'article.submit', 'article.publish',
  'media.upload', 'homepage.manage'
]) p
union all
select 'journalist'::public.app_role, p from unnest(array[
  'article.create', 'article.edit_own', 'article.submit', 'media.upload'
]) p;

insert into public.categories (slug, name_ar, name_en, description_ar, description_en, sort_order) values
  ('egypt', 'مصر', 'Egypt', 'أخبار المحافظات والخدمات والشأن المحلي في مصر.', 'Local news, services and public affairs across Egypt.', 1),
  ('politics', 'سياسة', 'Politics', 'تغطية الشأن السياسي والبرلماني والقرارات الحكومية.', 'Political, parliamentary and government coverage.', 2),
  ('arab-world', 'عرب وعالم', 'Arab & World', 'أبرز الأحداث في المنطقة العربية والعالم.', 'Major developments in the Arab region and worldwide.', 3),
  ('economy', 'اقتصاد', 'Economy', 'الأسواق والأسعار والاستثمار والمال.', 'Markets, prices, investment and finance.', 4),
  ('sports', 'رياضة', 'Sports', 'الدوري المصري والبطولات العربية والعالمية.', 'Egyptian league, Arab and international competitions.', 5),
  ('entertainment', 'فن', 'Entertainment', 'أخبار الفن والسينما والموسيقى.', 'Film, music and arts news.', 6),
  ('drama', 'دراما', 'Drama', 'المسلسلات والأعمال الدرامية وكواليسها.', 'TV series and drama productions.', 7),
  ('crime', 'حوادث', 'Crime & Incidents', 'الحوادث والقضايا وأخبار المحاكم.', 'Incidents, cases and court news.', 8),
  ('technology', 'تكنولوجيا', 'Technology', 'التقنية والاتصالات والذكاء الاصطناعي.', 'Technology, telecoms and AI.', 9),
  ('lifestyle', 'لايف ستايل', 'Lifestyle', 'الصحة والأسرة والسفر والحياة اليومية.', 'Health, family, travel and daily life.', 10);

insert into public.site_settings (key, value) values
  ('contact', jsonb_build_object(
    'phone', '01101135785',
    'phoneLabel', 'WhatsApp & Call',
    'whatsapp', 'https://wa.me/201101135785',
    'email', 'Seifkhaledamer6@gmail.com'
  )),
  ('leadership', jsonb_build_array(
    jsonb_build_object('roleAr', 'رئيس مجلس الإدارة', 'roleEn', 'Chairman of the Board', 'nameAr', 'سيف خالد عامر', 'nameEn', 'Seif Khaled Amer'),
    jsonb_build_object('roleAr', 'رئيسة التحرير', 'roleEn', 'Editor-in-Chief', 'nameAr', 'ريم حرب', 'nameEn', 'Reem Harb')
  )),
  ('advertise', jsonb_build_object(
    'introAr', 'نوفّر للشركات والمؤسسات مساحات إعلانية على موقع لحظة. تواصل مع فريق الإعلانات لمعرفة المساحات المتاحة والتفاصيل، وسنرد عليك في أقرب وقت.',
    'introEn', 'Lahza offers advertising space to companies and organisations. Contact our advertising team for available placements and details, and we will get back to you shortly.'
  )),
  ('tagline', jsonb_build_object(
    'ar', 'أخبار مصر والعالم لحظة بلحظة',
    'en', 'News from Egypt and the world, moment by moment'
  ));
