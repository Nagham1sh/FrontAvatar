# AuraLook – Use Case Diagram (الإصدار الرابع) – التحليل الكامل

المراجع: المخطط الأصلي، وملاحظات الدكتور كما وردت في الطلب، ومتطلبات الإصدار الرابع، وقواعد UML 2.x.

**الأرقام النهائية**: 3 Actors · 52 Use Case · 22 Association · 15 Include · 18 Extend · 1 Generalization.

---

## 1. تحليل الوظائف وملاحظات الدكتور

| # | ملاحظة الدكتور / الوظيفة القديمة | التعديل | النتيجة في المخطط |
|---|---|---|---|
| 1 | إنشاء حساب وتسجيل الدخول في Oval واحدة | فصل | Register Customer · Register Shop Owner Account · Login · Logout |
| 2 | تسجيل المتجر مدموج مع الدخول | فصل | Register Store مستقلة + 4 عمليات فرعية |
| 3 | لا يوجد تسجيل خروج | إضافة | Logout (مشتركة) |
| 4 | عرض موقع المتجر على الخريطة منفصل | دمج | Browse Stores and View Locations |
| 5 | إدارة معلومات المتجر | إعادة تسمية + تفصيل | Update Store Information + 4 تحديثات فرعية (extend) |
| 6 | إدارة المنتجات + extend للإضافة والتعديل والحذف | حذف الحالة العامة | Add Product · Update Product Information · Delete Product مستقلة |
| 7 | رفع الصور كوظيفة مستقلة غير مرتبطة | ربط | Upload Front and Back Product Images (include من Add) · Update Product Images (extend من Update) |
| 8 | تحديد نوع القماش كوظيفة | حذف كوظيفة | حقل ضمن Enter Product Description (يحتاج تأكيد) |
| 9 | إدارة أسعار المنتجات | إعادة تنظيم | Set Product Price (include) · Update Product Price (extend) |
| 10 | إدارة المخزون والكميات | إعادة تسمية | Set Available Quantities (include) · Update Available Quantities (extend) |
| 11 | إنشاء تنسيقات الملابس يدوياً | حذف | — |
| 12 | عرض التنسيقات (عند صاحب المتجر) | نقل للزبون | View Suggested Outfit Combinations |
| 13 | عرض قياسات القطعة التفصيلية منفصلة | دمج | ضمن View Product Details (Note) |
| 14 | ربط نماذج 3D + extend مع المعاينة | إعادة تنظيم | Link 3D Garment Model (extend من Add) · Update 3D Garment Model (extend من Update)، ولا علاقة مع المعاينة |
| 15 | التصفح يحتاج حساباً | تصحيح | Actor زائر + Generalization |
| 16 | لا توجد تفضيلات | إضافة | Set Clothing Preferences · View Personalized Stores and Products |
| — | تصدير القطعة إلى غرفة القياس + التحقق من الاكتمال | حذف | الإتاحة تلقائية (Note على Link 3D Garment Model) |
| — | معاينة القطعة ثلاثياً دون Avatar | حذف | غير موجودة في المتطلبات الحالية |
| — | مقارنة الأسعار بين المتاجر | حذف | غير موجودة في المتطلبات الحالية |
| — | عرض الأسعار والمقاسات (include من التفاصيل) | دمج | ضمن View Product Details، ولا تُكرر عند صاحب المتجر |
| — | Actors: الخرائط، واتساب/إنستغرام | حذف | ممنوع |

---

## 2. Actors

| Actor | الدور | العلاقة |
|---|---|---|
| **Visitor – الزائر** | أي مستخدم دون حساب أو قبل تسجيل الدخول: يتصفح المتاجر والمنتجات والتفاصيل، ويتواصل مع المتجر، وينشئ حساباً | Actor عام |
| **Registered Customer – الزبون المسجل** | يرث كل ما سبق، ويضيف: الدخول والخروج، والتفضيلات، والـ Avatar والقياسات، والمعاينة، والتوصية، والتنسيقات | **Generalization**: خط متصل بمثلث فارغ يشير إلى Visitor |
| **Shop Owner – صاحب المتجر** | حسابه، ومتجره، ومنتجاته، ونماذجها ثلاثية الأبعاد | مستقل، لا يرث من أحد |

---

## 3. جدول Use Cases النهائي

### Visitor (9، ويرثها Registered Customer)
| Use Case | العربية | الارتباط |
|---|---|---|
| Browse Stores and View Locations | تصفح المتاجر وعرض مواقعها | Association |
| Search Stores | البحث عن متجر بالاسم | extend ← Browse Stores |
| View Store Information | عرض معلومات المتجر | Association |
| Contact Store | التواصل مع المتجر | extend ← View Store Information |
| Browse Products | تصفح المنتجات | Association |
| Search Products | البحث عن المنتجات | extend ← Browse Products |
| Filter Products | تصفية المنتجات (النوع، السعر، المقاس) | extend ← Browse Products |
| View Product Details | عرض تفاصيل المنتج | Association |
| Register Customer | إنشاء حساب زبون | Association (انظر 5-أ) |

