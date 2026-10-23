import type { Article, ArticleBlock, HomepageSlot, TickerItem } from '../types';

/*
 * Preview fixtures. They exist only so the layout can be reviewed before the
 * database is connected. Every story here is fictional, is marked `isSample`,
 * and the demo source keeps the whole site out of search engines.
 */

const paragraphs = (...texts: string[]): ArticleBlock[] =>
  texts.map((text) => ({ type: 'paragraph', text }));

const SAMPLE_AUTHOR_AR = 'فريق التحرير';
const SAMPLE_AUTHOR_EN = 'Lahza Desk';

interface Fixture {
  id: string;
  categoryId: string;
  slug: string;
  publishAt: string;
  title: string;
  summary: string;
  body: ArticleBlock[];
  tags: string[];
  imageAlt: string;
  translationKey?: string;
  status?: Article['status'];
  lang?: Article['lang'];
  author?: string;
}

const make = (f: Fixture): Article => ({
  id: f.id,
  lang: f.lang ?? 'ar',
  slug: f.slug,
  status: f.status ?? 'published',
  publishAt: f.publishAt,
  updatedAt: f.publishAt,
  categoryId: f.categoryId,
  title: f.title,
  summary: f.summary,
  body: f.body,
  author: f.author ?? ((f.lang ?? 'ar') === 'ar' ? SAMPLE_AUTHOR_AR : SAMPLE_AUTHOR_EN),
  image: { alt: f.imageAlt },
  tags: f.tags,
  translationKey: f.translationKey,
  isSample: true,
});

