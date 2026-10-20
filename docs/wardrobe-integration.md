# لوحة إدارة الملابس — دليل التكامل (جزئية نغم)

## التشغيل

```bash
npm install
npm run dev            # http://localhost:5180/#/wardrobe
npm run typecheck
npm run test:wardrobe  # اختبارات منطق التحقق والتصدير
```

- `#/wardrobe` لوحة إدارة الملابس.
- `#/fitting-room` (الافتراضي) صفحة الأفاتار وغرفة القياس الحالية.

## بنية الملفات

| الملف | الدور |
| --- | --- |
| `src/features/wardrobe/types.ts` | نوع بيانات المنتج `ClothingProduct` وقياسات القطعة |
| `src/features/wardrobe/garmentCatalog.ts` | أسماء الأنواع، القياسات المطلوبة لكل نوع، نماذج المشروع |
| `src/features/wardrobe/fabrics.ts` | أنواع القماش وإعدادات مظهرها في العارض |
| `src/features/wardrobe/validation.ts` | التحقق من البيانات وتنظيفها |
| `src/features/wardrobe/productRepository.ts` | الحفظ (IndexedDB مؤقتًا) |
| `src/features/wardrobe/fittingRoomExport.ts` | بناء بيانات التصدير وإرسالها |
| `src/features/wardrobe/viewer/*` | العارض ثلاثي الأبعاد (نموذج GLB أو معاينة تقريبية) |
| `src/features/wardrobe/components/*` | البطاقات، النموذج، التفاصيل، الحوارات |
| `src/integration/fittingRoom/*` | **عقد التكامل مع غرفة القياس** (مشترك مع الفريق) |

## الحفظ (حل مؤقت)

لا يوجد خادم خلفي للملابس حاليًا، لذلك تُحفظ القطع في **IndexedDB** داخل المتصفح:
البيانات خاصة بالمتصفح والجهاز، ولا تُشارك بين المستخدمين. الصور تُصغّر إلى 1200px
بصيغة WebP، والنماذج المرفوعة (GLB حتى 25MB) تُحفظ كـ data URL.
عند توفر API يكفي استبدال الدوال الأربع في `productRepository.ts`.

## التصدير إلى غرفة القياس

زر «تصدير إلى غرفة القياس» يتحقق من القطعة ثم يحفظ كائن JSON من نوع
`FittingRoomGarmentPayload` (المخطط `palestine-tryon/garment@1`) ويُبلغ غرفة القياس
فورًا (نفس التبويب عبر حدث window، والتبويبات الأخرى عبر BroadcastChannel).

```ts
import {
  getPendingGarment,            // آخر قطعة مصدّرة أو null
  subscribeToFittingRoomHandoff, // الاستماع لتصدير جديد
  garmentModelUrl,               // رابط يصلح مباشرة لـ useGLTF أو null
  getMeasurementBySize,          // مثال: getMeasurementBySize(p, 'chest') -> { S: 96, M: 104 }
} from '../integration/fittingRoom/handoff';
import { useIncomingGarment } from '../integration/fittingRoom/useIncomingGarment';
```

محتوى البيانات: `productId`, `name`, `type`, `category` (`top`/`bottom`/`full-body`),
`fabric {id,label}`, `color`, `images {front, back}`, `sizes [{size, measurementsCm}]`,
`model` (`{kind:'url', url}` أو `{kind:'embedded-glb', dataUrl, fileName}` أو `null`).

> **مهم:** `measurementsCm` هي قياسات **القطعة نفسها** بالسنتيمتر (المحيطات حول القطعة
> كاملة، وعرض الأكتاف والأطوال كقيم مستقيمة) — وليست قياسات جسم المستخدم.

## ما يلزم ربطه مع الفريق

**سجى (الملاءمة واقتراح المقاس):**
- حاليًا `AvatarCreator` يستخدم الجدول الثابت `CLOTHING_SIZES` (صدر فقط).
  يمكن قراءة قياسات القطعة المصدّرة عبر `getMeasurementBySize(payload, 'chest')`
  وتمريرها إلى `getFitStatus` بدل القيم الثابتة. لم أغيّر منطق الملاءمة.
- المقاسات في اللوحة `XS–XXL`، بينما `ClothingSize` في `fitLogic.ts` هي `S–XL` فقط.

**براءة (الأفاتار):**
- `Shirt.tsx` يحمّل `/models/shirt_{size}.glb` دائمًا؛ لتلبيس القطعة المصدّرة يمكن تمرير
  `url={garmentModelUrl(payload)}` (الخاصية `url` موجودة أصلًا في `Shirt`).
- صفحة الأفاتار تحتاج خادم `http://127.0.0.1:8000` لتحميل الأفاتار؛ عند توقفه يظهر خطأ
  في منطقة العرض فقط وتبقى اللوحة الجانبية تعمل.

## حدود واضحة

- لا يوجد تحويل تلقائي من الصور إلى نموذج ثلاثي الأبعاد. عند غياب النموذج يعرض العارض
  **معاينة تقريبية مسطّحة** مولّدة من نوع القطعة وقياسات المقاس المختار، مع إسقاط الصور
  الأمامية والخلفية عليها، ومكتوب عليها ذلك صراحة.
- القماش يغيّر **مظهر السطح فقط** (اللمعة، الخشونة، النسيج). لا توجد محاكاة فيزيائية
  لانسدال أو مرونة القماش.
- ملفات `public/models/shirt_*.glb` هي في الحقيقة نموذج فستان واحد (Wildwood Homespun Dress).
