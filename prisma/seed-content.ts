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
  // Désactivée tant qu'aucune référence client n'est autorisée à être citée.
  // Une bande de logos vide vaut mieux qu'une bande de logos inventés.
  { key: 'brands', type: 'logo-strip', sortOrder: 2, isActive: false },
  { key: 'modules', type: 'module-grid', sortOrder: 3, isActive: true },
  { key: 'steps', type: 'steps', sortOrder: 4, isActive: true },
  { key: 'diff', type: 'feature-grid', sortOrder: 5, isActive: true },
  { key: 'pricing', type: 'pricing', sortOrder: 6, isActive: true },
  { key: 'testimonials', type: 'quotes', sortOrder: 7, isActive: false },
  { key: 'contact', type: 'form', sortOrder: 8, isActive: true },
];

/**
 * tfb_brands — vide, et c'est délibéré.
 *
 * La maquette listait six enseignes (Belleville Bistro, Kebab House, Sushi Loop,
 * Café Nord, Pasta Bar, Green Bowl) : aucune n'est cliente, toutes étaient
 * inventées. Un faux logo client sur une page commerciale n'est pas un
 * placeholder, c'est une affirmation fausse.
 *
 * Ajoutez les vraies références par le back-office, une fois leur accord obtenu,
 * puis réactivez la section `brands`.
 */
export const BRANDS: { slug: string; name: string; sortOrder: number }[] = [];

/**
 * tfb_modules — vide, et c'est le point.
 *
 * La maquette posait sept modules (shop, invoicing, offers, scan, marketing,
 * ceobot, pwa) dont aucun n'existait : ni dépôt, ni écran, ni ligne de code. Les
 * modules réels viennent maintenant des dépôts eux-mêmes, chacun publiant sa
 * fiche `.tfb/module.json` que `npm run sync:modules` charge en base.
 *
 * Conséquence assumée : après `npm run seed`, la grille des modules est vide.
 * Elle se remplit à la première sync — voir README, « Rester à jour ».
 */
export const MODULES: {
  key: string; slug: string; icon: string; moduleGroup: string;
  repo: string; isNew: boolean; sortOrder: number; shots: number;
}[] = [];

/**
 * tfb_plans. `amount` est en centimes ; NULL affiche « Sur devis ».
 *
 * Les trois montants de la maquette (89 € et 149 € par point de vente) n'ont
 * jamais été validés commercialement : ils sont donc à NULL. Les trois paliers
 * s'affichent « Sur devis » et renvoient au formulaire de contact, ce qui est
 * vrai, plutôt qu'un prix inventé, qui ne l'est pas.
 *
 * Renseignez les montants ici, ou dans le back-office (Tarifs), quand ils sont
 * arrêtés — et le `stripe_price_id` correspondant pour activer le paiement.
 */
export const PLANS = [
  { key: 'starter', amount: null as number | null, currency: 'EUR', interval: 'month', isFeatured: false, stripePriceId: null, sortOrder: 1 },
  { key: 'pro', amount: null as number | null, currency: 'EUR', interval: 'month', isFeatured: true, stripePriceId: null, sortOrder: 2 },
  { key: 'enterprise', amount: null as number | null, currency: 'EUR', interval: 'year', isFeatured: false, stripePriceId: null, sortOrder: 3 },
];

/**
 * tfb_translations, entity_type='ui', entity_id=0. The `field` is the dotted key the
 * landing asks for. Multi-value fields are pipe-joined.
 */
