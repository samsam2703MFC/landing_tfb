/**
 * Seed copy for The Franchise Buddy landing, ported verbatim from the design
 * handoff (ui_kits/landing/landing-data.v2.js).
 *
 * FR is authored and is the fallback. EN and AR are authored. NL / DE / PL / UK / RU
 * are deliberately absent so they exercise the real fallback path — add rows through
 * the back office's translation editor as translators deliver.
 *
 * AR is translator-review quality, not final. See README.
 */

export const AUTHORED_LOCALES = ['fr', 'en', 'ar'] as const;
export type AuthoredLocale = (typeof AUTHORED_LOCALES)[number];

/** tfb_languages rows. */
export const LANGUAGES = [
  { code: 'fr', name: 'Français', isRtl: false, isDefault: true, sortOrder: 1 },
  { code: 'en', name: 'English', isRtl: false, isDefault: false, sortOrder: 2 },
  { code: 'nl', name: 'Nederlands', isRtl: false, isDefault: false, sortOrder: 3 },
  { code: 'de', name: 'Deutsch', isRtl: false, isDefault: false, sortOrder: 4 },
  { code: 'pl', name: 'Polski', isRtl: false, isDefault: false, sortOrder: 5 },
  { code: 'uk', name: 'Українська', isRtl: false, isDefault: false, sortOrder: 6 },
  { code: 'ru', name: 'Русский', isRtl: false, isDefault: false, sortOrder: 7 },
  { code: 'ar', name: 'العربية', isRtl: true, isDefault: false, sortOrder: 8 },
];

/** tfb_sections — the order the landing renders in. */
export const SECTIONS = [
  { key: 'hero', type: 'hero', sortOrder: 1, isActive: true },
  { key: 'brands', type: 'logo-strip', sortOrder: 2, isActive: true },
  { key: 'modules', type: 'module-grid', sortOrder: 3, isActive: true },
  { key: 'steps', type: 'steps', sortOrder: 4, isActive: true },
  { key: 'diff', type: 'feature-grid', sortOrder: 5, isActive: true },
  { key: 'pricing', type: 'pricing', sortOrder: 6, isActive: true },
  { key: 'testimonials', type: 'quotes', sortOrder: 7, isActive: false },
  { key: 'contact', type: 'form', sortOrder: 8, isActive: true },
];

/** tfb_brands — no logo_path files were supplied; the strip renders name chips. */
export const BRANDS = [
  { slug: 'belleville', name: 'Belleville Bistro', sortOrder: 1 },
  { slug: 'kebab-house', name: 'Kebab House', sortOrder: 2 },
  { slug: 'sushi-loop', name: 'Sushi Loop', sortOrder: 3 },
  { slug: 'cafe-nord', name: 'Café Nord', sortOrder: 4 },
  { slug: 'pasta-bar', name: 'Pasta Bar', sortOrder: 5 },
  { slug: 'green-bowl', name: 'Green Bowl', sortOrder: 6 },
];

/**
 * tfb_modules. One icon per module (readme ICONOGRAPHY):
 * shop → shopping-cart, invoicing → receipt, offers → percent, scan → qr-code,
 * marketing → megaphone, ceobot → bot, pwa → smartphone, consultant → clipboard-check.
 * `shots` is how many placeholder screenshot rows to create.
 */
export const MODULES = [
  { key: 'shop', slug: 'shop', icon: 'shopping-cart', moduleGroup: 'Ventes', repo: 'tfb/shop', isNew: false, sortOrder: 1, shots: 3 },
  { key: 'invoicing', slug: 'invoicing', icon: 'receipt', moduleGroup: 'Finance', repo: 'tfb/invoicing', isNew: false, sortOrder: 2, shots: 2 },
  { key: 'offers', slug: 'offers', icon: 'percent', moduleGroup: 'Marketing', repo: 'tfb/offers', isNew: false, sortOrder: 3, shots: 2 },
  { key: 'scan', slug: 'scan', icon: 'qr-code', moduleGroup: 'Logistique', repo: 'tfb/scan', isNew: true, sortOrder: 4, shots: 3 },
  { key: 'marketing', slug: 'marketing', icon: 'megaphone', moduleGroup: 'Marketing', repo: 'tfb/marketing', isNew: false, sortOrder: 5, shots: 2 },
  { key: 'ceobot', slug: 'ceobot', icon: 'bot', moduleGroup: 'Assistance', repo: 'tfb/ceobot', isNew: true, sortOrder: 6, shots: 2 },
  { key: 'pwa', slug: 'pwa', icon: 'smartphone', moduleGroup: 'Terrain', repo: 'tfb/pwa-shell', isNew: true, sortOrder: 7, shots: 2 },
  { key: 'consultant', slug: 'consultant', icon: 'clipboard-check', moduleGroup: 'Terrain', repo: 'samsam2703MFC/pwa_consultant', isNew: true, sortOrder: 8, shots: 3 },
];