export const demoArticles: Article[] = [
  // مصر
  make({
    id: 'a-egypt-1', categoryId: 'egypt', slug: 'new-public-library-opens', publishAt: '2026-10-23T08:30:00Z',
    translationKey: 'library',
    title: 'افتتاح مكتبة عامة جديدة تضم قاعات للأطفال والباحثين',
    summary: 'المكتبة تفتح أبوابها يوميًا من التاسعة صباحًا وتوفر قاعة إلكترونية وبرامج قراءة أسبوعية.',
    body: paragraphs(
      'افتتحت إحدى المحافظات مكتبة عامة جديدة تضم ثلاث قاعات للقراءة وقاعة مخصصة للأطفال، إلى جانب ركن للحاسبات متاح للطلاب والباحثين.',
      'وقال مسؤول بالمكتبة إن مواعيد العمل تبدأ من التاسعة صباحًا حتى السابعة مساءً طوال أيام الأسبوع عدا الجمعة، وإن الاشتراك السنوي متاح برسوم رمزية.',
      'وتخطط إدارة المكتبة لتنظيم برنامج قراءة أسبوعي للأطفال وورش عمل في الكتابة والتصوير خلال الأشهر المقبلة.',
    ),
    tags: ['مكتبات', 'ثقافة', 'خدمات'], imageAlt: 'مدخل مكتبة عامة حديثة',
  }),
  make({
    id: 'a-egypt-2', categoryId: 'egypt', slug: 'metro-station-maintenance-schedule', publishAt: '2026-10-22T15:10:00Z',
    title: 'جدول أعمال صيانة لمحطات مترو خلال عطلة نهاية الأسبوع',
    summary: 'أعمال الصيانة تشمل السلالم الكهربائية وأنظمة الإضاءة مع استمرار حركة القطارات.',
    body: paragraphs(
      'أعلنت جهة تشغيل المترو عن تنفيذ أعمال صيانة دورية لعدد من المحطات خلال عطلة نهاية الأسبوع، تشمل السلالم الكهربائية وأنظمة الإضاءة.',
      'وأكدت أن حركة القطارات مستمرة بشكل طبيعي، مع إغلاق مؤقت لبعض المداخل وتوجيه الركاب إلى المداخل البديلة.',
      'ودعت الركاب إلى متابعة اللافتات الإرشادية داخل المحطات والالتزام بتعليمات العاملين.',
    ),
    tags: ['مترو', 'مواصلات'], imageAlt: 'رصيف محطة مترو',
  }),
  // سياسة
  make({
    id: 'a-politics-1', categoryId: 'politics', slug: 'youth-civic-forum', publishAt: '2026-10-23T07:00:00Z',
    title: 'منتدى شبابي يناقش آليات المشاركة في الحياة العامة',
    summary: 'المشاركون طرحوا مقترحات لتوسيع الحوار المجتمعي وتطوير برامج التدريب على القيادة.',
    body: paragraphs(
      'شهد منتدى شبابي نقاشات موسعة حول آليات المشاركة في الحياة العامة، بمشاركة طلاب جامعات وممثلين عن منظمات مجتمع مدني.',
      'وطرح المشاركون مقترحات لتوسيع قنوات الحوار المجتمعي، وتطوير برامج تدريبية على القيادة والعمل التطوعي.',
      'واختتم المنتدى أعماله بإعداد ورقة توصيات من المقرر رفعها إلى الجهات المعنية.',
    ),
    tags: ['شباب', 'حوار مجتمعي'], imageAlt: 'قاعة منتدى حواري',
  }),
  make({
    id: 'a-politics-2', categoryId: 'politics', slug: 'committee-reviews-local-services-bill', publishAt: '2026-10-21T12:00:00Z',
    title: 'لجنة برلمانية تبدأ مناقشة مشروع قانون لتنظيم الخدمات المحلية',
    summary: 'المناقشات تتناول تبسيط الإجراءات وتحديد مدد زمنية للرد على طلبات المواطنين.',
    body: paragraphs(
      'بدأت لجنة برلمانية مناقشة مشروع قانون يهدف إلى تنظيم الخدمات المحلية وتبسيط إجراءاتها.',
      'وتتناول المناقشات تحديد مدد زمنية واضحة للرد على طلبات المواطنين، وتوسيع الخدمات الإلكترونية.',
      'ومن المنتظر أن تستمع اللجنة إلى آراء الجهات المعنية قبل إعداد تقريرها النهائي.',
    ),
    tags: ['برلمان', 'تشريعات'], imageAlt: 'قاعة اجتماعات لجنة',
  }),
  // عرب وعالم
  make({
    id: 'a-world-1', categoryId: 'arab-world', slug: 'regional-water-conference', publishAt: '2026-10-22T09:45:00Z',
    translationKey: 'water',
    title: 'مؤتمر إقليمي يبحث حلول ندرة المياه في المنطقة العربية',
    summary: 'خبراء من عدة دول يناقشون تقنيات تحلية المياه وإعادة استخدامها في الزراعة.',
    body: paragraphs(
      'انطلقت أعمال مؤتمر إقليمي يناقش حلول ندرة المياه في المنطقة العربية، بمشاركة خبراء وباحثين من عدة دول.',
      'وتركز الجلسات على تقنيات تحلية المياه وإعادة استخدام المياه المعالجة في الزراعة، إلى جانب ترشيد الاستهلاك.',
      'ويختتم المؤتمر أعماله بإصدار توصيات حول التعاون الإقليمي في إدارة الموارد المائية.',
    ),
    tags: ['مياه', 'مؤتمرات'], imageAlt: 'منصة مؤتمر دولي',
  }),
  make({
    id: 'a-world-2', categoryId: 'arab-world', slug: 'international-book-fair-guests', publishAt: '2026-10-20T18:20:00Z',
    title: 'معرض دولي للكتاب يعلن برنامج ضيوفه لهذا العام',
    summary: 'البرنامج يشمل ندوات أدبية وأمسيات شعرية وورشًا للكتابة الإبداعية.',
    body: paragraphs(
      'أعلن معرض دولي للكتاب برنامج فعالياته لهذا العام، والذي يتضمن ندوات أدبية وأمسيات شعرية.',
      'ويشارك في المعرض ناشرون من دول عربية وأجنبية، مع تخصيص جناح لكتب الأطفال.',
      'وتقام على هامش المعرض ورش للكتابة الإبداعية والترجمة.',
    ),
    tags: ['كتب', 'ثقافة'], imageAlt: 'أرفف كتب في معرض',
  }),
  // اقتصاد
  make({
    id: 'a-economy-1', categoryId: 'economy', slug: 'small-business-financing-program', publishAt: '2026-10-23T06:15:00Z',
    translationKey: 'smb-financing',
    title: 'برنامج تمويل جديد للمشروعات الصغيرة بشروط ميسرة',
    summary: 'البرنامج يستهدف أصحاب الحرف والمشروعات الناشئة مع فترة سماح قبل بدء السداد.',
    body: paragraphs(
      'أعلنت جهة تمويلية عن برنامج جديد لدعم المشروعات الصغيرة، يستهدف أصحاب الحرف والمشروعات الناشئة.',
      'ويتضمن البرنامج فترة سماح قبل بدء السداد، إلى جانب تدريب على إدارة المشروعات والتسويق.',
      'ويمكن التقدم للبرنامج عبر الفروع المعتمدة أو من خلال الموقع الإلكتروني للجهة.',
    ),
    tags: ['تمويل', 'مشروعات صغيرة'], imageAlt: 'ورشة حرفية صغيرة',
  }),
  make({
    id: 'a-economy-2', categoryId: 'economy', slug: 'vegetable-market-prices-weekly', publishAt: '2026-10-21T08:00:00Z',
    title: 'تقرير أسبوعي: حركة أسعار الخضروات في أسواق الجملة',
    summary: 'التقرير يرصد تغيرات الأسعار خلال الأسبوع ويشرح العوامل المؤثرة فيها.',
    body: paragraphs(
      'يرصد هذا التقرير الأسبوعي حركة أسعار الخضروات في أسواق الجملة، وأبرز التغيرات مقارنة بالأسبوع السابق.',
      'ويرجع التجار التغيرات إلى عوامل موسمية وتكاليف النقل وحجم المعروض.',
      'وينصح التقرير المستهلكين بمقارنة الأسعار بين المنافذ المختلفة قبل الشراء.',
    ),
    tags: ['أسعار', 'أسواق'], imageAlt: 'سوق خضروات',
  }),
  // رياضة
  make({
    id: 'a-sports-1', categoryId: 'sports', slug: 'league-round-preview', publishAt: '2026-10-23T09:00:00Z',
    translationKey: 'league-preview',
    title: 'مباريات قوية في انتظار فرق الدوري هذا الأسبوع',
    summary: 'نظرة على أبرز مواجهات الجولة الجديدة وحسابات الفرق في جدول الترتيب.',
    body: paragraphs(
      'تنطلق الجولة الجديدة من الدوري هذا الأسبوع بعدد من المواجهات المهمة بين فرق المقدمة.',
      'ويسعى كل فريق إلى تحسين موقعه في جدول الترتيب قبل فترة التوقف الدولي.',
      'وتشهد الجولة عودة عدد من اللاعبين بعد التعافي من الإصابة.',
    ),
    tags: ['الدوري', 'كرة القدم'], imageAlt: 'ملعب كرة قدم قبل المباراة',
  }),
  make({
    id: 'a-sports-2', categoryId: 'sports', slug: 'youth-swimming-championship', publishAt: '2026-10-20T14:30:00Z',
    title: 'انطلاق بطولة الجمهورية للسباحة للناشئين',
    summary: 'البطولة تشهد مشاركة واسعة من الأندية في مختلف الفئات العمرية.',
    body: paragraphs(
      'انطلقت منافسات بطولة الجمهورية للسباحة للناشئين بمشاركة لاعبين من أندية مختلفة.',
      'وتقام المنافسات على مدار أربعة أيام في عدة فئات عمرية وسباقات متنوعة.',
      'وتمثل البطولة فرصة لاكتشاف المواهب الجديدة وإعدادها للمنافسات القارية.',
    ),
    tags: ['سباحة', 'ناشئين'], imageAlt: 'حمام سباحة أولمبي',
  }),
  // فن
  make({
    id: 'a-ent-1', categoryId: 'entertainment', slug: 'film-festival-lineup', publishAt: '2026-10-22T19:00:00Z',
    title: 'مهرجان سينمائي يكشف قائمة الأفلام المشاركة في دورته الجديدة',
    summary: 'القائمة تضم أفلامًا روائية وتسجيلية وقصيرة من عدة دول.',
    body: paragraphs(
      'كشف مهرجان سينمائي عن قائمة الأفلام المشاركة في دورته الجديدة، والتي تضم أفلامًا روائية وتسجيلية وقصيرة.',
      'وتتنافس الأفلام على جوائز المسابقة الرسمية، إلى جانب مسابقة مخصصة لأفلام الطلاب.',
      'ويتضمن البرنامج عروضًا خاصة وندوات مع صناع الأفلام.',
    ),
    tags: ['سينما', 'مهرجانات'], imageAlt: 'قاعة عرض سينمائي',
  }),
  make({
    id: 'a-ent-2', categoryId: 'entertainment', slug: 'open-air-concert-season', publishAt: '2026-10-21T17:00:00Z',
    title: 'موسم حفلات في الهواء الطلق يبدأ الشهر المقبل',
    summary: 'الموسم يضم حفلات موسيقية متنوعة بأسعار تذاكر مختلفة.',
    body: paragraphs(
      'يبدأ الشهر المقبل موسم حفلات موسيقية في الهواء الطلق يضم ألوانًا مختلفة من الموسيقى.',
      'وتتاح التذاكر عبر منافذ البيع المعتمدة، مع تخصيص عدد من المقاعد للطلاب.',
      'ويهدف الموسم إلى تنشيط الحركة الفنية وجذب جمهور جديد.',
    ),
    tags: ['موسيقى', 'حفلات'], imageAlt: 'مسرح مفتوح ليلًا',
  }),
  // دراما
  make({
    id: 'a-drama-1', categoryId: 'drama', slug: 'new-series-filming-begins', publishAt: '2026-10-22T11:30:00Z',
    title: 'بدء تصوير مسلسل اجتماعي جديد استعدادًا للعرض في الموسم المقبل',
    summary: 'العمل يتناول قصة أسرة مصرية عبر ثلاثة أجيال.',
    body: paragraphs(
      'بدأ فريق عمل مسلسل اجتماعي جديد التصوير في عدد من المواقع الخارجية، استعدادًا لعرضه في الموسم المقبل.',
      'ويتناول المسلسل قصة أسرة مصرية عبر ثلاثة أجيال، وما تواجهه من تحديات وتحولات.',
      'ومن المقرر أن يستمر التصوير لعدة أشهر بين القاهرة والإسكندرية.',
    ),
    tags: ['مسلسلات', 'تصوير'], imageAlt: 'كاميرا تصوير في موقع خارجي',
  }),
  make({
    id: 'a-drama-2', categoryId: 'drama', slug: 'screenwriting-workshop', publishAt: '2026-10-20T10:00:00Z',
    title: 'ورشة لكتابة السيناريو الدرامي تفتح باب التقديم',
    summary: 'الورشة تستمر ستة أسابيع وتنتهي بكتابة حلقة تجريبية لكل مشارك.',
    body: paragraphs(
      'فتحت إحدى المؤسسات الثقافية باب التقديم لورشة متخصصة في كتابة السيناريو الدرامي.',
      'وتستمر الورشة ستة أسابيع، يتعلم خلالها المشاركون بناء الشخصيات وتطوير الحبكة.',
      'وتنتهي الورشة بكتابة حلقة تجريبية لكل مشارك تتم مناقشتها مع المدربين.',
    ),
    tags: ['سيناريو', 'ورش'], imageAlt: 'أوراق سيناريو على مكتب',
  }),
  // حوادث
  make({
    id: 'a-crime-1', categoryId: 'crime', slug: 'traffic-safety-campaign', publishAt: '2026-10-23T05:40:00Z',
    title: 'حملة مرورية مكثفة للتوعية بمخاطر السرعة الزائدة',
    summary: 'الحملة تشمل نقاط توعية على الطرق الرئيسية وتوزيع إرشادات على السائقين.',
    body: paragraphs(
      'أطلقت الإدارة المختصة حملة مرورية للتوعية بمخاطر السرعة الزائدة على الطرق الرئيسية.',
      'وتشمل الحملة نقاط توعية وتوزيع إرشادات على السائقين، إلى جانب متابعة الالتزام بالسرعات المقررة.',
      'ودعت الإدارة المواطنين إلى الإبلاغ عن المخالفات عبر القنوات الرسمية.',
    ),
    tags: ['مرور', 'سلامة'], imageAlt: 'طريق سريع',
  }),
  make({
    id: 'a-crime-2', categoryId: 'crime', slug: 'online-fraud-warning', publishAt: '2026-10-21T13:15:00Z',
    translationKey: 'fraud-warning',
    title: 'تحذيرات من رسائل احتيال إلكتروني تنتحل صفة جهات خدمية',
    summary: 'الرسائل تطلب بيانات بطاقات الدفع، والجهات الرسمية تؤكد أنها لا تطلب هذه البيانات.',
    body: paragraphs(
      'حذرت جهات مختصة من رسائل احتيال إلكتروني تنتحل صفة جهات خدمية وتطلب بيانات بطاقات الدفع.',
      'وأكدت أن الجهات الرسمية لا تطلب كلمات المرور أو أرقام التحقق عبر الرسائل أو المكالمات.',
      'ونصحت بعدم الضغط على الروابط المجهولة، والإبلاغ عن أي رسائل مشبوهة.',
    ),
    tags: ['احتيال', 'أمن رقمي'], imageAlt: 'هاتف محمول عليه رسالة',
  }),
  // تكنولوجيا
  make({
    id: 'a-tech-1', categoryId: 'technology', slug: 'digital-skills-training', publishAt: '2026-10-22T08:00:00Z',
    title: 'مبادرة لتدريب الشباب على المهارات الرقمية مجانًا',
    summary: 'التدريب يشمل البرمجة وتحليل البيانات والتسويق الرقمي.',
    body: paragraphs(
      'أطلقت مبادرة جديدة برنامجًا مجانيًا لتدريب الشباب على المهارات الرقمية المطلوبة في سوق العمل.',
      'ويشمل البرنامج مسارات في البرمجة وتحليل البيانات والتسويق الرقمي، مع مشروعات تطبيقية.',
      'ويحصل المتدربون في نهاية البرنامج على شهادات إتمام بعد اجتياز التقييم.',
    ),
    tags: ['تدريب', 'مهارات رقمية'], imageAlt: 'قاعة تدريب حاسبات',
  }),
  make({
    id: 'a-tech-2', categoryId: 'technology', slug: 'protect-your-accounts', publishAt: '2026-10-20T16:00:00Z',
    title: 'خطوات بسيطة لحماية حساباتك على الإنترنت',
    summary: 'كلمات مرور قوية والتحقق بخطوتين من أهم وسائل الحماية.',
    body: [
      { type: 'paragraph', text: 'تزداد أهمية حماية الحسابات الإلكترونية مع انتشار محاولات الاحتيال.' },
      { type: 'heading', text: 'استخدم كلمات مرور مختلفة' },
      { type: 'paragraph', text: 'ينصح الخبراء باستخدام كلمة مرور مختلفة لكل حساب، والاستعانة ببرنامج لإدارة كلمات المرور.' },
      { type: 'heading', text: 'فعّل التحقق بخطوتين' },
      { type: 'paragraph', text: 'يضيف التحقق بخطوتين طبقة حماية إضافية حتى لو تسربت كلمة المرور.' },
    ],
    tags: ['أمن رقمي', 'نصائح'], imageAlt: 'قفل رقمي على شاشة',
  }),
  // لايف ستايل
  make({
    id: 'a-life-1', categoryId: 'lifestyle', slug: 'healthy-breakfast-ideas', publishAt: '2026-10-22T06:30:00Z',
    title: 'أفكار لإفطار صحي وسريع قبل العمل أو الدراسة',
    summary: 'وجبات بسيطة تعتمد على مكونات متوفرة وتمنحك طاقة لبداية اليوم.',
    body: paragraphs(
      'يعد الإفطار من أهم الوجبات اليومية، ويمكن إعداده بسرعة باستخدام مكونات بسيطة.',
      'ومن الأفكار المقترحة: الفول مع الخضروات، والزبادي مع الفاكهة، والشوفان بالحليب.',
      'وينصح خبراء التغذية بتنويع الوجبات وشرب كمية كافية من الماء.',
    ),
    tags: ['تغذية', 'صحة'], imageAlt: 'طبق إفطار صحي',
  }),
  make({
    id: 'a-life-2', categoryId: 'lifestyle', slug: 'weekend-trips-near-cairo', publishAt: '2026-10-21T07:30:00Z',
    title: 'رحلات قصيرة لعطلة نهاية الأسبوع بالقرب من القاهرة',
    summary: 'أماكن طبيعية وتاريخية يمكن زيارتها في يوم واحد.',
    body: paragraphs(
      'إذا كنت تبحث عن رحلة قصيرة في عطلة نهاية الأسبوع، فهناك أماكن عديدة يمكن زيارتها في يوم واحد.',
      'وتشمل الخيارات المحميات الطبيعية والمواقع الأثرية والحدائق العامة.',
      'وينصح بالتخطيط المسبق ومعرفة مواعيد الزيارة قبل التوجه إلى أي مكان.',
    ),
    tags: ['سفر', 'رحلات'], imageAlt: 'طريق صحراوي عند الغروب',
  }),

  // English versions (linked through translationKey)
  make({
    id: 'e-egypt-1', lang: 'en', categoryId: 'egypt', slug: 'new-public-library-opens', publishAt: '2026-10-23T09:00:00Z',
    translationKey: 'library',
    title: 'New public library opens with reading halls for children and researchers',
    summary: 'The library opens daily from 9 a.m. and offers a computer room and weekly reading programmes.',
    body: paragraphs(
      'A new public library has opened with three reading halls, a children’s room and a computer corner for students and researchers.',
      'A library official said it is open from 9 a.m. to 7 p.m. every day except Friday, with an annual membership available for a nominal fee.',
      'The library plans weekly reading sessions for children and writing and photography workshops in the coming months.',
    ),
    tags: ['libraries', 'culture'], imageAlt: 'Entrance to a modern public library',
  }),
  make({
    id: 'e-world-1', lang: 'en', categoryId: 'arab-world', slug: 'regional-water-conference', publishAt: '2026-10-22T10:30:00Z',
    translationKey: 'water',
    title: 'Regional conference examines solutions to water scarcity in the Arab region',
    summary: 'Experts from several countries discuss desalination and reusing treated water in agriculture.',
    body: paragraphs(
      'A regional conference on water scarcity in the Arab region has opened with experts and researchers from several countries.',
      'Sessions focus on desalination, reusing treated water in agriculture and reducing consumption.',
      'The conference is expected to close with recommendations on regional cooperation in water management.',
    ),
    tags: ['water', 'conferences'], imageAlt: 'Stage at an international conference',
  }),
  make({
    id: 'e-economy-1', lang: 'en', categoryId: 'economy', slug: 'small-business-financing-program', publishAt: '2026-10-23T07:00:00Z',
    translationKey: 'smb-financing',
    title: 'New financing programme for small businesses offers flexible terms',
    summary: 'The programme targets craftspeople and start-ups, with a grace period before repayments begin.',
    body: paragraphs(
      'A lender has announced a new programme to support small businesses, aimed at craftspeople and start-ups.',
      'It includes a grace period before repayments begin, as well as training in business management and marketing.',
      'Applications can be made at approved branches or through the lender’s website.',
    ),
    tags: ['financing', 'small business'], imageAlt: 'A small craft workshop',
  }),
  make({
    id: 'e-crime-2', lang: 'en', categoryId: 'crime', slug: 'online-fraud-warning', publishAt: '2026-10-21T14:00:00Z',
    translationKey: 'fraud-warning',
    title: 'Warning issued over fraudulent messages impersonating service providers',
    summary: 'The messages ask for payment card details; official bodies say they never request this information.',
    body: paragraphs(
      'Authorities have warned of fraudulent messages that impersonate service providers and ask for payment card details.',
      'Official bodies do not request passwords or verification codes by message or phone call, they said.',
      'People are advised not to open unknown links and to report suspicious messages.',
    ),
    tags: ['fraud', 'digital security'], imageAlt: 'A mobile phone showing a text message',
  }),

  // Non-public fixtures: they must never appear on the site, in search or in the sitemap.
  make({
    id: 'a-draft-1', categoryId: 'politics', slug: 'unpublished-draft-story', publishAt: '2026-10-22T10:00:00Z',
    status: 'draft',
    title: 'مسودة غير منشورة لاختبار الحماية',
    summary: 'هذه المسودة يجب ألا تظهر للزوار.',
    body: paragraphs('نص مسودة داخلية.'),
    tags: [], imageAlt: 'مسودة',
  }),
  make({
    id: 'a-review-1', categoryId: 'economy', slug: 'story-in-review', publishAt: '2026-10-22T10:00:00Z',
    status: 'in_review',
    title: 'خبر قيد المراجعة لاختبار الحماية',
    summary: 'هذا الخبر قيد المراجعة ويجب ألا يظهر للزوار.',
    body: paragraphs('نص قيد المراجعة.'),
    tags: [], imageAlt: 'قيد المراجعة',
  }),
  make({
    id: 'a-scheduled-1', categoryId: 'sports', slug: 'scheduled-future-story', publishAt: '2099-01-01T00:00:00Z',
    title: 'خبر مجدول للمستقبل لاختبار الجدولة',
    summary: 'هذا الخبر مجدول ويجب ألا يظهر قبل موعده.',
    body: paragraphs('نص خبر مجدول.'),
    tags: [], imageAlt: 'مجدول',
  }),
];

