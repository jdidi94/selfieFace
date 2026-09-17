import {
  Locale,
  MerchandisingRailKind,
  ProductKind,
  ProductStatus,
  type PrismaClient,
} from '@prisma/client';

/** Deterministic slug prefixes so re-seed is idempotent and countable. */
export const FULL_CATEGORY_PREFIX = 'cat-';
export const FULL_PRODUCT_PREFIX = 'prod-';
export const FULL_PACK_PREFIX = 'pack-';

const IMAGE_POOL = [
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1571781926291-c77df46a9a55?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1620916297397-a4a3322f5eca?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1631730486572-226b1e126218?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1200&q=80',
] as const;

type Loc = { en: string; ar: string; fr: string };

type CategorySpec = {
  slug: string;
  sortOrder: number;
  name: Loc;
  description: Loc;
};

type BrandSpec = {
  slug: string;
  name: Loc;
  description: Loc;
  imageUrl: string;
};

type ProductTemplate = {
  name: string;
  nameAr: string;
  nameFr: string;
  shortEn: string;
  shortAr: string;
  shortFr: string;
  descEn: string;
  benefits: string;
  howToUse: string;
  suitableFor: string;
  tags: string[];
  sizes: { name: string; usd: number; compareUsd?: number; weightGrams: number }[];
};

function pricesFromUsd(usd: number, compareAtUsd?: number) {
  return [
    { currency: 'USD' as const, amount: usd, compareAtAmount: compareAtUsd ?? null },
    {
      currency: 'TND' as const,
      amount: Math.round(usd * 3.1),
      compareAtAmount: compareAtUsd != null ? Math.round(compareAtUsd * 3.1) : null,
    },
    {
      currency: 'AED' as const,
      amount: Math.round(usd * 3.67),
      compareAtAmount: compareAtUsd != null ? Math.round(compareAtUsd * 3.67) : null,
    },
  ];
}

function pad(n: number, width = 3) {
  return String(n).padStart(width, '0');
}

/** 40 storefront categories — realistic beauty retail taxonomy. */
export const FULL_CATEGORIES: CategorySpec[] = [
  {
    slug: 'skincare',
    sortOrder: 1,
    name: { en: 'Skincare', ar: 'العناية بالبشرة', fr: 'Soins de la peau' },
    description: {
      en: 'Cleansers, treatments, moisturizers, SPF',
      ar: 'منظفات، علاجات، مرطبات، واقي شمس',
      fr: 'Nettoyants, traitements, hydratants, SPF',
    },
  },
  {
    slug: 'body-care',
    sortOrder: 2,
    name: { en: 'Body care', ar: 'العناية بالجسم', fr: 'Soins du corps' },
    description: {
      en: 'Lotions, oils, washes',
      ar: 'لوشن، زيوت، غسولات',
      fr: 'Lotions, huiles, lavages',
    },
  },
  {
    slug: 'cleansers',
    sortOrder: 3,
    name: { en: 'Cleansers', ar: 'منظفات الوجه', fr: 'Nettoyants' },
    description: {
      en: 'Cream, gel, and oil cleansers',
      ar: 'منظفات كريمية وجلية وزيوت',
      fr: 'Nettoyants crème, gel et huile',
    },
  },
  {
    slug: 'toners-mists',
    sortOrder: 4,
    name: { en: 'Toners & mists', ar: 'تونر ورذاذ', fr: 'Toniques & brumes' },
    description: {
      en: 'Prep and refresh between cleanse and treat',
      ar: 'تحضير وانتعاش بين التنظيف والعلاج',
      fr: 'Préparer et rafraîchir entre nettoyage et soin',
    },
  },
  {
    slug: 'serums',
    sortOrder: 5,
    name: { en: 'Serums', ar: 'سيرومات', fr: 'Sérums' },
    description: {
      en: 'Targeted treatments in lightweight textures',
      ar: 'علاجات مركّزة بملمس خفيف',
      fr: 'Soins ciblés en textures légères',
    },
  },
  {
    slug: 'moisturizers',
    sortOrder: 6,
    name: { en: 'Moisturizers', ar: 'مرطبات', fr: 'Hydratants' },
    description: {
      en: 'Day and night creams for every climate',
      ar: 'كريمات نهار وليل لكل المناخات',
      fr: 'Crèmes jour et nuit pour tous climats',
    },
  },
  {
    slug: 'eye-care',
    sortOrder: 7,
    name: { en: 'Eye care', ar: 'العناية بالعين', fr: 'Soin des yeux' },
    description: {
      en: 'Creams and gels for the eye contour',
      ar: 'كريمات وجل لمحيط العين',
      fr: 'Crèmes et gels pour le contour des yeux',
    },
  },
  {
    slug: 'face-oils',
    sortOrder: 8,
    name: { en: 'Face oils', ar: 'زيوت الوجه', fr: 'Huiles visage' },
    description: {
      en: 'Botanical oils for seal and glow',
      ar: 'زيوت نباتية للختم والإشراق',
      fr: 'Huiles botaniques pour sceller et illuminer',
    },
  },
  {
    slug: 'exfoliators',
    sortOrder: 9,
    name: { en: 'Exfoliators', ar: 'مقشرات', fr: 'Exfoliants' },
    description: {
      en: 'Chemical and gentle physical renewals',
      ar: 'تجديد كيميائي وفيزيائي لطيف',
      fr: 'Renouvellement chimique et physique doux',
    },
  },
  {
    slug: 'masks',
    sortOrder: 10,
    name: { en: 'Masks', ar: 'أقنعة', fr: 'Masques' },
    description: {
      en: 'Clay, sheet, and overnight masks',
      ar: 'أقنعة طين وصحائف وليلية',
      fr: 'Masques argile, tissu et nuit',
    },
  },
  {
    slug: 'spf-sun',
    sortOrder: 11,
    name: { en: 'SPF & sun care', ar: 'واقي الشمس', fr: 'SPF & solaire' },
    description: {
      en: 'Daily mineral and hybrid SPF',
      ar: 'واقي يومي معدني وهجين',
      fr: 'SPF quotidien minéral et hybride',
    },
  },
  {
    slug: 'makeup-face',
    sortOrder: 12,
    name: { en: 'Face makeup', ar: 'مكياج الوجه', fr: 'Maquillage teint' },
    description: {
      en: 'Base, blush, and complexion',
      ar: 'أساس وخدود وبشرة موحدة',
      fr: 'Base, blush et teint',
    },
  },
  {
    slug: 'foundation',
    sortOrder: 13,
    name: { en: 'Foundation', ar: 'فاونديشن', fr: 'Fond de teint' },
    description: {
      en: 'Sheer to full coverage bases',
      ar: 'أغطية من الشفافة إلى الكاملة',
      fr: 'Couvrance légère à complète',
    },
  },
  {
    slug: 'concealer',
    sortOrder: 14,
    name: { en: 'Concealer', ar: 'كونسيلر', fr: 'Anti-cernes' },
    description: {
      en: 'Spot and under-eye coverage',
      ar: 'تغطية البقع ومحيط العين',
      fr: 'Couverture localisée et cernes',
    },
  },
  {
    slug: 'blush-bronzer',
    sortOrder: 15,
    name: { en: 'Blush & bronzer', ar: 'بلاش وبرونزر', fr: 'Blush & bronzer' },
    description: {
      en: 'Cheek color and soft contour',
      ar: 'لون الخدود وكنتور ناعم',
      fr: 'Couleur joues et contour doux',
    },
  },
  {
    slug: 'highlighter',
    sortOrder: 16,
    name: { en: 'Highlighter', ar: 'هايلايتر', fr: 'Enlumineur' },
    description: {
      en: 'Liquid and powder glow',
      ar: 'توهج سائل وبودرة',
      fr: 'Éclat liquide et poudre',
    },
  },
  {
    slug: 'lips',
    sortOrder: 17,
    name: { en: 'Lips', ar: 'الشفاه', fr: 'Lèvres' },
    description: {
      en: 'Color, balm, and care',
      ar: 'لون وبلسم وعناية',
      fr: 'Couleur, baume et soin',
    },
  },
  {
    slug: 'lipstick',
    sortOrder: 18,
    name: { en: 'Lipstick', ar: 'أحمر شفاه', fr: 'Rouge à lèvres' },
    description: {
      en: 'Satin, matte, and cream formulas',
      ar: 'ساتان ومات وكريمي',
      fr: 'Formules satin, mat et crème',
    },
  },
  {
    slug: 'lip-gloss',
    sortOrder: 19,
    name: { en: 'Lip gloss', ar: 'ملمع شفاه', fr: 'Gloss' },
    description: {
      en: 'Sheer shine and tinted gloss',
      ar: 'لمعان شفاف وملون',
      fr: 'Brillance légère et gloss teinté',
    },
  },
  {
    slug: 'mascara',
    sortOrder: 20,
    name: { en: 'Mascara', ar: 'ماسكارا', fr: 'Mascara' },
    description: {
      en: 'Length, volume, and definition',
      ar: 'طول وكثافة وتحديد',
      fr: 'Longueur, volume et définition',
    },
  },
  {
    slug: 'eyeshadow',
    sortOrder: 21,
    name: { en: 'Eyeshadow', ar: 'ظلال عيون', fr: 'Fards à paupières' },
    description: {
      en: 'Singles and palettes',
      ar: 'ألوان فردية وباليتات',
      fr: 'Unités et palettes',
    },
  },
  {
    slug: 'eyeliner',
    sortOrder: 22,
    name: { en: 'Eyeliner', ar: 'آيلاينر', fr: 'Eyeliner' },
    description: {
      en: 'Gel, pencil, and liquid liners',
      ar: 'جل وقلم وسائل',
      fr: 'Gel, crayon et liquide',
    },
  },
  {
    slug: 'brows',
    sortOrder: 23,
    name: { en: 'Brows', ar: 'الحواجب', fr: 'Sourcils' },
    description: {
      en: 'Gels, pencils, and pomades',
      ar: 'جل وقلم وبوماد',
      fr: 'Gels, crayons et pommades',
    },
  },
  {
    slug: 'hair-care',
    sortOrder: 24,
    name: { en: 'Hair care', ar: 'العناية بالشعر', fr: 'Soins capillaires' },
    description: {
      en: 'Cleanse, condition, treat',
      ar: 'تنظيف وترطيب وعلاج',
      fr: 'Laver, démêler, traiter',
    },
  },
  {
    slug: 'shampoo',
    sortOrder: 25,
    name: { en: 'Shampoo', ar: 'شامبو', fr: 'Shampoing' },
    description: {
      en: 'Everyday and targeted formulas',
      ar: 'تركيبات يومية ومستهدفة',
      fr: 'Formules quotidiennes et ciblées',
    },
  },
  {
    slug: 'conditioner',
    sortOrder: 26,
    name: { en: 'Conditioner', ar: 'بلسم', fr: 'Après-shampoing' },
    description: {
      en: 'Rinse-out and leave-in softners',
      ar: 'بلسم يغسل ويترك',
      fr: 'Rinçage et leave-in',
    },
  },
  {
    slug: 'hair-treatments',
    sortOrder: 27,
    name: { en: 'Hair treatments', ar: 'علاجات الشعر', fr: 'Soins intensifs' },
    description: {
      en: 'Masks, oils, and scalp serums',
      ar: 'أقنعة وزيوت وسيروم فروة',
      fr: 'Masques, huiles et sérums cuir chevelu',
    },
  },
  {
    slug: 'styling',
    sortOrder: 28,
    name: { en: 'Styling', ar: 'تصفيف', fr: 'Coiffage' },
    description: {
      en: 'Hold, texture, and heat protection',
      ar: 'تثبيت وملمس وحماية حرارية',
      fr: 'Tenue, texture et thermo-protection',
    },
  },
  {
    slug: 'fragrance',
    sortOrder: 29,
    name: { en: 'Fragrance', ar: 'عطور', fr: 'Parfums' },
    description: {
      en: 'Eau de parfum and soft scents',
      ar: 'عطر ماء وعطور ناعمة',
      fr: 'Eau de parfum et senteurs douces',
    },
  },
  {
    slug: 'perfume',
    sortOrder: 30,
    name: { en: 'Perfume', ar: 'عطر مركز', fr: 'Parfum' },
    description: {
      en: 'Signature scents for day and evening',
      ar: 'عطور مميزة للنهار والمساء',
      fr: 'Senteurs signatures jour et soir',
    },
  },
  {
    slug: 'body-fragrance',
    sortOrder: 31,
    name: { en: 'Body fragrance', ar: 'عطر الجسم', fr: 'Parfum corps' },
    description: {
      en: 'Mists, oils, and soft body scents',
      ar: 'رذاذ وزيوت وعطور جسم ناعمة',
      fr: 'Brumes, huiles et parfums corps',
    },
  },
  {
    slug: 'bath-shower',
    sortOrder: 32,
    name: { en: 'Bath & shower', ar: 'حمام ودش', fr: 'Bain & douche' },
    description: {
      en: 'Washes, scrubs, and bath oils',
      ar: 'غسولات ومقشرات وزيوت حمام',
      fr: 'Gels, gommages et huiles de bain',
    },
  },
  {
    slug: 'hand-care',
    sortOrder: 33,
    name: { en: 'Hand care', ar: 'العناية باليدين', fr: 'Soin des mains' },
    description: {
      en: 'Creams and cuticle oils',
      ar: 'كريمات وزيوت الأظافر',
      fr: 'Crèmes et huiles cuticules',
    },
  },
  {
    slug: 'nail-care',
    sortOrder: 34,
    name: { en: 'Nail care', ar: 'العناية بالأظافر', fr: 'Soin des ongles' },
    description: {
      en: 'Polish, base, and strengtheners',
      ar: 'طلاء وأساس ومقويات',
      fr: 'Vernis, base et fortifiants',
    },
  },
  {
    slug: 'tools-brushes',
    sortOrder: 35,
    name: { en: 'Tools & brushes', ar: 'أدوات وفرش', fr: 'Outils & pinceaux' },
    description: {
      en: 'Applicators, sponges, and tools',
      ar: 'أدوات تطبيق وإسفنج',
      fr: 'Applicateurs, éponges et outils',
    },
  },
  {
    slug: 'mens-grooming',
    sortOrder: 36,
    name: { en: "Men's grooming", ar: 'عناية الرجال', fr: 'Soins hommes' },
    description: {
      en: 'Face, shave, and hair for him',
      ar: 'وجه وحلاقة وشعر للرجل',
      fr: 'Visage, rasage et cheveux',
    },
  },
  {
    slug: 'clean-beauty',
    sortOrder: 37,
    name: { en: 'Clean beauty', ar: 'جمال نظيف', fr: 'Clean beauty' },
    description: {
      en: 'Short-list ingredient formulas',
      ar: 'تركيبات بمكونات مختارة',
      fr: 'Formules à liste courte',
    },
  },
  {
    slug: 'travel-sizes',
    sortOrder: 38,
    name: { en: 'Travel sizes', ar: 'أحجام السفر', fr: 'Formats voyage' },
    description: {
      en: 'Minis for bags and trials',
      ar: 'ميني للحقائب والتجربة',
      fr: 'Minis pour le sac et l’essai',
    },
  },
  {
    slug: 'seasonal',
    sortOrder: 39,
    name: { en: 'Seasonal', ar: 'موسمي', fr: 'Saisonnier' },
    description: {
      en: 'Limited drops and seasonal edits',
      ar: 'إصدارات محدودة وتحريرات موسمية',
      fr: 'Éditions limitées et sélections saisonnières',
    },
  },
  {
    slug: 'sets-kits',
    sortOrder: 40,
    name: { en: 'Sets & kits', ar: 'مجموعات وأطقم', fr: 'Coffrets & kits' },
    description: {
      en: 'Curated multi-step routines',
      ar: 'روتينات متعددة الخطوات',
      fr: 'Rituels multi-étapes sélectionnés',
    },
  },
];