/** tfb_plans. `amount` in cents; NULL = sur devis. */
export const PLANS = [
  { key: 'starter', amount: 8900, currency: 'EUR', interval: 'month', isFeatured: false, stripePriceId: null, sortOrder: 1 },
  { key: 'pro', amount: 14900, currency: 'EUR', interval: 'month', isFeatured: true, stripePriceId: null, sortOrder: 2 },
  { key: 'enterprise', amount: null, currency: 'EUR', interval: 'year', isFeatured: false, stripePriceId: null, sortOrder: 3 },
];

/**
 * tfb_translations, entity_type='ui', entity_id=0. The `field` is the dotted key the
 * landing asks for. Multi-value fields are pipe-joined.
 */
export const UI_STRINGS: Record<AuthoredLocale, Record<string, string>> = {
  fr: {
    'nav.modules': 'Modules', 'nav.pricing': 'Tarifs', 'nav.contact': 'Contact', 'nav.signin': 'Connexion',
    'cta.demo': 'Demander une démo', 'cta.start': 'Commencer',
    'hero.eyebrow': 'ERP tout-en-un · Restauration & retail',
    'hero.title': 'Pilotez tout votre réseau depuis un seul écran.',
    'hero.subtitle': 'Shop, facturation, offres, scan, marketing, chatbot et PWA : des modules connectés, une seule base de données, aucun problème de gestion de cash.',
    'hero.proof1': 'Mise en route en 3 semaines', 'hero.proof2': '8 langues, arabe inclus',
    'brands.title': 'Des réseaux qui gèrent leurs points de vente avec TFB',
    'modules.eyebrow': 'Modules', 'modules.title': 'Un module par métier, connectés entre eux',
    'modules.lead': 'Chaque module est publié automatiquement dès qu’il sort des dépôts. Vous voyez les écrans réels, pas des promesses.',
    'modules.link': 'Découvrir le module', 'modules.new': 'Nouveau',
    'modules.all': 'Tous les modules', 'modules.count': 'modules', 'modules.newcount': 'nouveaux',
    'detail.back': 'Tous les modules', 'detail.connected': 'Modules connectés', 'detail.gain': 'Gain constaté',
    'detail.setup': 'Mise en route', 'detail.week': 'semaine', 'detail.sheet': 'Recevoir la fiche', 'detail.included': 'Ce que fait le module',
    'group.ventes': 'Ventes', 'group.finance': 'Finance', 'group.marketing': 'Marketing',
    'group.logistique': 'Logistique', 'group.assistance': 'Assistance', 'group.terrain': 'Terrain',
    'shot.alt': 'Capture du module',
    'mock.brand': 'TFB Admin · Belleville Bistro', 'mock.stores': '64 PDV',
    'mock.collected': 'Encaissé (juil.)', 'mock.licenses': 'Abonnements', 'mock.vsjune': 'vs. juin',
    'mock.thismonth': 'ce mois', 'mock.active': 'Actif',
    'mock.collected.value': '418 k€', 'mock.collected.delta': '+6,4%',
    'mock.licenses.value': '128', 'mock.licenses.delta': '+6',
    'steps.eyebrow': 'Comment ça marche', 'steps.title': 'Quatre étapes, pas quatre trimestres',
    'steps.1t': 'Connectez vos points de vente', 'steps.1d': 'Import des enseignes, des magasins et des utilisateurs. Une seule source de vérité.',
    'steps.2t': 'Activez les modules utiles', 'steps.2d': 'Shop, facturation, scan, marketing : vous activez ce que vous utilisez, rien de plus.',
    'steps.3t': 'Pilotez depuis le tableau de bord', 'steps.3d': 'Chiffre d’affaires, encaissements, stocks et alertes, consolidés par enseigne.',
    'steps.4t': 'Encaissez sans souci de cash', 'steps.4d': 'Paiements et abonnements suivis automatiquement. Plus de rapprochement manuel.',
    'diff.eyebrow': 'Points différenciants', 'diff.title': 'Ce que les tableurs ne feront jamais',
    'diff.1t': 'Zéro problème de gestion de cash', 'diff.1d': 'Encaissements, factures et abonnements réconciliés en continu.',
    'diff.2t': 'Multi-enseignes natif', 'diff.2d': 'Une enseigne, dix enseignes, un master-franchisé : même base, mêmes droits.',
    'diff.3t': '8 langues, arabe en RTL', 'diff.3d': 'Toutes les chaînes viennent de la base, jamais du code. Mise en page miroir en arabe.',
    'diff.4t': 'Modules connectés', 'diff.4d': 'Le scan alimente le stock, le stock alimente le shop, le shop alimente la facturation.',
    'pricing.eyebrow': 'Tarifs', 'pricing.title': 'Par point de vente, pas par utilisateur',
    'pricing.lead': 'Invitez toute l’équipe : franchisés, managers, responsables réseau. Vous payez les magasins, la seule ligne que vous budgétez déjà.',
    'pricing.recommended': 'Recommandé', 'pricing.month': '/ mois par point de vente', 'pricing.custom': 'Sur devis',
    'plan.cta': 'Choisir ce plan', 'plan.cta.custom': 'Parler à un expert',
    'quote.text': '« Six enseignes, quatre pays, une seule base. On a arrêté de se demander où étaient les chiffres. »',
    'quote.author': 'Naïma Bouchard', 'quote.initials': 'NB',
    'quote.role': 'Directrice réseau, Belleville Bistro — 64 points de vente',
    'contact.eyebrow': 'Contact', 'contact.title': 'Parlons de votre réseau',
    'contact.lead': 'Décrivez votre organisation actuelle. Nous revenons vers vous sous un jour ouvré, avec une démo adaptée à vos enseignes.',
    'contact.name': 'Nom', 'contact.email': 'E-mail professionnel', 'contact.company': 'Société', 'contact.message': 'Message',
    'contact.send': 'Envoyer', 'contact.sent': 'Message reçu', 'contact.sentmsg': 'Nous répondons sous un jour ouvré.',
    'contact.error': 'Envoi impossible', 'contact.errormsg': 'Vérifiez votre e-mail et réessayez.',
    'contact.mail': 'contact@franchisebuddy.eu', 'contact.hours': 'Lun — ven, 9h — 18h CET',
    'footer.product': 'Produit', 'footer.company': 'Société', 'footer.legal': 'Mentions légales', 'footer.langs': 'Langues',
    'footer.tagline': 'ERP SaaS pour les franchises et chaînes de magasins en restauration et retail.',
    'footer.company.items': 'À propos|Sécurité|Contact',
    'footer.legal.items': 'Mentions légales|CGU|Sous-traitants',
    'footer.rights': '© 2026 The Franchise Buddy — ERP SaaS',
    'demo.title': 'Demander une démo', 'demo.desc': 'Trente minutes, vos données, aucune diapositive.',
    'demo.locations': 'Points de vente', 'demo.cancel': 'Annuler', 'demo.confirm': 'Demander un créneau',
    'checkout.title': 'Redirection vers Stripe', 'checkout.stub': 'Stripe n’est pas encore configuré — aucune session créée.',
    'brand.name': 'The Franchise Buddy',
  },
  en: {
    'nav.modules': 'Modules', 'nav.pricing': 'Pricing', 'nav.contact': 'Contact', 'nav.signin': 'Sign in',
    'cta.demo': 'Book a demo', 'cta.start': 'Get started',
    'hero.eyebrow': 'All-in-one ERP · Food & retail',
    'hero.title': 'Run your whole network from one screen.',
    'hero.subtitle': 'Shop, invoicing, offers, scan, marketing, chatbot and PWA: connected modules, one database, no cash management problem.',
    'hero.proof1': 'Live in 3 weeks', 'hero.proof2': '8 languages, Arabic included',
    'brands.title': 'Networks running their stores on TFB',
    'modules.eyebrow': 'Modules', 'modules.title': 'One module per job, wired together',
    'modules.lead': 'Every module is published the moment it ships from the repos. You see the real screens, not promises.',
    'modules.link': 'Explore the module', 'modules.new': 'New',
    'modules.all': 'All modules', 'modules.count': 'modules', 'modules.newcount': 'new',
    'detail.back': 'All modules', 'detail.connected': 'Connected modules', 'detail.gain': 'Measured gain',
    'detail.setup': 'Setup', 'detail.week': 'week', 'detail.sheet': 'Get the datasheet', 'detail.included': 'What the module does',
    'group.ventes': 'Sales', 'group.finance': 'Finance', 'group.marketing': 'Marketing',
    'group.logistique': 'Logistics', 'group.assistance': 'Support', 'group.terrain': 'Field',
    'shot.alt': 'Module screenshot',
    'mock.brand': 'TFB Admin · Belleville Bistro', 'mock.stores': '64 stores',
    'mock.collected': 'Collected (Jul)', 'mock.licenses': 'Subscriptions', 'mock.vsjune': 'vs. June',
    'mock.thismonth': 'this month', 'mock.active': 'Active',
    'steps.eyebrow': 'How it works', 'steps.title': 'Four steps, not four quarters',
    'steps.1t': 'Connect your stores', 'steps.1d': 'Import brands, stores and users. One source of truth.',
    'steps.2t': 'Switch on the modules you need', 'steps.2d': 'Shop, invoicing, scan, marketing — enable what you use, nothing else.',
    'steps.3t': 'Run it from the dashboard', 'steps.3d': 'Revenue, collections, stock and alerts, consolidated per brand.',
    'steps.4t': 'Get paid without the cash chase', 'steps.4d': 'Payments and subscriptions tracked automatically. No manual reconciliation.',
    'diff.eyebrow': 'Why TFB', 'diff.title': 'What spreadsheets will never do',
    'diff.1t': 'No cash management problem', 'diff.1d': 'Collections, invoices and subscriptions reconciled continuously.',
    'diff.2t': 'Multi-brand by default', 'diff.2d': 'One brand, ten brands, a master franchisee — same database, same permissions.',
    'diff.3t': '8 languages, Arabic in RTL', 'diff.3d': 'Every string comes from the database, never the code. Fully mirrored layout in Arabic.',
    'diff.4t': 'Connected modules', 'diff.4d': 'Scan feeds stock, stock feeds the shop, the shop feeds invoicing.',
    'pricing.eyebrow': 'Pricing', 'pricing.title': 'Per store, not per seat',
    'pricing.lead': 'Invite the whole team: franchisees, managers, network leads. You pay for stores — the number you already budget by.',
    'pricing.recommended': 'Recommended', 'pricing.month': '/ month per store', 'pricing.custom': 'Custom',
    'plan.cta': 'Choose this plan', 'plan.cta.custom': 'Talk to an expert',
    'quote.text': '"Six brands, four countries, one database. We stopped wondering where the numbers were."',
    'quote.author': 'Naïma Bouchard', 'quote.initials': 'NB',
    'quote.role': 'Network Director, Belleville Bistro — 64 stores',
    'contact.eyebrow': 'Contact', 'contact.title': "Let's talk about your network",
    'contact.lead': 'Tell us how you operate today. We reply within one business day with a demo built around your brands.',
    'contact.name': 'Name', 'contact.email': 'Work email', 'contact.company': 'Company', 'contact.message': 'Message',
    'contact.send': 'Send', 'contact.sent': 'Message received', 'contact.sentmsg': 'We reply within one business day.',
    'contact.error': 'Could not send', 'contact.errormsg': 'Check your email address and try again.',
    'contact.mail': 'contact@franchisebuddy.eu', 'contact.hours': 'Mon — Fri, 9am — 6pm CET',
    'footer.product': 'Product', 'footer.company': 'Company', 'footer.legal': 'Legal', 'footer.langs': 'Languages',
    'footer.tagline': 'ERP SaaS for franchises and store chains in food and retail.',
    'footer.company.items': 'About|Security|Contact',
    'footer.legal.items': 'Legal notice|Terms|Sub-processors',
    'footer.rights': '© 2026 The Franchise Buddy — ERP SaaS',
    'demo.title': 'Book a demo', 'demo.desc': 'Thirty minutes, your data, no slides.',
    'demo.locations': 'Stores', 'demo.cancel': 'Cancel', 'demo.confirm': 'Request a slot',
    'checkout.title': 'Redirecting to Stripe', 'checkout.stub': 'Stripe is not configured yet — no session was created.',
    'brand.name': 'The Franchise Buddy',
  },
  ar: {
    'nav.modules': 'الوحدات', 'nav.pricing': 'الأسعار', 'nav.contact': 'اتصل بنا', 'nav.signin': 'تسجيل الدخول',
    'cta.demo': 'اطلب عرضًا توضيحيًا', 'cta.start': 'ابدأ الآن',
    'hero.eyebrow': 'نظام ERP متكامل · المطاعم والتجزئة',
    'hero.title': 'أدر شبكتك بالكامل من شاشة واحدة.',
    'hero.subtitle': 'المتجر، الفواتير، العروض، المسح، التسويق، المساعد الذكي وتطبيق PWA: وحدات مترابطة، قاعدة بيانات واحدة، ولا مشكلة في إدارة النقد.',
    'hero.proof1': 'التشغيل في ثلاثة أسابيع', 'hero.proof2': 'ثماني لغات، بينها العربية',
    'brands.title': 'شبكات تدير فروعها عبر TFB',
    'modules.eyebrow': 'الوحدات', 'modules.title': 'وحدة لكل مهمة، مترابطة بالكامل',
    'modules.lead': 'تُنشر كل وحدة تلقائيًا بمجرد صدورها. ترى الشاشات الحقيقية، لا الوعود.',
    'modules.link': 'استكشف الوحدة', 'modules.new': 'جديد',
    'modules.all': 'كل الوحدات', 'modules.count': 'وحدات', 'modules.newcount': 'جديدة',
    'detail.back': 'كل الوحدات', 'detail.connected': 'وحدات مترابطة', 'detail.gain': 'النتيجة المقاسة',
    'detail.setup': 'التشغيل', 'detail.week': 'أسبوع', 'detail.sheet': 'احصل على الملف', 'detail.included': 'ما تفعله الوحدة',
    'group.ventes': 'المبيعات', 'group.finance': 'المالية', 'group.marketing': 'التسويق',
    'group.logistique': 'اللوجستيات', 'group.assistance': 'الدعم', 'group.terrain': 'الميدان',
    'shot.alt': 'لقطة شاشة للوحدة',
    'mock.brand': 'TFB Admin · Belleville Bistro', 'mock.stores': '64 نقطة بيع',
    'mock.collected': 'المحصّل (يوليو)', 'mock.licenses': 'الاشتراكات', 'mock.vsjune': 'مقارنة بيونيو',
    'mock.thismonth': 'هذا الشهر', 'mock.active': 'نشط',
    'steps.eyebrow': 'كيف يعمل', 'steps.title': 'أربع خطوات، لا أربعة أرباع سنة',
    'steps.1t': 'اربط نقاط البيع', 'steps.1d': 'استيراد العلامات والفروع والمستخدمين. مصدر واحد للحقيقة.',
    'steps.2t': 'فعّل الوحدات التي تحتاجها', 'steps.2d': 'المتجر، الفواتير، المسح، التسويق: تفعّل ما تستخدمه فقط.',
    'steps.3t': 'أدر كل شيء من لوحة التحكم', 'steps.3d': 'الإيرادات والتحصيل والمخزون والتنبيهات، مجمّعة لكل علامة.',
    'steps.4t': 'حصّل أموالك دون متابعة يدوية', 'steps.4d': 'المدفوعات والاشتراكات تُتابع تلقائيًا. لا تسوية يدوية.',
    'diff.eyebrow': 'لماذا TFB', 'diff.title': 'ما لا تفعله جداول البيانات',
    'diff.1t': 'لا مشكلة في إدارة النقد', 'diff.1d': 'التحصيل والفواتير والاشتراكات تُسوّى باستمرار.',
    'diff.2t': 'تعدد العلامات أصلًا', 'diff.2d': 'علامة واحدة أو عشر علامات أو امتياز رئيسي: نفس القاعدة ونفس الصلاحيات.',
    'diff.3t': 'ثماني لغات، والعربية من اليمين إلى اليسار', 'diff.3d': 'كل النصوص من قاعدة البيانات، لا من الكود. تصميم معكوس بالكامل بالعربية.',
    'diff.4t': 'وحدات مترابطة', 'diff.4d': 'المسح يغذّي المخزون، والمخزون يغذّي المتجر، والمتجر يغذّي الفواتير.',
    'pricing.eyebrow': 'الأسعار', 'pricing.title': 'لكل نقطة بيع، لا لكل مستخدم',
    'pricing.lead': 'ادعُ الفريق بالكامل: أصحاب الامتياز والمديرين ومسؤولي الشبكة. تدفع مقابل الفروع فقط.',
    'pricing.recommended': 'موصى به', 'pricing.month': '/ شهريًا لكل نقطة بيع', 'pricing.custom': 'حسب الطلب',
    'plan.cta': 'اختر هذه الخطة', 'plan.cta.custom': 'تحدث إلى خبير',
    'quote.text': '«ست علامات، أربع دول، قاعدة واحدة. توقفنا عن البحث عن الأرقام.»',
    'quote.author': 'نعيمة بوشارد', 'quote.initials': 'NB',
    'quote.role': 'مديرة الشبكة، Belleville Bistro — 64 نقطة بيع',
    'contact.eyebrow': 'اتصل بنا', 'contact.title': 'لنتحدث عن شبكتك',
    'contact.lead': 'اشرح لنا طريقة عملك الحالية. نرد خلال يوم عمل واحد بعرض مخصص لعلاماتك.',
    'contact.name': 'الاسم', 'contact.email': 'البريد المهني', 'contact.company': 'الشركة', 'contact.message': 'الرسالة',
    'contact.send': 'إرسال', 'contact.sent': 'تم استلام الرسالة', 'contact.sentmsg': 'نرد خلال يوم عمل واحد.',
    'contact.error': 'تعذّر الإرسال', 'contact.errormsg': 'تحقّق من بريدك وأعد المحاولة.',
    'contact.mail': 'contact@franchisebuddy.eu', 'contact.hours': 'الاثنين — الجمعة، 9 — 18 بتوقيت وسط أوروبا',
    'footer.product': 'المنتج', 'footer.company': 'الشركة', 'footer.legal': 'إشعارات قانونية', 'footer.langs': 'اللغات',
    'footer.tagline': 'نظام ERP سحابي لشبكات الامتياز وسلاسل المتاجر في المطاعم والتجزئة.',
    'footer.company.items': 'من نحن|الأمان|اتصل بنا',
    'footer.legal.items': 'إشعارات قانونية|الشروط|المعالجون الفرعيون',
    'footer.rights': '© 2026 The Franchise Buddy — ERP SaaS',
    'demo.title': 'اطلب عرضًا توضيحيًا', 'demo.desc': 'ثلاثون دقيقة، بياناتك، بلا عروض تقديمية.',
    'demo.locations': 'نقاط البيع', 'demo.cancel': 'إلغاء', 'demo.confirm': 'اطلب موعدًا',
    'checkout.title': 'إعادة التوجيه إلى Stripe', 'checkout.stub': 'لم يُضبط Stripe بعد — لم تُنشأ أي جلسة.',
    'brand.name': 'The Franchise Buddy',
  },
};