### Registered Customer (13)
| Use Case | العربية | الارتباط |
|---|---|---|
| Login | تسجيل الدخول | Association (مشتركة) |
| Logout | تسجيل الخروج | Association (مشتركة) |
| Set Clothing Preferences | تحديد تفضيلات الملابس | Association |
| View Personalized Stores and Products | عرض المتاجر والمنتجات المتوافقة مع التفضيلات | Association |
| Generate 3D Avatar | إنشاء Avatar ثلاثي الأبعاد | Association |
| Enter Body Measurements | إدخال قياسات الجسم | include ← Generate 3D Avatar |
| Update Body Measurements | تحديث قياسات الجسم | Association (مستقلة) |
| Virtual Try-On | المعاينة الافتراضية للملابس | Association |
| Select Garment and Size | اختيار القطعة والمقاس | include ← Virtual Try-On / Get Size Recommendation |
| View Garment on Avatar | عرض القطعة على الـ Avatar | include ← Virtual Try-On |
| Get Size Recommendation | الحصول على توصية بالمقاس | Association |
| Compare Body and Garment Measurements | مقارنة قياسات الجسم بقياسات القطعة | include ← Get Size Recommendation |
| View Suggested Outfit Combinations | عرض تنسيقات الملابس المقترحة | Association |

### Shop Owner (30، منها Login و Logout المشتركتان)
| المجموعة | Use Case | العربية | الارتباط |
|---|---|---|---|
| الحساب | Register Shop Owner Account | إنشاء حساب صاحب متجر | Association |
| الحساب | Login / Logout | تسجيل الدخول / الخروج | Association (مشتركة) |
| تسجيل المتجر | Register Store | تسجيل متجر | Association |
| | Enter Store Information | إدخال بيانات المتجر | include |
| | Enter Contact Information | إدخال معلومات التواصل | include |
| | Set Store Location | تحديد الموقع الجغرافي للمتجر | include |
| | Add Social Media Links | إضافة روابط التواصل الاجتماعي | **extend** (اختيارية) |
| تحديث المتجر | Update Store Information | تحديث بيانات المتجر | Association |
| | Update Store Details | تحديث تفاصيل المتجر | extend |
| | Update Contact Information | تحديث معلومات التواصل | extend |
| | Update Social Media Links | تحديث روابط التواصل الاجتماعي | extend |
| | Update Store Location | تحديث الموقع الجغرافي | extend |
| إضافة منتج | Add Product | إضافة منتج | Association |
| | Enter Product Name | إدخال اسم المنتج | include |
| | Enter Product Description | إدخال وصف المنتج | include |
| | Set Product Price | تحديد سعر المنتج | include |
| | Upload Front and Back Product Images | رفع الصور الأمامية والخلفية | include |
| | Specify Available Sizes | تحديد المقاسات المتاحة | include |
| | Enter Measurements for Each Size | إدخال قياسات كل مقاس | include |
| | Set Available Quantities | تحديد كميات المخزون | include |
| | Link 3D Garment Model | ربط النموذج ثلاثي الأبعاد بالمنتج | **extend** (انظر 5-ج) |
| تحديث منتج | Update Product Information | تحديث بيانات المنتج | Association |
| | Update Product Name | تحديث اسم المنتج | extend |
| | Update Product Description | تحديث وصف المنتج | extend |
| | Update Product Price | تحديث سعر المنتج | extend |
| | Update Product Images | تحديث صور المنتج | extend |
| | Update Available Sizes | تحديث المقاسات المتاحة | extend |
| | Update Measurements for Each Size | تحديث قياسات كل مقاس | extend |
| | Update Available Quantities | تحديث الكميات المتاحة | extend |
| | Update 3D Garment Model | تحديث / استبدال النموذج ثلاثي الأبعاد | extend |
| حذف | Delete Product | حذف منتج | Association (بلا علاقات) |

**التحقق**: جميع العمليات الفرعية المطلوبة موجودة، كل واحدة في Oval مستقلة ولها سهم مستقل: 4 لتسجيل المتجر، و4 لتحديث المتجر، و8 لإضافة المنتج، و8 لتحديث المنتج.

---

## 4. جدول العلاقات

### Generalization
| من | إلى | الاتجاه | السبب |
|---|---|---|---|
| Registered Customer | Visitor | خط متصل، والمثلث الفارغ عند Visitor | الزبون المسجل «هو» زائر، ويملك صلاحيات إضافية |