export const UI_STRINGS: Record<AuthoredLocale, Record<string, string>> = {
  fr: {
    'nav.modules': 'Modules', 'nav.pricing': 'Tarifs', 'nav.contact': 'Contact', 'nav.signin': 'Connexion',
    'cta.demo': 'Demander une démo', 'cta.start': 'Commencer',
    'hero.eyebrow': 'ERP modulaire · Réseaux de franchise et chaînes de magasins',
    'hero.title': 'Un module par métier. Une seule base pour tout le réseau.',
    'hero.subtitle': 'Webshop, console marque, console franchisé, tournées de livraison, régie d’affichage, cuisine, fournisseur, panel consultant : huit modules qui se parlent, sur la même donnée.',
    'hero.proof1': 'Des écrans réels, pas des maquettes', 'hero.proof2': '8 langues, arabe en miroir',
    'brands.title': 'Ils pilotent leur réseau avec ces modules',
    'modules.eyebrow': 'Modules', 'modules.title': 'Huit modules, un par métier du réseau',
    'modules.lead': 'Chaque module publie sa fiche depuis son propre dépôt. Ce que vous lisez ici décrit ce qui tourne — captures comprises, pas une intention.',
    'modules.link': 'Découvrir le module', 'modules.new': 'Nouveau',
    'modules.all': 'Tous les modules', 'modules.count': 'modules', 'modules.newcount': 'nouveaux',
    'detail.back': 'Tous les modules', 'detail.connected': 'Modules connectés', 'detail.gain': 'Gain constaté',
    'detail.setup': 'Mise en route', 'detail.week': 'semaine', 'detail.sheet': 'Recevoir la fiche', 'detail.included': 'Ce que fait le module',
    'detail.overview': 'Le module en deux mots', 'detail.functions': 'Fonctions', 'detail.functions.title': 'Chaque fonction, écran à l’appui',
    'group.ventes': 'Ventes', 'group.finance': 'Finance', 'group.marketing': 'Marketing',
    'group.logistique': 'Logistique', 'group.assistance': 'Assistance', 'group.terrain': 'Terrain',
    'group.pilotage': 'Pilotage',
    'shot.alt': 'Capture du module',
    'mock.brand': 'TFB Admin · jeu de démonstration', 'mock.stores': '64 PDV',
    'mock.collected': 'Encaissé (juil.)', 'mock.licenses': 'Abonnements', 'mock.vsjune': 'vs. juin',
    'mock.thismonth': 'ce mois', 'mock.active': 'Actif',
    'mock.collected.value': '418 k€', 'mock.collected.delta': '+6,4%',
    'mock.licenses.value': '128', 'mock.licenses.delta': '+6',
    'steps.eyebrow': 'Comment ça marche', 'steps.title': 'De la reprise de vos données à la première commande',
    'steps.1t': 'Cadrage du réseau', 'steps.1d': 'Vos enseignes, vos magasins, qui a le droit de quoi. Le siège décide, le point de vente exécute.',
    'steps.2t': 'Reprise de vos données', 'steps.2d': 'Catalogue, tarifs, clients professionnels, zones de livraison : importés, pas ressaisis.',
    'steps.3t': 'Activation des modules utiles', 'steps.3d': 'Vous n’activez que ce que vous utilisez. Un module de plus s’ajoute sans toucher aux autres.',
    'steps.4t': 'Mise en service auprès des équipes', 'steps.4d': 'Les applications terrain s’installent depuis un navigateur, sans boutique d’applications ni intervention informatique.',
    'diff.eyebrow': 'Points différenciants', 'diff.title': 'Ce qu’un tableur partagé ne fera jamais',
    'diff.1t': 'Multi-enseignes natif', 'diff.1d': 'Une base, des droits par enseigne et par magasin. Le siège voit tout, chaque franchisé voit le sien.',
    'diff.2t': 'Modules connectés', 'diff.2d': 'Le catalogue du siège alimente le webshop, le webshop alimente la préparation, la préparation alimente la tournée. Aucune ressaisie entre deux étapes.',
    'diff.3t': '8 langues, arabe en miroir', 'diff.3d': 'Toutes les chaînes viennent de la base, jamais du code. En arabe, la mise en page est entièrement mirroitée.',
    'diff.4t': 'Le terrain sans installation', 'diff.4d': 'Chauffeurs, cuisine, animateurs réseau : des applications installables depuis le navigateur, qui continuent de fonctionner hors ligne.',
    'pricing.eyebrow': 'Tarifs', 'pricing.title': 'Par point de vente, pas par utilisateur',
    'pricing.lead': 'Un tarif par point de vente, pas par utilisateur : invitez les franchisés, les managers et les équipes sans compter les sièges.',
    'pricing.recommended': 'Recommandé', 'pricing.month': '/ mois par point de vente', 'pricing.custom': 'Sur devis',
    'plan.cta': 'Choisir ce plan', 'plan.cta.custom': 'Parler à un expert',
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
    'hero.eyebrow': 'Modular ERP · Franchise networks and store chains',
    'hero.title': 'One module per job. One database for the whole network.',
    'hero.subtitle': 'Webshop, brand console, franchisee console, delivery tours, digital signage, kitchen, supplier, consultant panel: eight modules that talk to each other, on the same data.',
    'hero.proof1': 'Real screens, not mockups', 'hero.proof2': '8 languages, Arabic mirrored',
    'brands.title': 'Networks running on these modules',
    'modules.eyebrow': 'Modules', 'modules.title': 'Eight modules, one per job in the network',
    'modules.lead': 'Every module publishes its own fiche from its own repository. What you read here describes what runs — screenshots included, not an intention.',
    'modules.link': 'Explore the module', 'modules.new': 'New',
    'modules.all': 'All modules', 'modules.count': 'modules', 'modules.newcount': 'new',
    'detail.back': 'All modules', 'detail.connected': 'Connected modules', 'detail.gain': 'Measured gain',
    'detail.setup': 'Setup', 'detail.week': 'week', 'detail.sheet': 'Get the datasheet', 'detail.included': 'What the module does',
    'detail.overview': 'The module in short', 'detail.functions': 'Functions', 'detail.functions.title': 'Every function, with the screen behind it',
    'group.ventes': 'Sales', 'group.finance': 'Finance', 'group.marketing': 'Marketing',
    'group.logistique': 'Logistics', 'group.assistance': 'Support', 'group.terrain': 'Field',
    'group.pilotage': 'Steering',
    'shot.alt': 'Module screenshot',
    'mock.brand': 'TFB Admin · demo dataset', 'mock.stores': '64 stores',
    'mock.collected': 'Collected (Jul)', 'mock.licenses': 'Subscriptions', 'mock.vsjune': 'vs. June',
    'mock.thismonth': 'this month', 'mock.active': 'Active',
    'steps.eyebrow': 'How it works', 'steps.title': 'From your existing data to the first order',
    'steps.1t': 'Scoping the network', 'steps.1d': 'Your brands, your stores, who may do what. Head office decides, the store executes.',
    'steps.2t': 'Bringing your data over', 'steps.2d': 'Catalogue, prices, business customers, delivery areas: imported, not retyped.',
    'steps.3t': 'Turning on the modules you need', 'steps.3d': 'You enable only what you use. One more module drops in without touching the others.',
    'steps.4t': 'Getting the teams on it', 'steps.4d': 'Field apps install straight from a browser — no app store, no IT visit.',
    'diff.eyebrow': 'Why TFB', 'diff.title': 'What a shared spreadsheet will never do',
    'diff.1t': 'Multi-brand by design', 'diff.1d': 'One database, rights per brand and per store. Head office sees everything, each franchisee sees their own.',
    'diff.2t': 'Connected modules', 'diff.2d': 'Head office\'s catalogue feeds the webshop, the webshop feeds preparation, preparation feeds the delivery tour. Nothing is retyped between two steps.',
    'diff.3t': '8 languages, Arabic mirrored', 'diff.3d': 'Every string comes from the database, never from the code. In Arabic the whole layout mirrors.',
    'diff.4t': 'The field, with nothing to install', 'diff.4d': 'Drivers, kitchen, network consultants: apps installed from the browser that keep working offline.',
    'pricing.eyebrow': 'Pricing', 'pricing.title': 'Per store, not per seat',
    'pricing.lead': 'Priced per store, not per user: invite the franchisees, the managers and the teams without counting seats.',
    'pricing.recommended': 'Recommended', 'pricing.month': '/ month per store', 'pricing.custom': 'Custom',
    'plan.cta': 'Choose this plan', 'plan.cta.custom': 'Talk to an expert',
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
    'hero.eyebrow': 'نظام معياري · شبكات الامتياز وسلاسل المتاجر',
    'hero.title': 'وحدة لكل مهنة، وقاعدة بيانات واحدة للشبكة كلها.',
    'hero.subtitle': 'المتجر الإلكتروني، لوحة العلامة، لوحة صاحب الامتياز، جولات التوصيل، شاشات العرض، المطبخ، المورّد، لوحة المستشارين: ثماني وحدات مترابطة على البيانات نفسها.',
    'hero.proof1': 'شاشات حقيقية، لا نماذج', 'hero.proof2': 'ثماني لغات، والعربية بتخطيط معكوس',
    'brands.title': 'شبكات تدير أعمالها بهذه الوحدات',
    'modules.eyebrow': 'الوحدات', 'modules.title': 'ثماني وحدات، واحدة لكل مهنة في الشبكة',
    'modules.lead': 'كل وحدة تنشر بطاقتها من مستودعها. ما تقرأه هنا يصف ما يعمل فعلًا، بالصور، لا ما ننوي عمله.',
    'modules.link': 'استكشف الوحدة', 'modules.new': 'جديد',
    'modules.all': 'كل الوحدات', 'modules.count': 'وحدات', 'modules.newcount': 'جديدة',
    'detail.back': 'كل الوحدات', 'detail.connected': 'وحدات مترابطة', 'detail.gain': 'النتيجة المقاسة',
    'detail.setup': 'التشغيل', 'detail.week': 'أسبوع', 'detail.sheet': 'احصل على الملف', 'detail.included': 'ما تفعله الوحدة',
    'detail.overview': 'الوحدة باختصار', 'detail.functions': 'الوظائف', 'detail.functions.title': 'كل وظيفة مع الشاشة التي تثبتها',
    'group.ventes': 'المبيعات', 'group.finance': 'المالية', 'group.marketing': 'التسويق',
    'group.logistique': 'اللوجستيات', 'group.assistance': 'الدعم', 'group.terrain': 'الميدان',
    'group.pilotage': 'القيادة',
    'shot.alt': 'لقطة شاشة للوحدة',
    'mock.brand': 'TFB Admin · بيانات تجريبية', 'mock.stores': '64 نقطة بيع',
    'mock.collected': 'المحصّل (يوليو)', 'mock.licenses': 'الاشتراكات', 'mock.vsjune': 'مقارنة بيونيو',
    'mock.thismonth': 'هذا الشهر', 'mock.active': 'نشط',
    'steps.eyebrow': 'كيف يعمل', 'steps.title': 'من بياناتك الحالية إلى أول طلب',
    'steps.1t': 'تحديد إطار الشبكة', 'steps.1d': 'علاماتك وفروعك ومن يحق له ماذا. المقر يقرّر، والفرع ينفّذ.',
    'steps.2t': 'نقل بياناتك', 'steps.2d': 'الكتالوج والأسعار وعملاء الشركات ومناطق التوصيل: تُستورد ولا تُعاد كتابتها.',
    'steps.3t': 'تفعيل الوحدات المفيدة', 'steps.3d': 'تفعّل ما تستخدمه فقط. وحدة إضافية تُضاف دون المساس بالبقية.',
    'steps.4t': 'تشغيلها مع الفرق', 'steps.4d': 'تطبيقات الميدان تُثبَّت من المتصفح مباشرة، بلا متجر تطبيقات ولا تدخل تقني.',
    'diff.eyebrow': 'لماذا TFB', 'diff.title': 'ما لن يفعله جدول بيانات مشترك أبدًا',
    'diff.1t': 'تعدد العلامات أصلًا', 'diff.1d': 'قاعدة واحدة وصلاحيات لكل علامة وكل فرع. المقر يرى كل شيء، وكل صاحب امتياز يرى ما يخصه.',
    'diff.2t': 'وحدات مترابطة', 'diff.2d': 'كتالوج المقر يغذّي المتجر، والمتجر يغذّي التحضير، والتحضير يغذّي جولة التوصيل. لا إعادة إدخال بين خطوتين.',
    'diff.3t': 'ثماني لغات، والعربية معكوسة', 'diff.3d': 'كل النصوص تأتي من قاعدة البيانات لا من الشيفرة. وبالعربية ينعكس التخطيط بالكامل.',
    'diff.4t': 'الميدان بلا تثبيت', 'diff.4d': 'السائقون والمطبخ ومستشارو الشبكة: تطبيقات تُثبَّت من المتصفح وتستمر في العمل دون اتصال.',
    'pricing.eyebrow': 'الأسعار', 'pricing.title': 'لكل نقطة بيع، لا لكل مستخدم',
    'pricing.lead': 'سعر لكل نقطة بيع لا لكل مستخدم: ادعُ أصحاب الامتياز والمديرين والفرق دون حساب المقاعد.',
    'pricing.recommended': 'موصى به', 'pricing.month': '/ شهريًا لكل نقطة بيع', 'pricing.custom': 'حسب الطلب',
    'plan.cta': 'اختر هذه الخطة', 'plan.cta.custom': 'تحدث إلى خبير',
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
 * tfb_translations, entity_type='module' — vide pour la même raison que MODULES.
 * La copie de chaque module (nom, description, explication, fonctions) vit dans
 * le `.tfb/module.json` de son dépôt, en français et en anglais, et arrive par
 * la sync. Le type reste exporté : le back-office et la sync s'y appuient.
 */
type ModuleCopy = { name: string; description: string; bullets?: string[]; metric?: [string, string] };

export const MODULE_STRINGS: Record<AuthoredLocale, Record<string, ModuleCopy>> = {
  fr: {}, en: {}, ar: {},
};

/**
 * tfb_translations, entity_type='plan'. Champs : name, description, features.
 *
 * `features` est vide partout : les listes de la maquette annonçaient un
 * découpage par palier (« Shop et facturation » en Starter, « tous les modules »
 * en Pro) qui n'a jamais été arrêté commercialement, et citait des modules qui
 * n'existent pas. Un palier annonce donc pour qui il est, et rien de plus, tant
 * que l'offre n'est pas fixée. Renseignez-les dans le back-office (Tarifs).
 */
type PlanCopy = { name: string; description: string; features: string[] };

export const PLAN_STRINGS: Record<AuthoredLocale, Record<string, PlanCopy>> = {
  fr: {
    starter: { name: 'Starter', description: 'Pour un réseau de moins de 10 points de vente.', features: [] },
    pro: { name: 'Pro', description: 'Pour les réseaux multi-enseignes en croissance.', features: [] },
    enterprise: { name: 'Enterprise', description: 'Pour les master-franchisés et les réseaux 500+.', features: [] },
  },
  en: {
    starter: { name: 'Starter', description: 'For networks under 10 stores.', features: [] },
    pro: { name: 'Pro', description: 'For growing multi-brand networks.', features: [] },
    enterprise: { name: 'Enterprise', description: 'For master franchisees and 500+ store networks.', features: [] },
  },
  ar: {
    starter: { name: 'Starter', description: 'لشبكة أقل من عشر نقاط بيع.', features: [] },
    pro: { name: 'Pro', description: 'للشبكات متعددة العلامات في مرحلة النمو.', features: [] },
    enterprise: { name: 'Enterprise', description: 'للامتياز الرئيسي والشبكات الكبيرة.', features: [] },
  },
};

/**
 * Boîte de réception de démonstration, pour que l'écran « Messages » du
 * back-office ne soit pas vide à la première ouverture. Ce sont des exemples
 * assumés : ni ces personnes ni ces sociétés n'existent, et les adresses sont en
 * `example.com`, réservé à cet usage. Supprimez-les dès les premiers vrais
 * messages.
 */
export const CONTACT_MESSAGES = [
  { name: 'Exemple — direction réseau', email: 'demo-1@example.com', company: 'Enseigne de démonstration', languageCode: 'fr', status: 'new', message: 'Message d’exemple : nous ouvrons douze points de vente l’an prochain, peut-on voir la console marque et les tournées de livraison en démo ?' },
  { name: 'Exemple — franchisé', email: 'demo-2@example.com', company: 'Point de vente de démonstration', languageCode: 'fr', status: 'new', message: 'Message d’exemple : est-ce que la console franchisé gère les clients professionnels et les créneaux de livraison ?' },
  { name: 'Exemple — message lu', email: 'demo-3@example.com', company: 'Enseigne de démonstration', languageCode: 'en', status: 'read', message: 'Sample message: can the kitchen app and the signage run in a store with an unreliable connection?' },
];