/**
 * tfb_translations, entity_type='module'. Fields: name, description, bullets
 * (pipe-joined), metric_value, metric_label.
 */
type ModuleCopy = { name: string; description: string; bullets?: string[]; metric?: [string, string] };

export const MODULE_STRINGS: Record<AuthoredLocale, Record<string, ModuleCopy>> = {
  fr: {
    shop: {
      name: 'Shop', description: 'Boutique en ligne connectée au stock de chaque point de vente.',
      bullets: ['Catalogue commun, prix par enseigne', 'Stock temps réel par point de vente', 'Click & collect et livraison', 'Paiement Stripe intégré'],
      metric: ['+18%', 'de panier moyen'],
    },
    invoicing: {
      name: 'Facturation', description: 'Factures, avoirs et relances générés depuis les ventes réelles.',
      bullets: ['Facturation depuis les ventes réelles', 'Avoirs et relances automatiques', 'TVA multi-pays (FR, BE, NL, PL)', 'Export comptable mensuel'],
      metric: ['3,4 j', 'de délai de paiement'],
    },
    offers: {
      name: 'Offres & promos', description: 'Campagnes de remises par enseigne, par magasin ou par produit.',
      bullets: ['Remises par enseigne, magasin ou produit', 'Planification par créneau horaire', 'Coupons à usage unique', 'Suivi de marge en direct'],
      metric: ['-2,1 pt', 'de perte sur promo'],
    },
    scan: {
      name: 'Scan', description: 'Réceptions et inventaires au QR code, depuis un téléphone.',
      bullets: ['Réception fournisseur au QR code', 'Inventaire tournant depuis un téléphone', 'Écarts remontés au responsable réseau', 'Fonctionne hors ligne'],
      metric: ['12 min', 'par inventaire'],
    },
    marketing: {
      name: 'Marketing', description: 'E-mails, SMS et cartes de fidélité pilotés depuis la base clients.',
      bullets: ['E-mails et SMS segmentés', 'Cartes de fidélité dématérialisées', 'Campagnes par zone de chalandise', 'Attribution au point de vente'],
      metric: ['24%', "d'ouverture moyenne"],
    },
    ceobot: {
      name: 'CEObot', description: 'Assistant conversationnel qui répond sur vos chiffres, pas sur le web.',
      bullets: ['Répond sur vos chiffres, pas sur le web', 'Requêtes en langage naturel', 'Alertes proactives sur les écarts', 'Historique consultable et exportable'],
      metric: ['8 s', 'pour un rapport'],
    },
    pwa: {
      name: 'App PWA', description: 'Application installable pour les équipes en magasin, hors ligne comprise.',
      bullets: ['Installable sur les téléphones des équipes', 'Mode hors ligne avec synchronisation', 'Notifications de service', 'Aucune boutique d’applications'],
      metric: ['0', 'installation IT'],
    },
    consultant: {
      name: 'Panel consultant', description: 'L’application terrain des animateurs réseau : visites, checklists et comptes rendus.',
      bullets: ['Agenda des visites par point de vente', 'Checklists de visite notées et commentées', 'Objectifs, tendances et leviers par magasin', 'Réclamations et rapports remontés depuis le terrain'],
      metric: ['0', 'ressaisie après la visite'],
    },
  },
  en: {
    shop: { name: 'Shop', description: 'Online store wired to each location’s live stock.' },
    invoicing: { name: 'Invoicing', description: 'Invoices, credit notes and dunning generated from real sales.' },
    offers: { name: 'Offers & promos', description: 'Discount campaigns per brand, per store or per product.' },
    scan: { name: 'Scan', description: 'QR-code deliveries and stock counts from a phone.' },
    marketing: { name: 'Marketing', description: 'Email, SMS and loyalty cards driven by the customer database.' },
    ceobot: { name: 'CEObot', description: 'Conversational assistant that answers on your numbers, not the web.' },
    pwa: { name: 'PWA app', description: 'Installable app for store teams, offline included.' },
    consultant: { name: 'Consultant panel', description: 'Field app for network consultants: visits, checklists and reports.' },
  },
  ar: {
    shop: { name: 'المتجر', description: 'متجر إلكتروني مرتبط بمخزون كل نقطة بيع.' },
    invoicing: { name: 'الفواتير', description: 'فواتير وإشعارات دائنة ومطالبات تُنشأ من المبيعات الفعلية.' },
    offers: { name: 'العروض والتخفيضات', description: 'حملات خصم لكل علامة أو فرع أو منتج.' },
    scan: { name: 'المسح', description: 'استلام البضائع وجرد المخزون عبر رمز QR من الهاتف.' },
    marketing: { name: 'التسويق', description: 'بريد ورسائل نصية وبطاقات ولاء من قاعدة العملاء.' },
    ceobot: { name: 'CEObot', description: 'مساعد محادثة يجيب من أرقامك، لا من الإنترنت.' },
    pwa: { name: 'تطبيق PWA', description: 'تطبيق قابل للتثبيت لفرق الفروع، يعمل دون اتصال.' },
    consultant: { name: 'لوحة المستشارين', description: 'تطبيق ميداني لمستشاري الشبكة: الزيارات وقوائم المهام والتقارير.' },
  },
};