### Include (السهم من الأساسية إلى المضمَّنة)
| Use Case الأساسية | Use Case المضمَّنة | السبب |
|---|---|---|
| Generate 3D Avatar | Enter Body Measurements | لا يمكن إنشاء Avatar بلا قياسات |
| Virtual Try-On | Select Garment and Size | لا معاينة دون تحديد القطعة والمقاس |
| Virtual Try-On | View Garment on Avatar | هذا هو جوهر المعاينة، ويحدث في كل تنفيذ |
| Get Size Recommendation | Select Garment and Size | التوصية تُحسب لقطعة ومقاس محددين |
| Get Size Recommendation | Compare Body and Garment Measurements | النتيجة تُستخرج من المقارنة دائماً |
| Register Store | Enter Store Information | إلزامي للتسجيل |
| Register Store | Enter Contact Information | إلزامي ليتواصل الزبائن مع المتجر |
| Register Store | Set Store Location | إلزامي لعرض المتجر على الخريطة |
| Add Product | Enter Product Name | إلزامي |
| Add Product | Enter Product Description | إلزامي |
| Add Product | Set Product Price | إلزامي |
| Add Product | Upload Front and Back Product Images | إلزامي للعرض، ومطلوب لتجهيز النموذج |
| Add Product | Specify Available Sizes | إلزامي |
| Add Product | Enter Measurements for Each Size | إلزامي، لأن التوصية تعتمد عليه |
| Add Product | Set Available Quantities | إلزامي لمعرفة التوفر |

### Extend (السهم من الإضافية إلى الأساسية)
| Use Case الإضافية | Use Case الأساسية | السبب |
|---|---|---|
| Search Stores | Browse Stores and View Locations | اختياري أثناء التصفح |
| Contact Store | View Store Information | اختياري بعد الاطلاع على معلومات المتجر |
| Search Products | Browse Products | اختياري |
| Filter Products | Browse Products | اختياري |
| Add Social Media Links | Register Store | ليس كل متجر يملك حسابات تواصل |
| Update Store Details / Contact Information / Social Media Links / Store Location (4) | Update Store Information | تحديث جزئي: يعدّل صاحب المتجر ما يحتاجه فقط |
| Link 3D Garment Model | Add Product | النموذج قد لا يكون جاهزاً لحظة الإضافة (5-ج) |
| Update Product Name / Description / Price / Images / Available Sizes / Measurements / Quantities / 3D Garment Model (8) | Update Product Information | تحديث جزئي |

### Association
- **Visitor (5)**: Browse Stores and View Locations, View Store Information, Browse Products, View Product Details, Register Customer.
- **Registered Customer (9)**: Login, Logout, Set Clothing Preferences, View Personalized Stores and Products, Generate 3D Avatar, Update Body Measurements, Virtual Try-On, Get Size Recommendation, View Suggested Outfit Combinations.
- **Shop Owner (8)**: Register Shop Owner Account, Login, Logout, Register Store, Update Store Information, Add Product, Update Product Information, Delete Product.

---

## 5. القرارات والتعارضات مع الطلب

**أ. ربطت Register Customer بالزائر، مع أن الطلب وضعها تحت Registered Customer.**
من يملك حساباً لا ينشئ حساباً؛ المستخدم الذي ينشئ الحساب هو الزائر. ربطها بالزبون المسجل خطأ منطقي يُسأل عنه في المناقشة. Login و Logout بقيتا للزبون المسجل.

**ب. «تحديث بيانات المنتج» و«تحديث بيانات المتجر» تستخدمان Extend وليس Include.**
التحديث الفعلي جزئي، فصاحب المتجر قد يغيّر السعر فقط. لو استُخدم include لأصبح كل تحديث يفرض تعديل الاسم والوصف والصور والمقاسات والكميات والنموذج معاً، وهذا خطأ. الطلب نفسه يسمح بهذا البديل («لا تجعل كل عمليات تحديث المنتج إلزامية»).
- أبقيت كل عملية فرعية في Oval مستقلة كما طلبتم.
- تركتها extend ولم أحوّلها إلى Use Cases مرتبطة مباشرة بصاحب المتجر، لأن الربط المباشر يضيف 12 خط Association ويفصل العمليات عن سياقها (اختيار المنتج أو المتجر ثم الحفظ).