/** Editor-chosen homepage order; the first slot is the lead story. */
export const demoHomepageSlots: HomepageSlot[] = [
  { articleId: 'a-egypt-1', position: 1 },
  { articleId: 'a-economy-1', position: 2 },
  { articleId: 'a-sports-1', position: 3 },
  { articleId: 'a-world-1', position: 4 },
  { articleId: 'a-crime-2', position: 5 },
  { articleId: 'a-draft-1', position: 6 },
  { articleId: 'e-egypt-1', position: 1 },
  { articleId: 'e-economy-1', position: 2 },
  { articleId: 'e-world-1', position: 3 },
];

export const demoTicker: TickerItem[] = [
  { id: 't1', lang: 'ar', text: 'معاينة: شريط الأخبار العاجلة يُدار من لوحة التحكم', articleId: undefined },
  { id: 't2', lang: 'ar', text: 'افتتاح مكتبة عامة جديدة تضم قاعات للأطفال والباحثين', articleId: 'a-egypt-1' },
  { id: 't3', lang: 'ar', text: 'برنامج تمويل جديد للمشروعات الصغيرة بشروط ميسرة', articleId: 'a-economy-1' },
  { id: 't4', lang: 'en', text: 'Preview: the breaking-news ticker is managed from the dashboard' },
  { id: 't5', lang: 'en', text: 'New public library opens with reading halls', articleId: 'e-egypt-1' },
];