/** tfb_translations, entity_type='plan'. Fields: name, description, features. */
type PlanCopy = { name: string; description: string; features: string[] };

export const PLAN_STRINGS: Record<AuthoredLocale, Record<string, PlanCopy>> = {
  fr: {
    starter: { name: 'Starter', description: 'Pour un réseau de moins de 10 points de vente.', features: ['Shop et facturation', 'Tableau de bord consolidé', '2 langues', 'Support e-mail'] },
    pro: { name: 'Pro', description: 'Pour les réseaux multi-enseignes en croissance.', features: ['Tous les modules', 'Multi-enseignes', '8 langues, arabe RTL', 'Paiements Stripe', 'Support prioritaire'] },
    enterprise: { name: 'Enterprise', description: 'Pour les master-franchisés et les réseaux 500+.', features: ['Tout Pro', 'SSO et journal d’audit', 'Structures de prix sur mesure', 'Chef de projet dédié'] },
  },
  en: {
    starter: { name: 'Starter', description: 'For networks under 10 stores.', features: ['Shop and invoicing', 'Consolidated dashboard', '2 languages', 'Email support'] },
    pro: { name: 'Pro', description: 'For growing multi-brand networks.', features: ['All modules', 'Multi-brand', '8 languages, Arabic RTL', 'Stripe payments', 'Priority support'] },
    enterprise: { name: 'Enterprise', description: 'For master franchisees and 500+ store networks.', features: ['Everything in Pro', 'SSO and audit log', 'Custom price structures', 'Named project lead'] },
  },
  ar: {
    starter: { name: 'Starter', description: 'لشبكة أقل من عشر نقاط بيع.', features: ['المتجر والفواتير', 'لوحة تحكم مجمّعة', 'لغتان', 'دعم بالبريد'] },
    pro: { name: 'Pro', description: 'للشبكات متعددة العلامات في مرحلة النمو.', features: ['كل الوحدات', 'تعدد العلامات', 'ثماني لغات مع العربية', 'مدفوعات Stripe', 'دعم بأولوية'] },
    enterprise: { name: 'Enterprise', description: 'للامتياز الرئيسي والشبكات الكبيرة.', features: ['كل مزايا Pro', 'الدخول الموحد وسجل التدقيق', 'هياكل أسعار مخصصة', 'مدير مشروع مخصص'] },
  },
};

/** Seed inbox — the three messages the back-office kit demonstrates. */
export const CONTACT_MESSAGES = [
  { name: 'Naïma Bouchard', email: 'n.bouchard@belleville.fr', company: 'Belleville Bistro', languageCode: 'fr', status: 'new', message: 'Nous ouvrons 12 points de vente en Belgique en 2027. Peut-on voir le module Scan en démo ?' },
  { name: 'Piotr Zieliński', email: 'p.zielinski@greenbowl.pl', company: 'Green Bowl', languageCode: 'pl', status: 'new', message: 'Czy moduł fakturowania obsługuje polskie faktury VAT?' },
  { name: 'Omar Haddad', email: 'o.haddad@kebabhouse.be', company: 'Kebab House', languageCode: 'ar', status: 'read', message: 'هل يمكن تشغيل الواجهة بالعربية لفرق الفروع؟' },
];