const BRANDS: BrandSpec[] = [
  {
    slug: 'lumea',
    name: {
      en: 'Selfieface',
      ar: 'Selfieface',
      fr: 'Selfieface',
    },
    description: {
      en: 'Calm editorial beauty — skincare-led rituals.',
      ar: 'جمال تحريري هادئ — طقوس عناية بالبشرة.',
      fr: 'Beauté éditoriale apaisée — rituels skincare.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'atelier-vert',
    name: { en: 'Atelier Vert', ar: 'أتيليه فير', fr: 'Atelier Vert' },
    description: {
      en: 'Plant-forward formulas with a quiet green aesthetic.',
      ar: 'تركيبات نباتية بمظهر أخضر هادئ.',
      fr: 'Formules végétales à l’esthétique verte discrète.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'noir-lab',
    name: { en: 'Noir Lab', ar: 'نوار لاب', fr: 'Noir Lab' },
    description: {
      en: 'Minimal makeup with soft-matte finishes.',
      ar: 'مكياج بسيط بلمسات مات ناعمة.',
      fr: 'Maquillage minimal aux finis mat doux.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'sable-coast',
    name: { en: 'Sable Coast', ar: 'سابل كوست', fr: 'Sable Coast' },
    description: {
      en: 'Sun, sea salt, and body ritual essentials.',
      ar: 'أساسيات طقوس الشمس والملح والجسم.',
      fr: 'Essentiels soleil, sel et rituels corps.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'velvet-row',
    name: { en: 'Velvet Row', ar: 'فيلفيت رو', fr: 'Velvet Row' },
    description: {
      en: 'Lip and cheek color with editorial pigment.',
      ar: 'ألوان شفاه وخدود بصبغة تحريرية.',
      fr: 'Couleurs lèvres et joues au pigment éditorial.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'helix-hair',
    name: { en: 'Helix Hair', ar: 'هيليكس هير', fr: 'Helix Hair' },
    description: {
      en: 'Cleanse-to-style systems for modern hair.',
      ar: 'أنظمة من التنظيف إلى التصفيف لشعر عصري.',
      fr: 'Systèmes du lavage au coiffage pour cheveux modernes.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'ambre-nuit',
    name: { en: 'Ambre Nuit', ar: 'أمبر نوي', fr: 'Ambre Nuit' },
    description: {
      en: 'Warm amber fragrances and soft body scents.',
      ar: 'عطور عنبر دافئة وعطور جسم ناعمة.',
      fr: 'Parfums ambrés chauds et senteurs corps douces.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1541644339814-b682ff555afa?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'mira-tools',
    name: { en: 'Mira Tools', ar: 'ميرا تولز', fr: 'Mira Tools' },
    description: {
      en: 'Precision brushes and application tools.',
      ar: 'فرش دقيقة وأدوات تطبيق.',
      fr: 'Pinceaux de précision et outils d’application.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'oak-groom',
    name: { en: 'Oak & Groom', ar: 'أوك آند غروم', fr: 'Oak & Groom' },
    description: {
      en: 'Straightforward grooming for face and shave.',
      ar: 'عناية مباشرة للوجه والحلاقة.',
      fr: 'Soins simples pour visage et rasage.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=160&q=80',
  },
  {
    slug: 'petal-studio',
    name: { en: 'Petal Studio', ar: 'بيتال ستوديو', fr: 'Petal Studio' },
    description: {
      en: 'Soft florals for seasonal and travel edits.',
      ar: 'زهور ناعمة للموسم والسفر.',
      fr: 'Floraux doux pour éditions saisonnières et voyage.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=160&q=80',
  },
];

/** 100 realistic product templates — name + copy + sizes. Category/brand assigned by index. */
const PRODUCT_TEMPLATES: ProductTemplate[] = [
  // 01–10 Skincare / cleansers / toners
  {
    name: 'Cloud Cream Cleanser',
    nameAr: 'منظف كريمي سحابي',
    nameFr: 'Nettoyant crème nuage',
    shortEn: 'A cushioned cleanse that lifts SPF without stripping.',
    shortAr: 'تنظيف مخملي يزيل واقي الشمس دون تجفيف.',
    shortFr: 'Un nettoyage coussiné qui retire le SPF sans agresser.',
    descEn:
      'Soft surfactants and oat extract rinse clean while leaving the barrier comfortable. Designed for morning and evening use under dry climates.',
    benefits: 'Removes light makeup\nBarrier-friendly\nFragrance-light',
    howToUse: 'Massage onto damp skin for 30 seconds, rinse with lukewarm water.',
    suitableFor: 'Normal, dry, and sensitive skin',
    tags: ['cleanser', 'hydrating', 'skincare'],
    sizes: [
      { name: '150ml', usd: 2400, weightGrams: 180 },
      { name: '250ml', usd: 3400, compareUsd: 3800, weightGrams: 290 },
    ],
  },
  {
    name: 'Gelée Fresh Wash',
    nameAr: 'غسول جيليه منعش',
    nameFr: 'Gelée nettoyante fraîche',
    shortEn: 'A water-light gelée for combination skin mornings.',
    shortAr: 'جيليه خفيفة كالماء لبشرة مختلطة صباحاً.',
    shortFr: 'Une gelée légère pour les matins peaux mixtes.',
    descEn:
      'Clears overnight oil without a tight after-feel. Pairs well before toner and serum on warm days.',
    benefits: 'Non-stripping\nQuick rinse\nPore-fresh feel',
    howToUse: 'Apply to wet face, emulsify, rinse. Follow with mist or toner.',
    suitableFor: 'Combination and oily skin',
    tags: ['cleanser', 'gel', 'skincare'],
    sizes: [{ name: '120ml', usd: 2200, weightGrams: 150 }],
  },
  {
    name: 'Balm-to-Oil Cleanse',
    nameAr: 'بلسم يتحول لزيت',
    nameFr: 'Baume nettoyant huileux',
    shortEn: 'First-step balm that melts mascara and sunscreen.',
    shortAr: 'بلسم أول خطوة يذيب الماسكارا وواقي الشمس.',
    shortFr: 'Baume première étape qui fond mascara et SPF.',
    descEn:
      'Plant butters melt into a silky oil, then milk away with water. Ideal as step one of a double cleanse.',
    benefits: 'Dissolves SPF\nNo eye sting\nRinses clean',
    howToUse: 'Massage dry, add water to milk, rinse. Follow with a water cleanser.',
    suitableFor: 'All skin types; evening ritual',
    tags: ['cleanser', 'oil', 'makeup-remover'],
    sizes: [{ name: '100ml', usd: 3200, compareUsd: 3600, weightGrams: 120 }],
  },
  {
    name: 'Rose Water Prep Mist',
    nameAr: 'رذاذ ماء الورد',
    nameFr: 'Brume préparatrice rose',
    shortEn: 'A soft mist to hydrate and set the next layer.',
    shortAr: 'رذاذ ناعم يرطّب ويمهّد للخطوة التالية.',
    shortFr: 'Une brume douce qui hydrate et prépare la suite.',
    descEn:
      'Damask rose water with a whisper of glycerin. Use after cleanse or to refresh makeup midday.',
    benefits: 'Hydrating mist\nMakeup-friendly\nTravel size friendly',
    howToUse: 'Mist face with eyes closed. Pat gently, then serum.',
    suitableFor: 'All skin types',
    tags: ['toner', 'mist', 'hydrating'],
    sizes: [
      { name: '50ml', usd: 1600, weightGrams: 70 },
      { name: '100ml', usd: 2400, weightGrams: 120 },
    ],
  },
  {
    name: 'PHA Clarifying Toner',
    nameAr: 'تونر PHA مُنقّي',
    nameFr: 'Tonique clarifiant PHA',
    shortEn: 'Gentle PHA toner for smoother-looking texture.',
    shortAr: 'تونر PHA لطيف لملمس أكثر نعومة.',
    shortFr: 'Tonique PHA doux pour un grain plus lisse.',
    descEn:
      'Low-strength polyhydroxy acids support renewal without the sting of stronger acids. Best used at night a few times a week.',
    benefits: 'Refine look of texture\nBarrier-aware\nNo alcohol burn',
    howToUse: 'Sweep on cotton after cleansing, 2–4 nights weekly.',
    suitableFor: 'Combination skin; avoid broken skin',
    tags: ['toner', 'exfoliating', 'pha'],
    sizes: [{ name: '150ml', usd: 2800, weightGrams: 180 }],
  },
  {
    name: 'Barrier Comfort Serum',
    nameAr: 'سيروم راحة الحاجز',
    nameFr: 'Sérum confort barrière',
    shortEn: 'Ceramide-forward serum for calm, resilient skin.',
    shortAr: 'سيروم سيراميد لبشرة هادئة ومرنة.',
    shortFr: 'Sérum céramides pour peau calme et résiliente.',
    descEn:
      'A quiet, non-sticky serum that layers under moisturizer. Built for stressed or post-travel skin.',
    benefits: 'Supports barrier\nFast absorb\nLayers well',
    howToUse: '2–3 drops on damp skin morning and/or night.',
    suitableFor: 'Dry, sensitive, recovering skin',
    tags: ['serum', 'barrier', 'hydrating'],
    sizes: [{ name: '30ml', usd: 4800, compareUsd: 5400, weightGrams: 60 }],
  },
  {
    name: 'Vitamin C Glow Drops',
    nameAr: 'قطرات فيتامين سي للإشراق',
    nameFr: 'Gouttes éclat vitamine C',
    shortEn: 'Stable vitamin C for a brighter-looking morning.',
    shortAr: 'فيتامين سي مستقر لإشراق صباحي.',
    shortFr: 'Vitamine C stable pour un matin plus lumineux.',
    descEn:
      '15% derivative vitamin C in a water-gel base. Wear under SPF; store away from heat.',
    benefits: 'Brightening look\nAntioxidant support\nNon-greasy',
    howToUse: 'Apply after toner in the AM. Follow with moisturizer and SPF.',
    suitableFor: 'Normal to dull-looking skin',
    tags: ['serum', 'vitamin-c', 'brightening'],
    sizes: [{ name: '20ml', usd: 4200, weightGrams: 45 }],
  },
  {
    name: 'Niacinamide Clear Fluid',
    nameAr: 'سائل نياسيناميد صافٍ',
    nameFr: 'Fluide clair niacinamide',
    shortEn: 'Lightweight niacinamide for balanced-looking pores.',
    shortAr: 'نياسيناميد خفيف لمظهر مسام أكثر توازناً.',
    shortFr: 'Niacinamide léger pour un grain plus équilibré.',
    descEn:
      '5% niacinamide with zinc PCA in a fluid that disappears under makeup. Ideal for humid climates.',
    benefits: 'Oil-balance feel\nMakeup-friendly\nDaily use',
    howToUse: 'Press onto clean skin AM/PM before cream.',
    suitableFor: 'Combination and oily skin',
    tags: ['serum', 'niacinamide', 'pores'],
    sizes: [{ name: '30ml', usd: 3600, weightGrams: 55 }],
  },
  {
    name: 'Peptide Night Concentrate',
    nameAr: 'مركز ببتيدات ليلي',
    nameFr: 'Concentré peptides nuit',
    shortEn: 'Peptide concentrate for overnight firmness feel.',
    shortAr: 'مركز ببتيدات لإحساس تماسك ليلي.',
    shortFr: 'Concentré peptides pour un effet fermeté nocturne.',
    descEn:
      'A rich gel-cream serum with multi-peptides. Use as the hero step before night cream.',
    benefits: 'Night repair feel\nCushioned texture\nFragrance-free',
    howToUse: 'Apply 3 pumps after cleansing at night.',
    suitableFor: 'Mature and dry skin',
    tags: ['serum', 'peptides', 'night'],
    sizes: [{ name: '30ml', usd: 5600, compareUsd: 6200, weightGrams: 65 }],
  },
  {
    name: 'Daily Soft Moisturizer',
    nameAr: 'مرطب يومي ناعم',
    nameFr: 'Hydratant doux quotidien',
    shortEn: 'Everyday cream that softens without shine.',
    shortAr: 'كريم يومي ينعم دون لمعان.',
    shortFr: 'Crème quotidienne qui adoucit sans brillance.',
    descEn:
      'Shea and squalane in a mid-weight cream. Works alone or under SPF and makeup.',
    benefits: 'All-day comfort\nNon-pilling\nMakeup base friendly',
    howToUse: 'Apply morning and night after serum.',
    suitableFor: 'Normal to dry skin',
    tags: ['moisturizer', 'hydrating', 'daily'],
    sizes: [
      { name: '50ml', usd: 3800, weightGrams: 80 },
      { name: '100ml', usd: 5800, weightGrams: 140 },
    ],
  },
  // 11–20 Eye / oils / exfoliators / masks / SPF
  {
    name: 'Cooling Eye Gel',
    nameAr: 'جل عين مبرّد',
    nameFr: 'Gel yeux rafraîchissant',
    shortEn: 'Metal-tip gel for morning puffiness feel.',
    shortAr: 'جل بطرف معدني لإحساس انتفاخ الصباح.',
    shortFr: 'Gel à embout métal pour le matin.',
    descEn: 'Caffeine and cucumber extract in a clear gel. Store in the fridge for extra cool.',
    benefits: 'Cooling feel\nFast dry-down\nMakeup compatible',
    howToUse: 'Pat a rice-grain amount around orbital bone AM.',
    suitableFor: 'All skin types',
    tags: ['eye-care', 'gel', 'caffeine'],
    sizes: [{ name: '15ml', usd: 3400, weightGrams: 30 }],
  },
  {
    name: 'Retinol Eye Cream',
    nameAr: 'كريم عين ريتينول',
    nameFr: 'Crème yeux rétinol',
    shortEn: 'Gentle retinal cream for the eye contour at night.',
    shortAr: 'كريم ريتينال لطيف لمحيط العين ليلاً.',
    shortFr: 'Crème rétinal douce pour le contour des yeux.',
    descEn: 'Encapsulated retinal at a beginner strength. Always follow with moisturizer and SPF next day.',
    benefits: 'Night renewal\nCushioned cream\nBeginner-friendly',
    howToUse: 'Pea size, 2–3 nights weekly. Avoid lids.',
    suitableFor: 'Experienced retinoid users; not pregnancy',
    tags: ['eye-care', 'retinol', 'night'],
    sizes: [{ name: '15ml', usd: 4600, weightGrams: 32 }],
  },
  {
    name: 'Golden Face Oil',
    nameAr: 'زيت وجه ذهبي',
    nameFr: 'Huile visage dorée',
    shortEn: 'Dry-touch oil to seal moisturizer with glow.',
    shortAr: 'زيت جاف اللمس يختم المرطب بإشراق.',
    shortFr: 'Huile sèche pour sceller l’hydratant avec éclat.',
    descEn: 'Squalane, jojoba, and a drop of carrot seed. Two drops go far on damp skin.',
    benefits: 'Seal moisture\nSoft glow\nNon-greasy press',
    howToUse: 'Warm 2–3 drops, press over night cream.',
    suitableFor: 'Dry and normal skin',
    tags: ['face-oil', 'glow', 'night'],
    sizes: [{ name: '30ml', usd: 4400, compareUsd: 4900, weightGrams: 50 }],
  },
  {
    name: 'Lactic Glow Peel',
    nameAr: 'تقشير حمض اللاكتيك',
    nameFr: 'Peeling lactique éclat',
    shortEn: 'Leave-on lactic peel for weekly radiance.',
    shortAr: 'تقشير لاكتيك يُترك أسبوعياً للإشراق.',
    shortFr: 'Peeling lactique leave-on pour l’éclat hebdomadaire.',
    descEn: '10% lactic acid with calming panthenol. Start once weekly; build as tolerated.',
    benefits: 'Smooth texture look\nEven tone feel\nRinse optional',
    howToUse: 'Apply thin layer at night, wait 10 min, moisturize. SPF next day.',
    suitableFor: 'Experienced acid users',
    tags: ['exfoliator', 'aha', 'peel'],
    sizes: [{ name: '30ml', usd: 3900, weightGrams: 55 }],
  },
  {
    name: 'Enzyme Soft Polish',
    nameAr: 'تلميع إنزيم ناعم',
    nameFr: 'Polish enzymatique doux',
    shortEn: 'Papaya enzyme polish without grit.',
    shortAr: 'تلميع إنزيم البابايا دون حبيبات.',
    shortFr: 'Polish enzymatique papaye sans grains.',
    descEn: 'A gel polish that buffs dullness with enzymes instead of scrub particles.',
    benefits: 'No microbeads\nGentle renew\nWeekly ritual',
    howToUse: 'Massage 60 seconds on damp face, rinse. 1–2× weekly.',
    suitableFor: 'Sensitive and dry skin',
    tags: ['exfoliator', 'enzyme', 'polish'],
    sizes: [{ name: '75ml', usd: 3100, weightGrams: 95 }],
  },
  {
    name: 'Clay Reset Mask',
    nameAr: 'قناع طين لإعادة الضبط',
    nameFr: 'Masque argile reset',
    shortEn: 'Kaolin mask that clears without over-drying.',
    shortAr: 'قناع كاولين ينظّف دون تجفيف مفرط.',
    shortFr: 'Masque kaolin qui purifie sans trop dessécher.',
    descEn: 'Kaolin and bentonite with aloe. Leave until just matte, not crackled.',
    benefits: 'Pore-clean feel\nOil absorb\nWeekly detox look',
    howToUse: 'Apply thin layer, wait 8–10 min, rinse.',
    suitableFor: 'Combination and oily skin',
    tags: ['mask', 'clay', 'detox'],
    sizes: [{ name: '60ml', usd: 2900, weightGrams: 85 }],
  },
  {
    name: 'Overnight Hydra Sheet',
    nameAr: 'قناع صحيفة ترطيب ليلي',
    nameFr: 'Masque tissu hydra nuit',
    shortEn: 'Sheet mask ritual for thirsty evenings.',
    shortAr: 'طقس قناع صحيفة للأمسيات العطشى.',
    shortFr: 'Rituel masque tissu pour les soirs assoiffés.',
    descEn: 'Hyaluronic sheet saturated with a quiet serum. Use after flights or long days.',
    benefits: 'Instant plump feel\nSingle use\nNo rinse',
    howToUse: 'Apply 15–20 min, massage leftover serum in.',
    suitableFor: 'All skin types',
    tags: ['mask', 'sheet', 'hydrating'],
    sizes: [{ name: '1 sheet', usd: 800, weightGrams: 40 }],
  },
  {
    name: 'Daily Mineral SPF 30',
    nameAr: 'واقي معدني يومي ٣٠',
    nameFr: 'SPF 30 minéral quotidien',
    shortEn: 'Sheer mineral SPF for everyday light.',
    shortAr: 'واقي معدني شفاف لضوء النهار.',
    shortFr: 'SPF minéral transparent pour le quotidien.',
    descEn: 'Zinc-forward mineral protection with a soft finish under makeup.',
    benefits: 'Broad-spectrum SPF 30\nSheer finish\nMakeup-friendly',
    howToUse: 'Last step of morning skincare. Reapply outdoors.',
    suitableFor: 'All skin types',
    tags: ['spf', 'mineral', 'daily'],
    sizes: [{ name: '50ml', usd: 3600, weightGrams: 80 }],
  },
  {
    name: 'Invisible Fluid SPF 50',
    nameAr: 'سائل SPF 50 غير مرئي',
    nameFr: 'Fluide SPF 50 invisible',
    shortEn: 'High SPF hybrid fluid with near-invisible finish.',
    shortAr: 'سائل SPF عالي بلمسة شبه غير مرئية.',
    shortFr: 'Fluide SPF élevé au fini quasi invisible.',
    descEn: 'Chemical-mineral hybrid designed for deeper skin tones and humid days.',
    benefits: 'SPF 50\nLow white cast\nLight texture',
    howToUse: 'Apply generously as last AM step.',
    suitableFor: 'All tones; outdoor days',
    tags: ['spf', 'hybrid', 'high-protection'],
    sizes: [{ name: '40ml', usd: 4200, compareUsd: 4600, weightGrams: 70 }],
  },
  {
    name: 'After-Sun Aloe Mist',
    nameAr: 'رذاذ صبار بعد الشمس',
    nameFr: 'Brume aloe après-soleil',
    shortEn: 'Cooling aloe mist for post-sun evenings.',
    shortAr: 'رذاذ صبار مبرّد لأمسيات بعد الشمس.',
    shortFr: 'Brume aloe rafraîchissante après soleil.',
    descEn: 'Aloe and panthenol mist to comfort warm skin. Keep refrigerated in summer.',
    benefits: 'Cooling comfort\nAlcohol-free\nFamily friendly',
    howToUse: 'Mist freely after sun exposure; follow with body lotion.',
    suitableFor: 'Body and face (avoid eyes)',
    tags: ['spf', 'after-sun', 'aloe'],
    sizes: [{ name: '150ml', usd: 2200, weightGrams: 180 }],
  },
  // 21–40 Makeup face / lips / eyes
  {
    name: 'Soft Focus Primer',
    nameAr: 'برايمر تركيز ناعم',
    nameFr: 'Primer soft focus',
    shortEn: 'Blur primer that grips foundation without chalk.',
    shortAr: 'برايمر يموّه ويمسك الفاونديشن دون طباشير.',
    shortFr: 'Primer floutant qui accroche le fond de teint.',
    descEn: 'Silica-light gel that smooths the look of pores on the T-zone.',
    benefits: 'Blur effect\nLonger wear\nNon-drying',
    howToUse: 'Pea size on T-zone before foundation.',
    suitableFor: 'Combination skin',
    tags: ['makeup', 'primer', 'face'],
    sizes: [{ name: '30ml', usd: 3200, weightGrams: 50 }],
  },
  {
    name: 'Skin Tint Serum Foundation',
    nameAr: 'فاونديشن سيروم خفيف',
    nameFr: 'Fond de teint sérum',
    shortEn: 'Sheer skin tint with skincare slip.',
    shortAr: 'تغطية خفيفة بملمس عناية.',
    shortFr: 'Teinte légère au glissé soin.',
    descEn: 'Buildable sheer coverage with hyaluronic slip. Six everyday shades seeded as variants.',
    benefits: 'Sheer coverage\nSkincare feel\nNatural finish',
    howToUse: 'Dot and blend with fingers or brush.',
    suitableFor: 'Normal to dry skin',
    tags: ['foundation', 'skin-tint', 'sheer'],
    sizes: [
      { name: 'Shade 01 Ivory — 30ml', usd: 3800, weightGrams: 55 },
      { name: 'Shade 03 Sand — 30ml', usd: 3800, weightGrams: 55 },
      { name: 'Shade 05 Amber — 30ml', usd: 3800, weightGrams: 55 },
    ],
  },
  {
    name: 'Velvet Matte Foundation',
    nameAr: 'فاونديشن مات مخملي',
    nameFr: 'Fond de teint mat velours',
    shortEn: 'Medium-full matte that stays soft, not chalky.',
    shortAr: 'تغطية متوسطة كاملة بلمسة مات ناعمة.',
    shortFr: 'Couvrance moyenne-forte mate et douce.',
    descEn: 'Long-wear formula with a soft-focus powder finish for photo days.',
    benefits: 'Medium-full cover\nSoft matte\nTransfer-resistant',
    howToUse: 'Apply with dense brush; set lightly if needed.',
    suitableFor: 'Combination and oily skin',
    tags: ['foundation', 'matte', 'long-wear'],
    sizes: [
      { name: 'Shade 02 Beige — 30ml', usd: 4200, weightGrams: 60 },
      { name: 'Shade 04 Honey — 30ml', usd: 4200, weightGrams: 60 },
    ],
  },
  {
    name: 'Bright Cover Concealer',
    nameAr: 'كونسيلر تغطية مضيئة',
    nameFr: 'Anti-cernes couvrant',
    shortEn: 'Creamy concealer for under-eyes and spots.',
    shortAr: 'كونسيلر كريمي لمحيط العين والبقع.',
    shortFr: 'Anti-cernes crémeux pour cernes et imperfections.',
    descEn: 'Medium coverage that does not settle heavily into fine lines when set lightly.',
    benefits: 'Buildable\nCrease-resistant\nHydrating slip',
    howToUse: 'Dot, blend, set with translucent powder.',
    suitableFor: 'All skin types',
    tags: ['concealer', 'coverage', 'under-eye'],
    sizes: [
      { name: 'Fair — 6ml', usd: 2600, weightGrams: 20 },
      { name: 'Medium — 6ml', usd: 2600, weightGrams: 20 },
    ],
  },
  {
    name: 'Cheek Dust Blush',
    nameAr: 'بلاش بودرة للخدود',
    nameFr: 'Blush poudre joues',
    shortEn: 'Buildable powder blush with a soft satin.',
    shortAr: 'بلاش بودرة قابل للبناء بساتان ناعم.',
    shortFr: 'Blush poudre modulable au satin doux.',
    descEn: 'Finely milled pigment for a flushed, lived-in cheek.',
    benefits: 'Buildable color\nSoft satin\nEasy blend',
    howToUse: 'Sweep on apples of cheeks toward temples.',
    suitableFor: 'All skin tones (shade variants)',
    tags: ['blush', 'powder', 'cheeks'],
    sizes: [
      { name: 'Petal', usd: 2800, weightGrams: 25 },
      { name: 'Terracotta', usd: 2800, weightGrams: 25 },
    ],
  },
  {
    name: 'Warm Contour Bronzer',
    nameAr: 'برونزر كنتور دافئ',
    nameFr: 'Bronzer contour chaud',
    shortEn: 'Matte bronzer for soft facial contour.',
    shortAr: 'برونزر مات لكنتور وجه ناعم.',
    shortFr: 'Bronzer mat pour un contour doux.',
    descEn: 'Cool-neutral matte for sculpting without orange cast.',
    benefits: 'Matte contour\nBlendable\nPhoto friendly',
    howToUse: 'Dust under cheekbones and along hairline.',
    suitableFor: 'Light to deep tones',
    tags: ['bronzer', 'contour', 'matte'],
    sizes: [{ name: '8g', usd: 3000, weightGrams: 30 }],
  },
  {
    name: 'Liquid Light Highlighter',
    nameAr: 'هايلايتر سائل مضيء',
    nameFr: 'Enlumineur liquide',
    shortEn: 'Liquid highlighter for cheekbones and brow bone.',
    shortAr: 'هايلايتر سائل لعظام الخد والحاجب.',
    shortFr: 'Enlumineur liquide pour pommettes et arc sourcilier.',
    descEn: 'Fine pearl (not chunky glitter) that layers over cream or powder.',
    benefits: 'Natural glow\nBlendable\nMixable with foundation',
    howToUse: 'Dab on high points; blend with sponge.',
    suitableFor: 'All skin types',
    tags: ['highlighter', 'glow', 'liquid'],
    sizes: [{ name: '15ml', usd: 2700, weightGrams: 35 }],
  },
  {
    name: 'Satin Lip Color',
    nameAr: 'لون شفاه ساتان',
    nameFr: 'Rouge à lèvres satin',
    shortEn: 'Comfort satin lipstick with true color pay-off.',
    shortAr: 'أحمر ساتان مريح بلون صادق.',
    shortFr: 'Rouge satin confortable à la vraie couleur.',
    descEn: 'One-swipe pigment with a conditioned feel — not drying matte.',
    benefits: 'True color\nComfort wear\nEasy reapply',
    howToUse: 'Apply directly or with lip brush.',
    suitableFor: 'All lips',
    tags: ['lipstick', 'satin', 'color'],
    sizes: [
      { name: 'Rosewood', usd: 2400, weightGrams: 15 },
      { name: 'Berry', usd: 2400, weightGrams: 15 },
      { name: 'Nude', usd: 2400, weightGrams: 15 },
    ],
  },
  {
    name: 'Soft Matte Liquid Lip',
    nameAr: 'سائل شفاه مات ناعم',
    nameFr: 'Rouge liquide mat doux',
    shortEn: 'Transfer-resistant liquid lip without crackle.',
    shortAr: 'سائل مقاوم للنقل دون تشقق.',
    shortFr: 'Liquide longue tenue sans craquelures.',
    descEn: 'Weightless matte that sets in 60 seconds. Exfoliate lips first.',
    benefits: 'Long wear\nSoft matte\nPrecise applicator',
    howToUse: 'Outline then fill; avoid oily foods for first hour.',
    suitableFor: 'All lips',
    tags: ['lipstick', 'matte', 'liquid'],
    sizes: [
      { name: 'Fig', usd: 2500, weightGrams: 18 },
      { name: 'Brick', usd: 2500, weightGrams: 18 },
    ],
  },
  {
    name: 'Glass Lip Gloss',
    nameAr: 'ملمع شفاه زجاجي',
    nameFr: 'Gloss effet verre',
    shortEn: 'Non-sticky gloss with a glass-like shine.',
    shortAr: 'ملمع غير لزج بلمعان زجاجي.',
    shortFr: 'Gloss non collant à l’éclat verre.',
    descEn: 'Clear or tinted shine that layers over lipstick or alone.',
    benefits: 'High shine\nNon-sticky\nPlush feel',
    howToUse: 'Swipe center of lips outward.',
    suitableFor: 'All lips',
    tags: ['lip-gloss', 'shine', 'clear'],
    sizes: [
      { name: 'Clear', usd: 1800, weightGrams: 16 },
      { name: 'Rose Tint', usd: 1800, weightGrams: 16 },
    ],
  },
  {
    name: 'Volume Lift Mascara',
    nameAr: 'ماسكارا كثافة ورفع',
    nameFr: 'Mascara volume lift',
    shortEn: 'Buildable volume mascara with a flexible brush.',
    shortAr: 'ماسكارا كثافة بفرشاة مرنة.',
    shortFr: 'Mascara volume au pinceau flexible.',
    descEn: 'Smudge-resistant formula that lifts without spider legs when applied in thin coats.',
    benefits: 'Buildable volume\nFlexible hold\nEasy remove with balm',
    howToUse: 'Wiggle from root to tip; second coat after 20 sec.',
    suitableFor: 'All lash types',
    tags: ['mascara', 'volume', 'eyes'],
    sizes: [{ name: '9ml', usd: 2600, weightGrams: 25 }],
  },
  {
    name: 'Length Serum Mascara',
    nameAr: 'ماسكارا سيروم للطول',
    nameFr: 'Mascara sérum allongeant',
    shortEn: 'Length-focused mascara with conditioning fibers.',
    shortAr: 'ماسكارا طول مع ألياف مغذية.',
    shortFr: 'Mascara allongeant aux fibres conditionnantes.',
    descEn: 'Defines and lengthens with a slim brush for lower lashes too.',
    benefits: 'Length\nDefinition\nDay-to-night',
    howToUse: 'One coat for day; two for evening.',
    suitableFor: 'Straight and fine lashes',
    tags: ['mascara', 'length', 'eyes'],
    sizes: [{ name: '8ml', usd: 2500, weightGrams: 24 }],
  },
  {
    name: 'Neutrals Eye Palette',
    nameAr: 'باليت عيون محايدة',
    nameFr: 'Palette yeux neutres',
    shortEn: 'Twelve wearable neutrals from matte to soft shimmer.',
    shortAr: 'اثنا عشر لوناً محايداً من مات إلى لامع ناعم.',
    shortFr: 'Douze neutres portables du mat au shimmer doux.',
    descEn: 'Editorial neutrals for soft day looks and smoked evenings.',
    benefits: 'Blendable\nLow fallout\nDay-to-night',
    howToUse: 'Prime lid, pack color with flat brush, blend edges.',
    suitableFor: 'All eye colors',
    tags: ['eyeshadow', 'palette', 'neutrals'],
    sizes: [{ name: '12 shades', usd: 4800, compareUsd: 5400, weightGrams: 90 }],
  },
  {
    name: 'Cream Shadow Stick',
    nameAr: 'قلم ظل كريمي',
    nameFr: 'Stick fard crème',
    shortEn: 'One-and-done cream shadow stick.',
    shortAr: 'قلم ظل كريمي بخطوة واحدة.',
    shortFr: 'Stick crème fard en un geste.',
    descEn: 'Twist-up cream that sets softly — no brush required.',
    benefits: 'Quick application\nCrease-resistant\nTravel ready',
    howToUse: 'Swipe on lid, blend with fingertip.',
    suitableFor: 'Beginners and travel kits',
    tags: ['eyeshadow', 'cream', 'stick'],
    sizes: [
      { name: 'Champagne', usd: 2200, weightGrams: 18 },
      { name: 'Bronze', usd: 2200, weightGrams: 18 },
    ],
  },
  {
    name: 'Precision Gel Liner',
    nameAr: 'آيلاينر جل دقيق',
    nameFr: 'Eyeliner gel précision',
    shortEn: 'Pot gel liner with a sharp, lasting line.',
    shortAr: 'آيلاينر جل بخط حاد يدوم.',
    shortFr: 'Gel pot pour un trait net et durable.',
    descEn: 'Waterproof-leaning gel that stays put through heat.',
    benefits: 'Intense black\nSmudge control\nPrecise',
    howToUse: 'Use angled brush; set with matching shadow if desired.',
    suitableFor: 'All eye shapes',
    tags: ['eyeliner', 'gel', 'waterproof'],
    sizes: [{ name: '5g', usd: 2100, weightGrams: 20 }],
  },
  {
    name: 'Brow Architecture Pencil',
    nameAr: 'قلم هندسة الحواجب',
    nameFr: 'Crayon architecture sourcils',
    shortEn: 'Ultra-fine pencil for hair-like strokes.',
    shortAr: 'قلم فائق الدقة لخطوط تشبه الشعر.',
    shortFr: 'Crayon ultra-fin pour traits poil à poil.',
    descEn: 'Spoolie on one end, micro tip on the other for natural brows.',
    benefits: 'Hair-like strokes\nBuildable\nSpoolie included',
    howToUse: 'Brush up, fill sparse areas with light strokes.',
    suitableFor: 'Sparse to full brows',
    tags: ['brows', 'pencil', 'natural'],
    sizes: [
      { name: 'Soft Brown', usd: 2000, weightGrams: 12 },
      { name: 'Ash', usd: 2000, weightGrams: 12 },
    ],
  },
  {
    name: 'Clear Brow Hold Gel',
    nameAr: 'جل تثبيت حواجب شفاف',
    nameFr: 'Gel sourcils transparent',
    shortEn: 'Clear gel that lifts and holds brow hairs.',
    shortAr: 'جل شفاف يرفع ويثبّت شعر الحاجب.',
    shortFr: 'Gel transparent qui soulève et tient.',
    descEn: 'Flexible hold without crunch or white flakes.',
    benefits: 'Lift & hold\nFlake-free\nWorks over pencil',
    howToUse: 'Brush upward through brows as last step.',
    suitableFor: 'All brows',
    tags: ['brows', 'gel', 'hold'],
    sizes: [{ name: '8ml', usd: 1600, weightGrams: 22 }],
  },
  {
    name: 'Lash Serum Primer',
    nameAr: 'برايمر سيروم رموش',
    nameFr: 'Primer sérum cils',
    shortEn: 'White lash primer that boosts mascara volume.',
    shortAr: 'برايمر أبيض يعزّز كثافة الماسكارا.',
    shortFr: 'Primer blanc qui booste le volume mascara.',
    descEn: 'Conditioning primer worn under mascara for thicker-looking lashes.',
    benefits: 'Volume boost\nConditioning\nDaywear',
    howToUse: 'Coat lashes, wait 30 sec, apply mascara.',
    suitableFor: 'Fine lashes',
    tags: ['mascara', 'primer', 'lashes'],
    sizes: [{ name: '8ml', usd: 2300, weightGrams: 22 }],
  },
  {
    name: 'Setting Spray Soft Hold',
    nameAr: 'بخاخ تثبيت ناعم',
    nameFr: 'Spray fixateur tenue douce',
    shortEn: 'Fine mist setting spray for all-day makeup.',
    shortAr: 'رذاذ ناعم لتثبيت المكياج طوال اليوم.',
    shortFr: 'Brume fine pour fixer le maquillage.',
    descEn: 'Alcohol-light mist that melts powder into skin without stiffness.',
    benefits: 'Locks makeup\nDewy-natural\nRefresh midday',
    howToUse: 'Mist in X and T motions after makeup.',
    suitableFor: 'All skin types',
    tags: ['makeup', 'setting-spray', 'long-wear'],
    sizes: [{ name: '100ml', usd: 2800, weightGrams: 130 }],
  },
  // 41–60 Hair / fragrance / body
  {
    name: 'Balance Shampoo',
    nameAr: 'شامبو توازن',
    nameFr: 'Shampoing équilibre',
    shortEn: 'Everyday shampoo that cleans without stripping color.',
    shortAr: 'شامبو يومي ينظّف دون سحب اللون.',
    shortFr: 'Shampoing quotidien qui lave sans délaver.',
    descEn: 'Sulfate-free cleanse with a soft herbal scent. Safe for color-treated hair.',
    benefits: 'Color-safe\nScalp fresh\nDaily use',
    howToUse: 'Massage into wet hair, rinse. Follow with conditioner.',
    suitableFor: 'All hair types',
    tags: ['shampoo', 'hair', 'daily'],
    sizes: [
      { name: '250ml', usd: 2400, weightGrams: 280 },
      { name: '500ml', usd: 3800, weightGrams: 540 },
    ],
  },
  {
    name: 'Moisture Conditioner',
    nameAr: 'بلسم ترطيب',
    nameFr: 'Après-shampoing hydratant',
    shortEn: 'Cream conditioner that detangles in one pass.',
    shortAr: 'بلسم كريمي يفك التشابك بتمريرة واحدة.',
    shortFr: 'Après-shampoing crème démêlant en un passage.',
    descEn: 'Shea and rice protein for slip without weighing fine hair down when rinsed well.',
    benefits: 'Detangle\nSoft finish\nRinse clean',
    howToUse: 'Apply mid-lengths to ends, 1–2 min, rinse.',
    suitableFor: 'Dry and damaged hair',
    tags: ['conditioner', 'hair', 'hydrating'],
    sizes: [
      { name: '250ml', usd: 2400, weightGrams: 280 },
      { name: '500ml', usd: 3800, weightGrams: 540 },
    ],
  },
  {
    name: 'Repair Hair Mask',
    nameAr: 'قناع إصلاح الشعر',
    nameFr: 'Masque réparation cheveux',
    shortEn: 'Weekly mask for heat-styled and colored hair.',
    shortAr: 'قناع أسبوعي للشعر المصبوغ والمعرّض للحرارة.',
    shortFr: 'Masque hebdomadaire pour cheveux chauffés et colorés.',
    descEn: 'Bond-supporting mask that restores softness after bleaching or frequent hot tools.',
    benefits: 'Deep repair feel\nWeekly ritual\nHeat recovery',
    howToUse: 'After shampoo, leave 5–10 min under warmth if possible, rinse.',
    suitableFor: 'Damaged and color-treated hair',
    tags: ['hair-treatment', 'mask', 'repair'],
    sizes: [{ name: '200ml', usd: 3600, compareUsd: 4000, weightGrams: 230 }],
  },
  {
    name: 'Scalp Calm Serum',
    nameAr: 'سيروم تهدئة فروة الرأس',
    nameFr: 'Sérum apaisant cuir chevelu',
    shortEn: 'Leave-on scalp serum for itch and tightness feel.',
    shortAr: 'سيروم يُترك لفروة الرأس ضد الحكة والضيق.',
    shortFr: 'Sérum leave-on pour démangeaisons et tension.',
    descEn: 'Tea tree and panthenol in a light dropper fluid. Part hair and apply to scalp only.',
    benefits: 'Scalp comfort\nNon-greasy\nNight or AM',
    howToUse: '3–4 drops per section on clean scalp, massage.',
    suitableFor: 'Sensitive scalps',
    tags: ['hair-treatment', 'scalp', 'serum'],
    sizes: [{ name: '50ml', usd: 3400, weightGrams: 70 }],
  },
  {
    name: 'Heat Shield Spray',
    nameAr: 'بخاخ حماية حرارية',
    nameFr: 'Spray thermo-protecteur',
    shortEn: 'Thermal protectant before blow-dry and irons.',
    shortAr: 'حماية حرارية قبل التسريح والمكواة.',
    shortFr: 'Protection thermique avant brushing et fer.',
    descEn: 'Mist that cushions hair from heat up to styling temps while adding light hold.',
    benefits: 'Heat buffer\nLight hold\nNo crunch',
    howToUse: 'Spray on damp hair before heat styling.',
    suitableFor: 'All hair types',
    tags: ['styling', 'heat-protect', 'spray'],
    sizes: [{ name: '150ml', usd: 2600, weightGrams: 180 }],
  },
  {
    name: 'Texture Sea Salt Spray',
    nameAr: 'بخاخ ملح البحر',
    nameFr: 'Spray sel de mer',
    shortEn: 'Beach texture spray for undone waves.',
    shortAr: 'بخاخ ملمس شاطئي للموجات العفوية.',
    shortFr: 'Spray texture plage pour ondulations décoiffées.',
    descEn: 'Salt and light polymer for piecey texture without crunchy helmet hair.',
    benefits: 'Tousled texture\nMatte finish\nRestyle next day',
    howToUse: 'Mist damp or dry hair, scrunch, air dry or diffuse.',
    suitableFor: 'Fine to medium hair',
    tags: ['styling', 'texture', 'salt'],
    sizes: [{ name: '150ml', usd: 2200, weightGrams: 175 }],
  },
  {
    name: 'Ambre Nuit Eau de Parfum',
    nameAr: 'عطر أمبر نوي',
    nameFr: 'Eau de parfum Ambre Nuit',
    shortEn: 'Warm amber, vanilla wood, and soft musk.',
    shortAr: 'عنبر دافئ وخشب فانيليا ومسك ناعم.',
    shortFr: 'Ambre chaud, bois vanillé et musc doux.',
    descEn: 'An evening signature with a smooth dry-down that lasts through dinner.',
    benefits: 'Long wear\nWarm trail\nUnisex leaning',
    howToUse: 'Spray pulse points; do not rub.',
    suitableFor: 'Evening and cooler months',
    tags: ['perfume', 'amber', 'fragrance'],
    sizes: [
      { name: '30ml', usd: 6800, weightGrams: 120 },
      { name: '50ml', usd: 9800, compareUsd: 10800, weightGrams: 180 },
    ],
  },
  {
    name: 'Citrus Grove EDT',
    nameAr: 'عطر حمضيات EDT',
    nameFr: 'EDT Citrus Grove',
    shortEn: 'Bright bergamot and green leaf for daytime.',
    shortAr: 'برغموت مشرق وورق أخضر للنهار.',
    shortFr: 'Bergamote vive et feuille verte pour le jour.',
    descEn: 'A clean citrus open that softens into white musk — office and weekend friendly.',
    benefits: 'Fresh open\nLight trail\nDaytime',
    howToUse: '2–3 sprays on neck and wrists.',
    suitableFor: 'Warm weather and workdays',
    tags: ['perfume', 'citrus', 'day'],
    sizes: [{ name: '50ml', usd: 7200, weightGrams: 170 }],
  },
  {
    name: 'Soft Petal Body Mist',
    nameAr: 'رذاذ جسم بتلات ناعمة',
    nameFr: 'Brume corps soft petal',
    shortEn: 'Light floral body mist for after shower.',
    shortAr: 'رذاذ زهور خفيف بعد الاستحمام.',
    shortFr: 'Brume florale légère après la douche.',
    descEn: 'Peony and soft musk mist — reapply freely through the day.',
    benefits: 'Soft scent\nAlcohol-light\nLayerable',
    howToUse: 'Mist body and hair from 20 cm.',
    suitableFor: 'All skin; sensitive-friendly',
    tags: ['body-fragrance', 'mist', 'floral'],
    sizes: [{ name: '150ml', usd: 2800, weightGrams: 180 }],
  },
  {
    name: 'Nourishing Body Oil',
    nameAr: 'زيت جسم مغذٍ',
    nameFr: 'Huile corps nourrissante',
    shortEn: 'Fast-absorb body oil for post-bath glow.',
    shortAr: 'زيت جسم سريع الامتصاص بعد الحمام.',
    shortFr: 'Huile corps à absorption rapide après le bain.',
    descEn: 'Apricot and almond oils with vitamin E. Apply on damp skin for best slip.',
    benefits: 'Glow finish\nNon-greasy press\nMassage friendly',
    howToUse: 'Warm in hands, press onto damp body.',
    suitableFor: 'Dry body skin',
    tags: ['body-care', 'oil', 'hydrating'],
    sizes: [{ name: '100ml', usd: 3200, weightGrams: 120 }],
  },
  {
    name: 'Silk Body Lotion',
    nameAr: 'لوشن جسم حريري',
    nameFr: 'Lotion corps soyeuse',
    shortEn: 'Daily lotion that softens without heaviness.',
    shortAr: 'لوشن يومي ينعم دون ثقل.',
    shortFr: 'Lotion quotidienne qui adoucit sans lourdeur.',
    descEn: 'Quiet floral scent, quick absorb — layers under clothes cleanly.',
    benefits: 'All-day soft\nNon-greasy\nMorning & night',
    howToUse: 'Apply after bathing to clean dry skin.',
    suitableFor: 'Normal to dry skin',
    tags: ['body-care', 'lotion', 'hydrating'],
    sizes: [
      { name: '250ml', usd: 2800, compareUsd: 3200, weightGrams: 280 },
      { name: '500ml', usd: 4200, weightGrams: 540 },
    ],
  },
  {
    name: 'Cream Body Wash',
    nameAr: 'غسول جسم كريمي',
    nameFr: 'Gel douche crémeux',
    shortEn: 'Cream wash that cleanses without squeaky dryness.',
    shortAr: 'غسول كريمي ينظّف دون جفاف مزعج.',
    shortFr: 'Gel crémeux qui lave sans sécheresse.',
    descEn: 'Mild surfactants with glycerin for daily showers in dry seasons.',
    benefits: 'Gentle cleanse\nSoft foam\nFamily friendly',
    howToUse: 'Lather with hands or mitt, rinse.',
    suitableFor: 'All body skin',
    tags: ['bath-shower', 'wash', 'hydrating'],
    sizes: [{ name: '300ml', usd: 2000, weightGrams: 340 }],
  },
  {
    name: 'Sugar Body Polish',
    nameAr: 'تلميع جسم بالسكر',
    nameFr: 'Gommage corps sucre',
    shortEn: 'Fine sugar scrub for smoother-feeling skin.',
    shortAr: 'مقشر سكر ناعم لبشرة أنعم.',
    shortFr: 'Gommage sucre fin pour une peau plus douce.',
    descEn: 'Cane sugar in a nourishing oil base — rinse thoroughly; tub may be slick.',
    benefits: 'Smooth feel\nOil glow\nWeekly ritual',
    howToUse: 'Massage on damp skin in shower, rinse. 1–2× weekly.',
    suitableFor: 'Rough elbows, legs, arms',
    tags: ['bath-shower', 'scrub', 'exfoliating'],
    sizes: [{ name: '200ml', usd: 2600, weightGrams: 240 }],
  },
  {
    name: 'Hand Rescue Cream',
    nameAr: 'كريم إنقاذ اليدين',
    nameFr: 'Crème mains rescue',
    shortEn: 'Rich hand cream that absorbs before you type.',
    shortAr: 'كريم يدين غني يمتص قبل الكتابة.',
    shortFr: 'Crème mains riche qui pénètre avant de taper.',
    descEn: 'Shea and ceramides for washed-hands dryness. Unscented option for clinics.',
    benefits: 'Fast absorb\nBarrier support\nPurse size',
    howToUse: 'Apply after each wash; focus on cuticles.',
    suitableFor: 'Dry and cracked hands',
    tags: ['hand-care', 'cream', 'barrier'],
    sizes: [
      { name: '50ml', usd: 1600, weightGrams: 70 },
      { name: '100ml', usd: 2400, weightGrams: 120 },
    ],
  },
  {
    name: 'Cuticle Conditioning Oil',
    nameAr: 'زيت تغذية الجلد حول الظفر',
    nameFr: 'Huile cuticules',
    shortEn: 'Dropper oil for soft cuticles and shine.',
    shortAr: 'زيت قطّارة لجلد ناعم ولمعان.',
    shortFr: 'Huile pipette pour cuticules douces et brillant.',
    descEn: 'Jojoba and vitamin E — nightly habit before bed.',
    benefits: 'Soft cuticles\nNail shine\nNight ritual',
    howToUse: '1 drop per nail, massage in.',
    suitableFor: 'Dry cuticles',
    tags: ['nail-care', 'oil', 'cuticle'],
    sizes: [{ name: '15ml', usd: 1400, weightGrams: 25 }],
  },
  {
    name: 'Strength Base Coat',
    nameAr: 'طلاء أساس مقوّي',
    nameFr: 'Base fortifiante',
    shortEn: 'Ridge-filling base that strengthens the look of nails.',
    shortAr: 'أساس يملأ الخطوط ويقوّي مظهر الأظافر.',
    shortFr: 'Base lissante qui fortifie l’aspect des ongles.',
    descEn: 'Wear alone for a natural finish or under color polish.',
    benefits: 'Smooth canvas\nChip buffer\nClear finish',
    howToUse: 'One thin coat; dry 2 min before color.',
    suitableFor: 'Brittle and ridged nails',
    tags: ['nail-care', 'base', 'strengthen'],
    sizes: [{ name: '12ml', usd: 1500, weightGrams: 30 }],
  },
  {
    name: 'Sheer Nude Polish',
    nameAr: 'طلاء شفاف بيج',
    nameFr: 'Vernis nude transparent',
    shortEn: 'Clean sheer nude for everyday nails.',
    shortAr: 'بيج شفاف نظيف للأظافر اليومية.',
    shortFr: 'Nude transparent pour ongles du quotidien.',
    descEn: 'Buildable sheer that looks polished in one or two coats.',
    benefits: 'Office friendly\nEasy remove\nChip resistant',
    howToUse: 'Base, 1–2 color coats, top coat.',
    suitableFor: 'All nail lengths',
    tags: ['nail-care', 'polish', 'nude'],
    sizes: [{ name: '12ml', usd: 1600, weightGrams: 30 }],
  },
  {
    name: 'High Shine Top Coat',
    nameAr: 'طلاء علوي لامع',
    nameFr: 'Top coat ultra brillant',
    shortEn: 'Glossy top coat that seals color for days.',
    shortAr: 'طلاء علوي يلمع ويثبّت اللون لأيام.',
    shortFr: 'Top coat brillant qui scelle la couleur.',
    descEn: 'Quick-dry formula that resists dulling from hand washing.',
    benefits: 'High gloss\nQuick dry\nExtends wear',
    howToUse: 'Cap color with one even coat; reapply day 3.',
    suitableFor: 'Over any polish',
    tags: ['nail-care', 'top-coat', 'shine'],
    sizes: [{ name: '12ml', usd: 1500, weightGrams: 30 }],
  },
  {
    name: 'Bath Oil Soak',
    nameAr: 'زيت نقع الحمام',
    nameFr: 'Huile de bain',
    shortEn: 'Dispersing bath oil for a calm evening soak.',
    shortAr: 'زيت حمام يتوزع لنقع مسائي هادئ.',
    shortFr: 'Huile dispersible pour un bain du soir calme.',
    descEn: 'Lavender-soft scent that milks into warm water without leaving a slick ring when dosed lightly.',
    benefits: 'Evening ritual\nSkin soft\nCalm scent',
    howToUse: '5–8 drops in running bath water.',
    suitableFor: 'Adults; patch test',
    tags: ['bath-shower', 'oil', 'relax'],
    sizes: [{ name: '100ml', usd: 3000, weightGrams: 120 }],
  },
  {
    name: 'Travel Mini Cleanser',
    nameAr: 'منظف ميني للسفر',
    nameFr: 'Nettoyant mini voyage',
    shortEn: 'Cabin-friendly cleanser mini for weekenders.',
    shortAr: 'منظف ميني مناسب للكابينة لعطلة قصيرة.',
    shortFr: 'Mini nettoyant cabine pour week-ends.',
    descEn: 'Same formula as the Cloud Cream Cleanser in a TSA-ready tube.',
    benefits: 'Travel size\nLeak-resistant tube\nFull formula',
    howToUse: 'As daily cleanser while traveling.',
    suitableFor: 'All skin types',
    tags: ['travel', 'cleanser', 'mini'],
    sizes: [{ name: '50ml', usd: 1400, weightGrams: 65 }],
  },
  // 61–80 Tools / mens / clean / seasonal / more skincare
  {
    name: 'Dual Fiber Foundation Brush',
    nameAr: 'فرشاة فاونديشن ثنائية الألياف',
    nameFr: 'Pinceau fond de teint duo fibre',
    shortEn: 'Duo-fiber brush for sheer, streak-free base.',
    shortAr: 'فرشاة ثنائية لأساس شفاف بلا خطوط.',
    shortFr: 'Pinceau duo fibre pour un teint sans traces.',
    descEn: 'Hand-cut fibers that buff liquid and cream foundation evenly.',
    benefits: 'Streak-free\nEasy clean\nVegan fibers',
    howToUse: 'Dot product, buff in circular motions.',
    suitableFor: 'Liquid and cream bases',
    tags: ['tools', 'brush', 'foundation'],
    sizes: [{ name: '1 brush', usd: 3200, weightGrams: 40 }],
  },
  {
    name: 'Precision Blending Sponge',
    nameAr: 'إسفنجة دمج دقيقة',
    nameFr: 'Éponge de fondue précision',
    shortEn: 'Latex-free sponge for damp blending.',
    shortAr: 'إسفنجة بلا لاتكس للدمج الرطب.',
    shortFr: 'Éponge sans latex pour fondre humide.',
    descEn: 'Expands when wet for a skin-like finish on concealer and foundation.',
    benefits: 'Bounce blend\nLatex-free\nWashable',
    howToUse: 'Wet, squeeze, bounce product into skin.',
    suitableFor: 'All formulas',
    tags: ['tools', 'sponge', 'blend'],
    sizes: [{ name: '1 sponge', usd: 1600, weightGrams: 20 }],
  },
  {
    name: 'Brow Spoolie Duo',
    nameAr: 'ثنائي فرشاة حاجب',
    nameFr: 'Duo goupillon sourcils',
    shortEn: 'Two spoolies for grooming and gel application.',
    shortAr: 'فرشتان لتهذيب الحاجب ووضع الجل.',
    shortFr: 'Deux goupillons pour coiffer et poser le gel.',
    descEn: 'Replaceable heads that stay dense wash after wash.',
    benefits: 'Reusable\nDense bristles\nTravel pouch',
    howToUse: 'Brush brows up before and after product.',
    suitableFor: 'All brows',
    tags: ['tools', 'brows', 'spoolie'],
    sizes: [{ name: '2 pack', usd: 1200, weightGrams: 15 }],
  },
  {
    name: 'Facial Roller Jade',
    nameAr: 'رولر وجه يشب',
    nameFr: 'Roller visage jade',
    shortEn: 'Cool jade roller for morning depuffing ritual.',
    shortAr: 'رولر يشب مبرّد لطقس صباحي.',
    shortFr: 'Roller jade frais pour le rituel du matin.',
    descEn: 'Store in the fridge; roll outward from center of face over serum.',
    benefits: 'Cooling ritual\nProduct press\nGift ready',
    howToUse: 'Clean face, apply serum, roll gently 3–5 min.',
    suitableFor: 'All skin; avoid broken skin',
    tags: ['tools', 'roller', 'ritual'],
    sizes: [{ name: '1 roller', usd: 2800, weightGrams: 120 }],
  },
  {
    name: 'Oak Face Wash',
    nameAr: 'غسول وجه أوك',
    nameFr: 'Nettoyant visage Oak',
    shortEn: 'Straightforward gel wash for men’s daily face.',
    shortAr: 'غسول جل مباشر لوجه الرجل يومياً.',
    shortFr: 'Gel nettoyant simple pour le visage homme.',
    descEn: 'Clears oil and city dust without a tight after-feel. Menthol-light.',
    benefits: 'Fresh cleanse\nNon-stripping\nAM/PM',
    howToUse: 'Lather, rinse, pat dry. Follow with moisturizer.',
    suitableFor: 'Normal to oily men’s skin',
    tags: ['mens', 'cleanser', 'face'],
    sizes: [{ name: '150ml', usd: 2200, weightGrams: 180 }],
  },
  {
    name: 'Post-Shave Balm',
    nameAr: 'بلسم بعد الحلاقة',
    nameFr: 'Baume après-rasage',
    shortEn: 'Alcohol-free balm that calms after the razor.',
    shortAr: 'بلسم بلا كحول يهدّئ بعد الحلاقة.',
    shortFr: 'Baume sans alcool qui apaise après le rasoir.',
    descEn: 'Panthenol and allantoin for razor-red comfort without sting.',
    benefits: 'No alcohol burn\nSoft finish\nQuick absorb',
    howToUse: 'Apply to clean-shaven face and neck.',
    suitableFor: 'Sensitive shave areas',
    tags: ['mens', 'shave', 'balm'],
    sizes: [{ name: '100ml', usd: 2600, weightGrams: 120 }],
  },
  {
    name: 'Beard Conditioning Oil',
    nameAr: 'زيت تغذية اللحية',
    nameFr: 'Huile soin barbe',
    shortEn: 'Light oil for soft beard and comfortable skin underneath.',
    shortAr: 'زيت خفيف للحية ناعمة وبشرة مريحة تحتها.',
    shortFr: 'Huile légère pour barbe douce et peau confortable.',
    descEn: 'Argan and jojoba with a woodsy scent that stays close to the skin.',
    benefits: 'Soft beard\nSkin comfort\nLight scent',
    howToUse: '3–5 drops through damp beard, comb through.',
    suitableFor: 'Short to full beards',
    tags: ['mens', 'beard', 'oil'],
    sizes: [{ name: '30ml', usd: 2800, weightGrams: 50 }],
  },
  {
    name: 'Clean Sheet Mist Toner',
    nameAr: 'تونر رذاذ قائمة نظيفة',
    nameFr: 'Tonique brume clean',
    shortEn: 'Short-ingredient mist for clean beauty routines.',
    shortAr: 'رذاذ بمكونات قليلة لروتين جمال نظيف.',
    shortFr: 'Brume à liste courte pour routines clean.',
    descEn: 'Water, glycerin, rose — nothing else. For ingredient-minimalists.',
    benefits: 'Short INCI\nSensitive friendly\nDaily mist',
    howToUse: 'Mist after cleanse; follow with serum.',
    suitableFor: 'Reactive and clean-beauty shoppers',
    tags: ['clean-beauty', 'toner', 'minimal'],
    sizes: [{ name: '100ml', usd: 2400, weightGrams: 120 }],
  },
  {
    name: 'Plant Ceramide Cream',
    nameAr: 'كريم سيراميد نباتي',
    nameFr: 'Crème céramides végétales',
    shortEn: 'Plant-derived ceramides for barrier-first moisturizing.',
    shortAr: 'سيراميد نباتي لترطيب يبدأ بالحاجز.',
    shortFr: 'Céramides végétales pour hydrater la barrière.',
    descEn: 'Fragrance-free cream with a clean INCI and opaque jar to protect actives.',
    benefits: 'Barrier repair feel\nFragrance-free\nNight or day',
    howToUse: 'Apply after treatment serums.',
    suitableFor: 'Sensitive and dry skin',
    tags: ['clean-beauty', 'moisturizer', 'ceramides'],
    sizes: [{ name: '50ml', usd: 4200, weightGrams: 90 }],
  },
  {
    name: 'Seasonal Spiced Body Cream',
    nameAr: 'كريم جسم متبل موسمي',
    nameFr: 'Crème corps épicée saison',
    shortEn: 'Limited winter cream with soft spice notes.',
    shortAr: 'كريم شتوي محدود بنفحات بهارات ناعمة.',
    shortFr: 'Crème hiver limitée aux notes épicées douces.',
    descEn: 'Richer than the daily lotion — made for heated indoor air.',
    benefits: 'Seasonal scent\nRich comfort\nLimited batch',
    howToUse: 'Apply after shower on dry limbs.',
    suitableFor: 'Dry winter skin',
    tags: ['seasonal', 'body-care', 'limited'],
    sizes: [{ name: '200ml', usd: 3400, compareUsd: 3800, weightGrams: 230 }],
  },
  {
    name: 'Summer Glow Oil Drops',
    nameAr: 'قطرات زيت توهج صيفي',
    nameFr: 'Gouttes huile glow été',
    shortEn: 'Mixable glow drops for limbs and décolleté.',
    shortAr: 'قطرات توهج تُخلط للجسم والصدر.',
    shortFr: 'Gouttes éclat à mélanger corps et décolleté.',
    descEn: 'Fine gold pearl in a dry oil — mix into lotion or wear alone.',
    benefits: 'Custom glow\nMixable\nSummer edit',
    howToUse: '1–2 drops into body lotion or tap on high points.',
    suitableFor: 'All skin tones',
    tags: ['seasonal', 'glow', 'body'],
    sizes: [{ name: '20ml', usd: 3000, weightGrams: 40 }],
  },
  {
    name: 'Hydra Capsule Serum',
    nameAr: 'سيروم كبسولات ترطيب',
    nameFr: 'Sérum capsules hydra',
    shortEn: 'Single-dose hydrating capsules for travel hygiene.',
    shortAr: 'كبسولات ترطيب بجرعة واحدة لنظافة السفر.',
    shortFr: 'Capsules hydratantes monodose pour le voyage.',
    descEn: 'Twist-open capsules keep actives fresh — seven nights per sleeve.',
    benefits: 'Fresh dose\nTravel hygienic\nNo jar dip',
    howToUse: 'Twist, apply to face at night, discard shell.',
    suitableFor: 'Travelers; all skin',
    tags: ['travel', 'serum', 'hydrating'],
    sizes: [{ name: '7 capsules', usd: 3600, weightGrams: 45 }],
  },
  {
    name: 'Overnight Lip Mask',
    nameAr: 'قناع شفاه ليلي',
    nameFr: 'Masque lèvres nuit',
    shortEn: 'Balm-mask that softens lips while you sleep.',
    shortAr: 'بلسم-قناع ينعم الشفاه أثناء النوم.',
    shortFr: 'Baume-masque qui adoucit les lèvres la nuit.',
    descEn: 'Shea and peptides in a soft jar — wake up to smoother lips.',
    benefits: 'Overnight soft\nNon-sticky\nJar spatula',
    howToUse: 'Generous layer before bed; wipe excess AM if needed.',
    suitableFor: 'Dry and flaky lips',
    tags: ['lips', 'mask', 'night'],
    sizes: [{ name: '20g', usd: 2200, weightGrams: 40 }],
  },
  {
    name: 'Tinted Lip Treatment',
    nameAr: 'علاج شفاه ملوّن',
    nameFr: 'Soin lèvres teinté',
    shortEn: 'Balm with a wash of color and SPF 15.',
    shortAr: 'بلسم بغسلة لون وواقي ١٥.',
    shortFr: 'Baume teinté avec SPF 15.',
    descEn: 'Daytime lip care that looks like a soft stain.',
    benefits: 'SPF 15\nSheer tint\nConditioning',
    howToUse: 'Apply morning; reapply after meals.',
    suitableFor: 'All lips',
    tags: ['lips', 'balm', 'spf'],
    sizes: [
      { name: 'Berry', usd: 1800, weightGrams: 15 },
      { name: 'Coral', usd: 1800, weightGrams: 15 },
    ],
  },
  {
    name: 'Micellar Clear Water',
    nameAr: 'ماء ميسيلار صافٍ',
    nameFr: 'Eau micellaire claire',
    shortEn: 'No-rinse micellar for light makeup days.',
    shortAr: 'ميسيلار بلا شطف لأيام المكياج الخفيف.',
    shortFr: 'Micellaire sans rinçage pour maquillage léger.',
    descEn: 'Gentle surfactants that lift SPF and mascara with cotton — rinse if preferred.',
    benefits: 'No rinse needed\nEye friendly\nTravel bottle',
    howToUse: 'Soak cotton, wipe face; follow with cream cleanser if heavy makeup.',
    suitableFor: 'Sensitive eyes',
    tags: ['cleanser', 'micellar', 'makeup-remover'],
    sizes: [{ name: '400ml', usd: 2400, weightGrams: 450 }],
  },
  {
    name: 'Hydrating Mist + Serum Duo Label',
    nameAr: 'رذاذ وترطيب مزدوج',
    nameFr: 'Duo brume + sérum',
    shortEn: 'Storefront single: mist marketed with serum layering tip.',
    shortAr: 'رذاذ مع نصيحة طبقات السيروم.',
    shortFr: 'Brume présentée avec conseil de couches sérum.',
    descEn: 'A fuller mist bottle intended to sit beside serums in the ritual aisle.',
    benefits: 'Layer prep\nLarge format\nDesk friendly',
    howToUse: 'Mist, then serum within 30 seconds.',
    suitableFor: 'All skin',
    tags: ['toner', 'mist', 'hydrating'],
    sizes: [{ name: '200ml', usd: 3000, weightGrams: 230 }],
  },
  {
    name: 'Clay + Charcoal Stick Mask',
    nameAr: 'قناع عصا طين وفحم',
    nameFr: 'Masque stick argile charbon',
    shortEn: 'Twist-up clay stick for on-the-go T-zone touch-ups.',
    shortAr: 'عصا طين للمسّ منطقة T أثناء اليوم.',
    shortFr: 'Stick argile pour retouches zone T.',
    descEn: 'Mess-light stick mask — draw on nose and chin, leave 5 minutes.',
    benefits: 'Portable\nTargeted\nNo jar',
    howToUse: 'Apply to oily zones, wait, rinse or wipe.',
    suitableFor: 'Oily T-zone',
    tags: ['mask', 'clay', 'travel'],
    sizes: [{ name: '30g', usd: 2400, weightGrams: 50 }],
  },
  {
    name: 'Bright Eye Patches',
    nameAr: 'لصقات عين مضيئة',
    nameFr: 'Patches yeux éclat',
    shortEn: 'Hydrogel patches for pre-event under-eyes.',
    shortAr: 'لصقات هيدروجيل لمحيط العين قبل المناسبات.',
    shortFr: 'Patches hydrogel pour le contour avant un événement.',
    descEn: 'Chill before use; wear 15 minutes while finishing makeup elsewhere.',
    benefits: 'Cooling\nSingle use pairs\nEvent ready',
    howToUse: 'Apply under eyes 15 min, discard, tap leftover essence.',
    suitableFor: 'All skin',
    tags: ['eye-care', 'patches', 'event'],
    sizes: [{ name: '5 pairs', usd: 2800, weightGrams: 60 }],
  },
  {
    name: 'Matte Setting Powder',
    nameAr: 'بودرة تثبيت مات',
    nameFr: 'Poudre libre mate',
    shortEn: 'Translucent powder that soft-focuses shine.',
    shortAr: 'بودرة شفافة تموّه اللمعان.',
    shortFr: 'Poudre translucide anti-brillance soft focus.',
    descEn: 'Finely milled — a little goes far under eyes and T-zone.',
    benefits: 'Shine control\nPhoto soft\nTravel compact',
    howToUse: 'Press with puff; dust excess.',
    suitableFor: 'Oily and combination',
    tags: ['makeup', 'powder', 'setting'],
    sizes: [{ name: '8g', usd: 3000, weightGrams: 40 }],
  },
  {
    name: 'Cream Blush Pot',
    nameAr: 'بلاش كريمي في وعاء',
    nameFr: 'Blush crème pot',
    shortEn: 'Finger-friendly cream blush with a dewy finish.',
    shortAr: 'بلاش كريمي بالإصبع بلمسة ندية.',
    shortFr: 'Blush crème au doigt, fini frais.',
    descEn: 'Buildable cream that works over bare skin or foundation.',
    benefits: 'Dewy finish\nBlendable\nPocket size',
    howToUse: 'Tap on cheeks, blend upward.',
    suitableFor: 'Dry and normal skin',
    tags: ['blush', 'cream', 'dewy'],
    sizes: [
      { name: 'Apricot', usd: 2600, weightGrams: 30 },
      { name: 'Rose', usd: 2600, weightGrams: 30 },
    ],
  },
  // 81–100 More completeness across categories
  {
    name: 'Gentle Foam Cleanser',
    nameAr: 'منظف رغوي لطيف',
    nameFr: 'Nettoyant mousse douce',
    shortEn: 'Airy foam for humid-climate mornings.',
    shortAr: 'رغوة خفيفة لصباحات المناخ الرطب.',
    shortFr: 'Mousse aérienne pour matins humides.',
    descEn: 'Pump foam that rinses fast and leaves skin comfortable before toner.',
    benefits: 'Light foam\nQuick rinse\nAM friendly',
    howToUse: 'Pump once, massage, rinse.',
    suitableFor: 'Combination skin',
    tags: ['cleanser', 'foam', 'daily'],
    sizes: [{ name: '150ml', usd: 2300, weightGrams: 180 }],
  },
  {
    name: 'Essence First Lotion',
    nameAr: 'لوشن إيسنس أول',
    nameFr: 'Lotion essence première',
    shortEn: 'Watery essence to flood skin before serum.',
    shortAr: 'إيسنس مائية تُرطّب قبل السيروم.',
    shortFr: 'Essence aqueuse avant le sérum.',
    descEn: 'Japanese-inspired first lotion — pour into palms, press, do not wipe off.',
    benefits: 'Hydration flood\nSerum prep\nLayerable',
    howToUse: '2–3 layers on damp skin after cleanse.',
    suitableFor: 'Dehydrated skin',
    tags: ['toner', 'essence', 'hydrating'],
    sizes: [{ name: '150ml', usd: 3600, weightGrams: 190 }],
  },
  {
    name: 'Bakuchiol Calm Serum',
    nameAr: 'سيروم باكوشيول مهدئ',
    nameFr: 'Sérum bakuchiol calme',
    shortEn: 'Plant retinol alternative for sensitive nights.',
    shortAr: 'بديل ريتينول نباتي لليالي الحساسة.',
    shortFr: 'Alternative végétale au rétinol pour nuits sensibles.',
    descEn: 'Bakuchiol with squalane — retinoid-adjacent benefits without classic sting.',
    benefits: 'Gentle renew\nSensitive friendly\nNight use',
    howToUse: 'PM after toner; moisturize after.',
    suitableFor: 'Sensitive skin avoiding retinol',
    tags: ['serum', 'bakuchiol', 'clean-beauty'],
    sizes: [{ name: '30ml', usd: 4600, weightGrams: 60 }],
  },
  {
    name: 'Rich Night Cream',
    nameAr: 'كريم ليلي غني',
    nameFr: 'Crème de nuit riche',
    shortEn: 'Cushioned night cream for dry winters.',
    shortAr: 'كريم ليلي مخملي لشتاء جاف.',
    shortFr: 'Crème nuit coussinée pour hivers secs.',
    descEn: 'Heavier than the daily moisturizer — seals serums overnight.',
    benefits: 'Overnight comfort\nRich seal\nWinter hero',
    howToUse: 'Last step at night on face and neck.',
    suitableFor: 'Dry and mature skin',
    tags: ['moisturizer', 'night', 'rich'],
    sizes: [{ name: '50ml', usd: 4800, compareUsd: 5200, weightGrams: 95 }],
  },
  {
    name: 'Eye Bright Concealer Pencil',
    nameAr: 'قلم كونسيلر مضيء',
    nameFr: 'Crayon anti-cernes éclat',
    shortEn: 'Twist pencil concealer for quick brightening.',
    shortAr: 'قلم كونسيلر لتفتيح سريع.',
    shortFr: 'Crayon anti-cernes pour un éclaircissement rapide.',
    descEn: 'Creamy pencil that sharpens the look of the inner corner and under-eye.',
    benefits: 'Precise\nCreamy\nNo brush needed',
    howToUse: 'Draw, blend with fingertip, set lightly.',
    suitableFor: 'On-the-go touch-ups',
    tags: ['concealer', 'pencil', 'brightening'],
    sizes: [{ name: 'Fair/Light', usd: 2000, weightGrams: 14 }],
  },
  {
    name: 'Duo Chrome Highlighter Compact',
    nameAr: 'هايلايتر مزدوج اللون',
    nameFr: 'Compact enlumineur duo-chrome',
    shortEn: 'Pressed duo-chrome for editorial cheekbones.',
    shortAr: 'هايلايتر مضغوط بلونين للمناسبات.',
    shortFr: 'Duo-chrome pressé pour pommettes éditoriales.',
    descEn: 'Shift pigment that reads champagne-to-rose in changing light.',
    benefits: 'Editorial shift\nMirror compact\nBuildable',
    howToUse: 'Sweep with fan brush on high points.',
    suitableFor: 'Evening and editorial looks',
    tags: ['highlighter', 'duo-chrome', 'pressed'],
    sizes: [{ name: '6g', usd: 3200, weightGrams: 45 }],
  },
  {
    name: 'Longwear Liquid Liner',
    nameAr: 'آيلاينر سائل يدوم',
    nameFr: 'Eyeliner liquide longue tenue',
    shortEn: 'Felt-tip liquid liner with a sharp wing.',
    shortAr: 'سائل بطرف لباد لجناح حاد.',
    shortFr: 'Liquide feutre pour un trait d’aile net.',
    descEn: 'Quick-dry ink that resists humidity when set.',
    benefits: 'Sharp tip\nSmudge resistant\nEasy wing',
    howToUse: 'Shake, draw along lash line; let dry 20 sec.',
    suitableFor: 'All eye shapes',
    tags: ['eyeliner', 'liquid', 'long-wear'],
    sizes: [{ name: '1ml', usd: 2100, weightGrams: 18 }],
  },
  {
    name: 'Brow Pomade Pot',
    nameAr: 'بوماد حواجب',
    nameFr: 'Pommade sourcils',
    shortEn: 'Creamy pomade for bold, brushed-up brows.',
    shortAr: 'بوماد كريمي لحواجب جريئة ومرفوعة.',
    shortFr: 'Pommade crémeuse pour sourcils audacieux.',
    descEn: 'Waterproof-leaning color — use a tiny amount with an angled brush.',
    benefits: 'Bold definition\nLong wear\nMixable shades',
    howToUse: 'Scrape brush lightly, outline and fill, set with gel.',
    suitableFor: 'Sparse brows wanting drama',
    tags: ['brows', 'pomade', 'bold'],
    sizes: [
      { name: 'Taupe', usd: 2200, weightGrams: 25 },
      { name: 'Espresso', usd: 2200, weightGrams: 25 },
    ],
  },
  {
    name: 'Volume Dry Shampoo',
    nameAr: 'شامبو جاف للكثافة',
    nameFr: 'Shampoing sec volume',
    shortEn: 'Invisible dry shampoo for day-two hair.',
    shortAr: 'شامبو جاف غير مرئي لشعر اليوم الثاني.',
    shortFr: 'Shampoing sec invisible pour J+1.',
    descEn: 'Rice starch absorb without white cast on most tones when brushed through.',
    benefits: 'Oil absorb\nRoot lift\nNo white cast',
    howToUse: 'Spray at roots, wait 1 min, massage and brush.',
    suitableFor: 'Fine and medium hair',
    tags: ['styling', 'dry-shampoo', 'volume'],
    sizes: [{ name: '150ml', usd: 2400, weightGrams: 180 }],
  },
  {
    name: 'Curl Defining Cream',
    nameAr: 'كريم تحديد التجعيد',
    nameFr: 'Crème définition boucles',
    shortEn: 'Cream that defines curls without crunch.',
    shortAr: 'كريم يحدّد التجعيد دون صلابة.',
    shortFr: 'Crème qui définit sans effet carton.',
    descEn: 'Light hold cream for 2a–3c patterns — scrunch on soaking wet hair.',
    benefits: 'Soft definition\nFrizz buffer\nNo crunch',
    howToUse: 'Rake through wet hair, scrunch, air dry or diffuse.',
    suitableFor: 'Wavy and curly hair',
    tags: ['styling', 'curl', 'cream'],
    sizes: [{ name: '150ml', usd: 2800, weightGrams: 175 }],
  },
  {
    name: 'Leather & Fig Cologne',
    nameAr: 'كولونيا جلد وتين',
    nameFr: 'Cologne cuir & figue',
    shortEn: 'Soft leather and ripe fig for cooler air.',
    shortAr: 'جلد ناعم وتين ناضج للهواء البارد.',
    shortFr: 'Cuir doux et figue mûre pour air frais.',
    descEn: 'A modern cologne concentration — intimate trail, not shouting.',
    benefits: 'Intimate trail\nAutumn/winter\nUnisex',
    howToUse: 'Spray chest and wrists.',
    suitableFor: 'Cooler months',
    tags: ['fragrance', 'cologne', 'leather'],
    sizes: [{ name: '50ml', usd: 6400, weightGrams: 160 }],
  },
  {
    name: 'Hair Perfume Mist',
    nameAr: 'عطر رذاذ للشعر',
    nameFr: 'Brume parfum cheveux',
    shortEn: 'Alcohol-soft hair mist that won’t crisp strands.',
    shortAr: 'رذاذ عطر ناعم لا يقصّف الشعر.',
    shortFr: 'Brume cheveux douce qui ne crispe pas.',
    descEn: 'UV filter light and soft musk — spray mid-lengths only.',
    benefits: 'Scented hair\nSoft hold of scent\nNon-drying',
    howToUse: 'Mist mid-lengths from 20 cm; avoid roots if oily.',
    suitableFor: 'All hair',
    tags: ['fragrance', 'hair', 'mist'],
    sizes: [{ name: '50ml', usd: 3600, weightGrams: 80 }],
  },
  {
    name: 'Manicure Prep Kit',
    nameAr: 'طقم تحضير المانيكير',
    nameFr: 'Kit préparation manucure',
    shortEn: 'File, buffer, and cuticle stick starter kit.',
    shortAr: 'مبرد وصاقل وعود جلد طقم بداية.',
    shortFr: 'Lime, buffer et bâtonnet cuticules.',
    descEn: 'Everything needed before polish — reusable pouch included.',
    benefits: 'Complete prep\nReusable\nGift friendly',
    howToUse: 'Shape, buff lightly, push cuticles, then polish.',
    suitableFor: 'Home manicures',
    tags: ['tools', 'nail-care', 'kit'],
    sizes: [{ name: '1 kit', usd: 2400, weightGrams: 80 }],
  },
  {
    name: 'Clean Mineral SPF Stick',
    nameAr: 'عصا واقي معدني نظيف',
    nameFr: 'Stick SPF minéral clean',
    shortEn: 'On-the-go mineral SPF stick for face and ears.',
    shortAr: 'عصا واقي معدني للوجه والأذنين.',
    shortFr: 'Stick SPF minéral pour visage et oreilles.',
    descEn: 'Short INCI zinc stick — reapply over makeup carefully on high points.',
    benefits: 'Portable\nClean list\nReapply easy',
    howToUse: 'Swipe on cheekbones, nose, ears; blend edges.',
    suitableFor: 'All skin; kids 6+ with adult help',
    tags: ['spf', 'clean-beauty', 'stick'],
    sizes: [{ name: '20g', usd: 2800, weightGrams: 40 }],
  },
  {
    name: 'Holiday Candle Tin',
    nameAr: 'شمعة عطلة في علبة',
    nameFr: 'Bougie fêtes en tin',
    shortEn: 'Seasonal soy candle for vanity ambiance.',
    shortAr: 'شمعة صويا موسمية لأجواء التسريحة.',
    shortFr: 'Bougie soja saisonnière pour la coiffeuse.',
    descEn: 'Soft cedar and cream scent — burn within sight; trim wick.',
    benefits: 'Seasonal scent\nGift tin\nVanity mood',
    howToUse: 'Burn 2–3 hours max per session; never unattended.',
    suitableFor: 'Home fragrance lovers',
    tags: ['seasonal', 'home', 'limited'],
    sizes: [{ name: '180g', usd: 3200, weightGrams: 220 }],
  },
  {
    name: 'Discovery Scent Set',
    nameAr: 'طقم اكتشاف العطور',
    nameFr: 'Coffret découverte parfums',
    shortEn: 'Three 5ml fragrance vials to find a signature.',
    shortAr: 'ثلاث قوارير ٥ مل لاكتشاف توقيعك.',
    shortFr: 'Trois flacons 5ml pour trouver une signature.',
    descEn: 'Ambre Nuit, Citrus Grove, and Leather & Fig in travel vials.',
    benefits: 'Try before full size\nGift ready\nTravel friendly',
    howToUse: 'Spray blotters or pulse points; wait dry-down.',
    suitableFor: 'Fragrance explorers',
    tags: ['sets-kits', 'fragrance', 'discovery'],
    sizes: [{ name: '3 × 5ml', usd: 4500, compareUsd: 5200, weightGrams: 90 }],
  },
  {
    name: 'Starter Skincare Kit Box',
    nameAr: 'صندوق طقم عناية للمبتدئين',
    nameFr: 'Coffret skincare débutant',
    shortEn: 'Cleanse, mist, moisturizer minis in one box.',
    shortAr: 'ميني تنظيف ورذاذ ومرطب في صندوق واحد.',
    shortFr: 'Minis nettoyant, brume et crème dans un coffret.',
    descEn: 'Two-week starter path for new Selfieface customers — pairs with full sizes later.',
    benefits: 'Beginner path\nTravel ready\nGift box',
    howToUse: 'AM/PM as labeled cards inside the box.',
    suitableFor: 'Skincare beginners',
    tags: ['sets-kits', 'skincare', 'starter'],
    sizes: [{ name: '1 box', usd: 5800, compareUsd: 6800, weightGrams: 350 }],
  },
  {
    name: 'Weekend Glow Kit',
    nameAr: 'طقم توهج عطلة نهاية الأسبوع',
    nameFr: 'Kit glow week-end',
    shortEn: 'Mask, eye patches, and lip mask for Friday night.',
    shortAr: 'قناع ولصقات عين وقناع شفاه لليلة الجمعة.',
    shortFr: 'Masque, patches yeux et masque lèvres pour vendredi.',
    descEn: 'A self-care evening in one carton — popular gift with purchase add-on.',
    benefits: 'Event prep\nSelf-care night\nGiftable',
    howToUse: 'Use mask, then patches, then lip mask before bed.',
    suitableFor: 'All skin',
    tags: ['sets-kits', 'mask', 'gift'],
    sizes: [{ name: '1 kit', usd: 5200, weightGrams: 280 }],
  },
  {
    name: 'Brush Cleaning Mat',
    nameAr: 'سجادة غسيل الفرش',
    nameFr: 'Tapis nettoyage pinceaux',
    shortEn: 'Silicone mat with texture wells for brush washing.',
    shortAr: 'سجادة سيليكون بغسل الفرش.',
    shortFr: 'Tapis silicone à textures pour laver les pinceaux.',
    descEn: 'Suction feet hold the mat in the sink while you swirl brushes clean.',
    benefits: 'Deep clean\nSink grip\nQuick dry',
    howToUse: 'Wet brushes, swirl with cleanser on textured wells, rinse.',
    suitableFor: 'All makeup brushes',
    tags: ['tools', 'cleaning', 'brushes'],
    sizes: [{ name: '1 mat', usd: 1800, weightGrams: 150 }],
  },
  {
    name: 'Compact Mirror LED',
    nameAr: 'مرآة مدمجة بإضاءة',
    nameFr: 'Miroir compact LED',
    shortEn: 'Folding mirror with soft LED for evening touch-ups.',
    shortAr: 'مرآة قابلة للطي بإضاءة ناعمة للمسّ المسائي.',
    shortFr: 'Miroir pliable LED doux pour retouches soir.',
    descEn: 'USB-chargeable light — three brightness levels for restaurants and cars.',
    benefits: 'Portable light\nUSB charge\nTrue-ish color',
    howToUse: 'Charge fully; tap to cycle brightness.',
    suitableFor: 'Makeup touch-ups',
    tags: ['tools', 'mirror', 'travel'],
    sizes: [{ name: '1 mirror', usd: 3600, weightGrams: 200 }],
  },
  {
    name: 'Overnight Repair Ampoules',
    nameAr: 'أمبولات إصلاح ليلية',
    nameFr: 'Ampoules réparation nuit',
    shortEn: 'Seven night ampoules for a focused repair week.',
    shortAr: 'سبع أمبولات ليلية لأسبوع إصلاح مركّز.',
    shortFr: 'Sept ampoules nuit pour une semaine de réparation.',
    descEn:
      'Peptide and panthenol ampoules in single doses — twist, apply, sleep. Ideal after travel or a harsh week.',
    benefits: 'Fresh single dose\nBarrier comfort\nWeek-long ritual',
    howToUse: 'One ampoule on clean skin each night for seven nights.',
    suitableFor: 'Stressed and dry skin',
    tags: ['serum', 'ampoule', 'night'],
    sizes: [{ name: '7 × 2ml', usd: 5200, compareUsd: 5800, weightGrams: 55 }],
  },
];

const PACK_NAME_BANK: { en: string; ar: string; fr: string; blurb: string }[] = [
  {
    en: 'Morning Barrier Ritual Pack',
    ar: 'طقم طقس حاجز الصباح',
    fr: 'Coffret rituel barrière matin',
    blurb: 'Cleanse, treat, and moisturize for calmer mornings.',
  },
  {
    en: 'Glow Edit Duo',
    ar: 'ثنائي تحرير الإشراق',
    fr: 'Duo édition éclat',
    blurb: 'Serum and moisturizer paired for a lit-from-within look.',
  },
  {
    en: 'Travel Essentials Trio',
    ar: 'ثلاثي أساسيات السفر',
    fr: 'Trio essentiels voyage',
    blurb: 'Cabin-ready sizes for weekenders and carry-ons.',
  },
  {
    en: 'Night Recovery Set',
    ar: 'طقم التعافي الليلي',
    fr: 'Coffret récupération nuit',
    blurb: 'Evening steps for softer-looking mornings.',
  },
  {
    en: 'Clean Beauty Starter',
    ar: 'بداية الجمال النظيف',
    fr: 'Starter clean beauty',
    blurb: 'Short-list formulas for ingredient-minimal routines.',
  },
  {
    en: 'Soft Glam Makeup Kit',
    ar: 'طقم مكياج ناعم',
    fr: 'Kit maquillage soft glam',
    blurb: 'Cheeks, lips, and eyes for an everyday soft glam.',
  },
  {
    en: 'SPF Daily Defense Pack',
    ar: 'طقم دفاع واقي يومي',
    fr: 'Pack défense SPF quotidienne',
    blurb: 'Morning SPF with prep mist for consistent wear.',
  },
  {
    en: 'Hair Softness Ritual',
    ar: 'طقس نعومة الشعر',
    fr: 'Rituel douceur cheveux',
    blurb: 'Shampoo, conditioner, and weekly mask together.',
  },
  {
    en: 'Fragrance Discovery Pack',
    ar: 'طقم اكتشاف العطر',
    fr: 'Pack découverte parfum',
    blurb: 'Layer scent and body mist for a full trail.',
  },
  {
    en: 'Self-Care Sunday Box',
    ar: 'صندوق أحد العناية الذاتية',
    fr: 'Box dimanche self-care',
    blurb: 'Mask, body polish, and balm for a slow evening.',
  },
];

function categoryIndexForProduct(i: number): number {
  // Spread 100 products across 40 categories (skew slightly to core skincare/makeup).
  return i % FULL_CATEGORIES.length;
}

function brandIndexForProduct(i: number): number {
  return i % BRANDS.length;
}

async function upsertCategoryTranslations(
  prisma: PrismaClient,
  categoryId: string,
  name: Loc,
  description: Loc,
) {
  const rows = [
    { locale: Locale.en, name: name.en, description: description.en },
    { locale: Locale.ar, name: name.ar, description: description.ar },
    { locale: Locale.fr, name: name.fr, description: description.fr },
  ];
  for (const row of rows) {
    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId, locale: row.locale } },
      create: { categoryId, ...row },
      update: { name: row.name, description: row.description },
    });
  }
}

async function upsertBrandTranslations(
  prisma: PrismaClient,
  brandId: string,
  name: Loc,
  description: Loc,
) {
  const rows = [
    { locale: Locale.en, name: name.en, description: description.en },
    { locale: Locale.ar, name: name.ar, description: description.ar },
    { locale: Locale.fr, name: name.fr, description: description.fr },
  ];
  for (const row of rows) {
    await prisma.brandTranslation.upsert({
      where: { brandId_locale: { brandId, locale: row.locale } },
      create: { brandId, ...row },
      update: { name: row.name, description: row.description },
    });
  }
}

async function ensureProductImage(
  prisma: PrismaClient,
  productId: string,
  slug: string,
  name: string,
  imageIndex: number,
) {
  const existing = await prisma.productImage.findFirst({
    where: { productId },
    include: { media: true },
  });
  if (existing?.media.url.startsWith('http')) return;

  if (existing) {
    await prisma.productImage.delete({ where: { id: existing.id } });
    await prisma.media.delete({ where: { id: existing.mediaId } }).catch(() => undefined);
  }

  const url = IMAGE_POOL[imageIndex % IMAGE_POOL.length]!;
  const media = await prisma.media.create({
    data: {
      filename: `${slug}.jpg`,
      mimeType: 'image/jpeg',
      size: 0,
      path: url,
      url,
    },
  });
  await prisma.productImage.create({
    data: { productId, mediaId: media.id, sortOrder: 0, alt: name },
  });
}

/**
 * Seeds 40 categories, 10 brands, 100 products, and 100 packs.
 * Idempotent by slug (`prod-001`…`prod-100`, `pack-001`…`pack-100`).
 */
export async function seedFullCatalog(prisma: PrismaClient) {
  console.log(
    'Starting full catalog seed (40 categories, 10 brands, 100 products, 100 packs) — this can take several minutes on a remote DB…',
  );
  const otherMarket = await prisma.market.findUniqueOrThrow({ where: { code: 'OTHER' } });

  if (PRODUCT_TEMPLATES.length !== 100) {
    throw new Error(`Expected 100 product templates, got ${PRODUCT_TEMPLATES.length}`);
  }
  if (FULL_CATEGORIES.length !== 40) {
    throw new Error(`Expected 40 categories, got ${FULL_CATEGORIES.length}`);
  }

  const brandIds = new Map<string, string>();
  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { marketId_slug: { marketId: otherMarket.id, slug: b.slug } },
      update: {
        name: b.name.en,
        description: b.description.en,
        imageUrl: b.imageUrl,
      },
      create: {
        name: b.name.en,
        slug: b.slug,
        description: b.description.en,
        imageUrl: b.imageUrl,
        marketId: otherMarket.id,
      },
    });
    await upsertBrandTranslations(prisma, brand.id, b.name, b.description);
    brandIds.set(b.slug, brand.id);
  }
  console.log(`Full catalog: upserted ${brandIds.size} brands`);

  const categoryIds = new Map<string, string>();
  for (const c of FULL_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { marketId_slug: { marketId: otherMarket.id, slug: c.slug } },
      update: {
        name: c.name.en,
        description: c.description.en,
        sortOrder: c.sortOrder,
      },
      create: {
        name: c.name.en,
        slug: c.slug,
        description: c.description.en,
        sortOrder: c.sortOrder,
        marketId: otherMarket.id,
      },
    });
    await upsertCategoryTranslations(prisma, category.id, c.name, c.description);
    categoryIds.set(c.slug, category.id);
  }
  console.log(`Full catalog: upserted ${categoryIds.size} categories`);

  const setsKitsId = categoryIds.get('sets-kits')!;
  const lumeaId = brandIds.get('lumea')!;

  const createdProductVariantIds: string[] = [];

  for (let i = 0; i < PRODUCT_TEMPLATES.length; i++) {
    if (i === 0 || (i + 1) % 10 === 0 || i + 1 === PRODUCT_TEMPLATES.length) {
      console.log(`Full catalog: products ${i + 1}/${PRODUCT_TEMPLATES.length}…`);
    }
    const t = PRODUCT_TEMPLATES[i]!;
    const n = i + 1;
    const slug = `${FULL_PRODUCT_PREFIX}${pad(n)}`;
    const cat = FULL_CATEGORIES[categoryIndexForProduct(i)]!;
    const brand = BRANDS[brandIndexForProduct(i)]!;
    const categoryId = categoryIds.get(cat.slug)!;
    const brandId = brandIds.get(brand.slug)!;
    const popularityScore = 100 - Math.floor(i / 2) + (i % 7);
    const isIncoming = i % 17 === 0;
    const incomingAt = isIncoming
      ? new Date(Date.now() + (7 + (i % 21)) * 24 * 60 * 60 * 1000)
      : null;

    const existing = await prisma.product.findUnique({
      where: { marketId_slug: { marketId: otherMarket.id, slug } },
      include: { variants: true },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: t.name,
          status: ProductStatus.ACTIVE,
          kind: ProductKind.PRODUCT,
          shortDescription: t.shortEn,
          description: t.descEn,
          benefits: t.benefits,
          howToUse: t.howToUse,
          suitableFor: t.suitableFor,
          categoryId,
          brandId,
          tags: t.tags,
          popularityScore,
          isIncoming,
          incomingAt,
        },
      });
      for (const localeRow of [
        {
          locale: Locale.en,
          name: t.name,
          shortDescription: t.shortEn,
          description: t.descEn,
        },
        {
          locale: Locale.ar,
          name: t.nameAr,
          shortDescription: t.shortAr,
          description: t.descEn,
        },
        {
          locale: Locale.fr,
          name: t.nameFr,
          shortDescription: t.shortFr,
          description: t.descEn,
        },
      ]) {
        await prisma.productTranslation.upsert({
          where: {
            productId_locale: { productId: existing.id, locale: localeRow.locale },
          },
          create: {
            productId: existing.id,
            locale: localeRow.locale,
            name: localeRow.name,
            shortDescription: localeRow.shortDescription,
            description: localeRow.description,
            benefits: t.benefits,
            howToUse: t.howToUse,
            suitableFor: t.suitableFor,
          },
          update: {
            name: localeRow.name,
            shortDescription: localeRow.shortDescription,
            description: localeRow.description,
            benefits: t.benefits,
            howToUse: t.howToUse,
            suitableFor: t.suitableFor,
          },
        });
      }
      for (const v of existing.variants) {
        createdProductVariantIds.push(v.id);
      }
      await ensureProductImage(prisma, existing.id, slug, t.name, i);
      continue;
    }

    const created = await prisma.product.create({
      data: {
        name: t.name,
        slug,
        status: ProductStatus.ACTIVE,
        kind: ProductKind.PRODUCT,
        shortDescription: t.shortEn,
        description: t.descEn,
        benefits: t.benefits,
        howToUse: t.howToUse,
        suitableFor: t.suitableFor,
        categoryId,
        brandId,
        marketId: otherMarket.id,
        tags: t.tags,
        popularityScore,
        isIncoming,
        incomingAt,
        translations: {
          create: [
            {
              locale: Locale.en,
              name: t.name,
              shortDescription: t.shortEn,
              description: t.descEn,
              benefits: t.benefits,
              howToUse: t.howToUse,
              suitableFor: t.suitableFor,
            },
            {
              locale: Locale.ar,
              name: t.nameAr,
              shortDescription: t.shortAr,
              description: t.descEn,
              benefits: t.benefits,
              howToUse: t.howToUse,
              suitableFor: t.suitableFor,
            },
            {
              locale: Locale.fr,
              name: t.nameFr,
              shortDescription: t.shortFr,
              description: t.descEn,
              benefits: t.benefits,
              howToUse: t.howToUse,
              suitableFor: t.suitableFor,
            },
          ],
        },
        variants: {
          create: t.sizes.map((size, vi) => ({
            name: size.name,
            sku: `FULL-${pad(n)}-${pad(vi + 1, 2)}`,
            stock: 20 + ((i + vi) % 80),
            weightGrams: size.weightGrams,
            isActive: true,
            prices: { create: pricesFromUsd(size.usd, size.compareUsd) },
          })),
        },
      },
      include: { variants: true },
    });

    for (const v of created.variants) {
      createdProductVariantIds.push(v.id);
    }
    await ensureProductImage(prisma, created.id, slug, t.name, i);
  }

  // Refresh variant pool if products already existed from a prior partial run
  if (createdProductVariantIds.length < 50) {
    const variants = await prisma.productVariant.findMany({
      where: { product: { kind: ProductKind.PRODUCT, slug: { startsWith: FULL_PRODUCT_PREFIX } } },
      select: { id: true },
    });
    createdProductVariantIds.length = 0;
    createdProductVariantIds.push(...variants.map((v) => v.id));
  }

  if (createdProductVariantIds.length < 2) {
    throw new Error('Full catalog packs need at least 2 product variants');
  }

  const variantPrices = await prisma.variantPrice.findMany({
    where: {
      currency: 'USD',
      variantId: { in: createdProductVariantIds },
    },
    select: { variantId: true, amount: true },
  });
  const priceByVariant = new Map(variantPrices.map((p) => [p.variantId, p.amount]));

  console.log('Full catalog: seeding 100 packs…');
  for (let i = 0; i < 100; i++) {
    if (i === 0 || (i + 1) % 10 === 0 || i + 1 === 100) {
      console.log(`Full catalog: packs ${i + 1}/100…`);
    }
    const n = i + 1;
    const slug = `${FULL_PACK_PREFIX}${pad(n)}`;
    const bank = PACK_NAME_BANK[i % PACK_NAME_BANK.length]!;
    const suffix = n > PACK_NAME_BANK.length ? ` #${n}` : '';
    const nameEn = `${bank.en}${suffix}`;
    const nameAr = `${bank.ar}${suffix}`;
    const nameFr = `${bank.fr}${suffix}`;

    const componentCount = 2 + (i % 3); // 2–4
    const componentVariantIds: string[] = [];
    for (let c = 0; c < componentCount; c++) {
      const idx = (i * 3 + c * 11) % createdProductVariantIds.length;
      const vid = createdProductVariantIds[idx]!;
      if (!componentVariantIds.includes(vid)) {
        componentVariantIds.push(vid);
      } else {
        const alt =
          createdProductVariantIds[(idx + 7 + c) % createdProductVariantIds.length]!;
        if (!componentVariantIds.includes(alt)) componentVariantIds.push(alt);
      }
    }

    const componentsList = await Promise.all(
      componentVariantIds.map(async (variantId, sortOrder) => {
        const qty = 1 + ((i + sortOrder) % 2);
        return { variantId, quantity: qty, sortOrder };
      }),
    );

    let compareUsd = 0;
    for (const c of componentsList) {
      compareUsd += (priceByVariant.get(c.variantId) ?? 2500) * c.quantity;
    }
    const packUsd = Math.max(800, Math.round(compareUsd * 0.85));
    const popularityScore = 80 - (i % 40);

    const existing = await prisma.product.findUnique({
      where: { marketId_slug: { marketId: otherMarket.id, slug } },
      include: { variants: true, packComponents: true },
    });

    let packId: string;
    if (existing) {
      packId = existing.id;
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: nameEn,
          status: ProductStatus.ACTIVE,
          kind: ProductKind.PACK,
          shortDescription: bank.blurb,
          description: `${bank.blurb} Curated pack with ${componentsList.length} catalog items at a bundle price.`,
          benefits: 'Bundle savings vs buying separate\nCurated ritual pairing\nGift-ready',
          howToUse: 'Add the pack to cart — component stock is reserved together.',
          suitableFor: 'Anyone building a complete ritual',
          categoryId: setsKitsId,
          brandId: lumeaId,
          marketId: otherMarket.id,
          tags: ['pack', 'bundle', 'gift'],
          popularityScore,
          isIncoming: false,
          incomingAt: null,
        },
      });

      for (const localeRow of [
        { locale: Locale.en, name: nameEn },
        { locale: Locale.ar, name: nameAr },
        { locale: Locale.fr, name: nameFr },
      ]) {
        await prisma.productTranslation.upsert({
          where: {
            productId_locale: { productId: existing.id, locale: localeRow.locale },
          },
          create: {
            productId: existing.id,
            locale: localeRow.locale,
            name: localeRow.name,
            shortDescription: bank.blurb,
            description: `${bank.blurb} Curated pack with ${componentsList.length} catalog items.`,
            benefits: 'Bundle savings\nCurated pairing\nGift-ready',
            howToUse: 'Add the pack to cart.',
            suitableFor: 'Complete rituals',
          },
          update: {
            name: localeRow.name,
            shortDescription: bank.blurb,
            description: `${bank.blurb} Curated pack with ${componentsList.length} catalog items.`,
          },
        });
      }

      const packVariant =
        existing.variants[0] ??
        (await prisma.productVariant.create({
          data: {
            productId: existing.id,
            name: 'Pack',
            sku: `FULL-PACK-${pad(n)}`,
            stock: 50 + (i % 40),
            weightGrams: 400 + i * 3,
            isActive: true,
            prices: { create: pricesFromUsd(packUsd, compareUsd) },
          },
        }));

      if (existing.variants[0]) {
        await prisma.productVariant.update({
          where: { id: packVariant.id },
          data: { stock: 50 + (i % 40), weightGrams: 400 + i * 3 },
        });
        for (const currency of ['USD', 'TND', 'AED'] as const) {
          const amount =
            currency === 'USD'
              ? packUsd
              : currency === 'TND'
                ? Math.round(packUsd * 3.1)
                : Math.round(packUsd * 3.67);
          const compareAtAmount =
            currency === 'USD'
              ? compareUsd
              : currency === 'TND'
                ? Math.round(compareUsd * 3.1)
                : Math.round(compareUsd * 3.67);
          await prisma.variantPrice.upsert({
            where: {
              variantId_currency: { variantId: packVariant.id, currency },
            },
            create: {
              variantId: packVariant.id,
              currency,
              amount,
              compareAtAmount,
            },
            update: { amount, compareAtAmount },
          });
        }
      }

      await prisma.packComponent.deleteMany({ where: { packProductId: existing.id } });
      await prisma.packComponent.createMany({
        data: componentsList.map((c) => ({
          packProductId: existing.id,
          variantId: c.variantId,
          quantity: c.quantity,
          sortOrder: c.sortOrder,
        })),
      });
    } else {
      const created = await prisma.product.create({
        data: {
          name: nameEn,
          slug,
          status: ProductStatus.ACTIVE,
          kind: ProductKind.PACK,
          shortDescription: bank.blurb,
          description: `${bank.blurb} Curated pack with ${componentsList.length} catalog items at a bundle price.`,
          benefits: 'Bundle savings vs buying separate\nCurated ritual pairing\nGift-ready',
          howToUse: 'Add the pack to cart — component stock is reserved together.',
          suitableFor: 'Anyone building a complete ritual',
          categoryId: setsKitsId,
          brandId: lumeaId,
          marketId: otherMarket.id,
          tags: ['pack', 'bundle', 'gift'],
          popularityScore,
          translations: {
            create: [
              {
                locale: Locale.en,
                name: nameEn,
                shortDescription: bank.blurb,
                description: `${bank.blurb} Curated pack with ${componentsList.length} catalog items.`,
                benefits: 'Bundle savings\nCurated pairing\nGift-ready',
                howToUse: 'Add the pack to cart.',
                suitableFor: 'Complete rituals',
              },
              {
                locale: Locale.ar,
                name: nameAr,
                shortDescription: bank.blurb,
                description: `${bank.blurb} — طقم منسّق.`,
                benefits: 'توفير الحزمة\nتنسيق طقس\nجاهز للهدايا',
                howToUse: 'أضيفي الطقم إلى السلة.',
                suitableFor: 'طقوس كاملة',
              },
              {
                locale: Locale.fr,
                name: nameFr,
                shortDescription: bank.blurb,
                description: `${bank.blurb} Coffret avec ${componentsList.length} articles.`,
                benefits: 'Économies pack\nAssociation rituelle\nIdée cadeau',
                howToUse: 'Ajoutez le pack au panier.',
                suitableFor: 'Rituels complets',
              },
            ],
          },
          variants: {
            create: [
              {
                name: 'Pack',
                sku: `FULL-PACK-${pad(n)}`,
                stock: 50 + (i % 40),
                weightGrams: 400 + i * 3,
                isActive: true,
                prices: { create: pricesFromUsd(packUsd, compareUsd) },
              },
            ],
          },
          packComponents: {
            create: componentsList.map((c) => ({
              variantId: c.variantId,
              quantity: c.quantity,
              sortOrder: c.sortOrder,
            })),
          },
        },
      });
      packId = created.id;
    }

    await ensureProductImage(prisma, packId, slug, nameEn, i + 3);
  }

  // Pin a few packs on TOP_PACKS rail for homepage demos
  const topPackSlugs = ['pack-001', 'pack-002', 'pack-003', 'pack-007', 'pack-012'];
  await prisma.merchandisingRailItem.deleteMany({
    where: { rail: MerchandisingRailKind.TOP_PACKS, marketId: otherMarket.id },
  });
  let sortOrder = 0;
  for (const packSlug of topPackSlugs) {
    const pack = await prisma.product.findUnique({ where: { marketId_slug: { marketId: otherMarket.id, slug: packSlug } } });
    if (!pack) continue;
    await prisma.merchandisingRailItem.create({
      data: {
        rail: MerchandisingRailKind.TOP_PACKS,
        productId: pack.id,
        marketId: otherMarket.id,
        sortOrder: sortOrder++,
      },
    });
  }

  const catCount = await prisma.category.count();
  const prodCount = await prisma.product.count({ where: { kind: ProductKind.PRODUCT } });
  const packCount = await prisma.product.count({ where: { kind: ProductKind.PACK } });
  const brandCount = await prisma.brand.count();

  console.log(
    `Seeded full catalog: ${FULL_CATEGORIES.length} category specs (db categories=${catCount}), ` +
      `${BRANDS.length} brands (db=${brandCount}), ` +
      `100 products + 100 packs (db products=${prodCount}, packs=${packCount}), TOP_PACKS rail pinned`,
  );
}