**ج. Link 3D Garment Model تستخدم Extend وليس Include.**
- الطلب ذكرها ضمن include، لكنه طلب أيضاً توضيح الأمر إذا لم تكن إلزامية لكل المنتجات.
- الدليل من وصف المشروع نفسه: «بعد اكتمال بيانات القطعة **وربط نموذجها**، تصبح القطعة متاحة للمعاينة». هذا يعني وجود منتجات بلا نموذج (معروضة لكنها غير متاحة للمعاينة). لو كان الربط include، لكانت كل المنتجات متاحة للمعاينة دائماً، ولا معنى لعبارة «بعد الربط».
- النموذج قد يُجهَّز لاحقاً في جزء الملابس، فيُربط عبر Update 3D Garment Model.
- **إذا أكد الفريق أن كل منتج لا يُنشر إلا مع نموذجه**، تتحول العلاقة إلى include بتغيير اتجاه سهم واحد.

**د. «Enter Store Information» ليست كل بيانات المتجر.** الطلب منع جمع بيانات المتجر في Oval واحدة، لذلك تشمل «Enter Store Information» الاسم والوصف فقط. التواصل والروابط والموقع في Ovals مستقلة.

**هـ. «Add Social Media Links» تستخدم extend** وفق الاستثناء الذي ذكرتموه (الروابط اختيارية). إذا كانت إلزامية، تتحول إلى include.

**و. نوع القماش**: لم يُضف كـ Use Case. هو حقل اختياري يُكتب ضمن Enter Product Description.

**ز. Update Body Measurements**: Association مستقلة، بلا علاقة مع Generate 3D Avatar، كما طلبتم. تحديث القياسات يحدّث الـ Avatar المحفوظ.

**ح. View Garment on Avatar**: include من Virtual Try-On، لأن عرض القطعة على الـ Avatar هو نتيجة المعاينة في كل تنفيذ. لا تُربط بالزبون مباشرة حتى لا تتكرر.

**ط. Get Size Recommendation**: مستقلة عن Virtual Try-On ولا علاقة بينهما، كما طلبتم. النتيجة تقديرية وموضّحة في Note.

**ي. View Personalized Stores and Products**: مستقلة عن Set Clothing Preferences، وشرطها المسبق وجود تفضيلات محفوظة. لم أضع include بينهما حتى لا يُفرض تحديد التفضيلات في كل مرة.

**ك. Login**: ليست include في أي حالة. هي شرط مسبق لوظائف الزبون المسجل وصاحب المتجر.

**ل. Login و Logout مشتركتان**: Oval واحدة لكل منهما مرتبطة بالزبون المسجل وصاحب المتجر، حتى لا تتكرر الوظيفة.

---

## 6. الملفات
| الملف | الوصف |
|---|---|
| `AuraLook_UseCase_v4.png` | صورة المخطط (7200×4770) |
| `AuraLook_UseCase_v4.svg` | نسخة متجهة تُكبّر بلا فقدان جودة |
| `AuraLook_UseCase_v4.puml` | كود PlantUML، مولَّد من بيانات الصورة نفسها فالعناصر والعلاقات متطابقة (ترتيب المحرك التلقائي قد يختلف شكلياً) |
| `gen_v4.py` | سكربت توليد الصورة لتعديل المواقع |

**إعادة الإنشاء في Visual Paradigm**: استخدم الجداول في القسمين 3 و4 بالترتيب: Actors ← System «AuraLook System» ← Use Cases ← Associations ← Include (اسحب من الأساسية) ← Extend (اسحب من الإضافية) ← Generalization (من Registered Customer إلى Visitor). رتّب العمليات الفرعية لكل منتج في صفين (4 فوق و4 تحت الحالة الأساسية) كما في الصورة، فهذا يمنع تقاطع الأسهم.

---

## 7. افتراضات تحتاج تأكيد الفريق
1. **Register Customer** مرتبطة بالزائر (5-أ).
2. **ربط النموذج ثلاثي الأبعاد** اختياري عند الإضافة (5-ج). هل يُسمح بنشر منتج دون نموذج؟
3. **مصدر النموذج**: هل يُربط نموذج جاهز (Link)، أم يُولَّد داخل النظام من الصور الأمامية والخلفية (Generate)؟ (يغيّر الاسم فقط.)
4. **روابط التواصل الاجتماعي** اختيارية (5-هـ).
5. **نوع القماش**: هل هو حقل مطلوب؟ ومكانه ضمن الوصف أم حقل مستقل في النموذج؟
6. **التوصية**: هل تقيّم المقاس الذي يختاره الزبون (المفترض، لأن النتيجة مناسب/ضيق/واسع/غير مناسب)، أم يقترح النظام المقاس الأنسب؟
7. **قبول المتاجر**: لا يوجد Admin. هل يظهر المتجر تلقائياً بعد التسجيل؟
8. **التفضيلات**: هل تُطلب إلزامياً بعد إنشاء الحساب، أم يحددها الزبون متى شاء (المفترض)؟
