# STAMP — الإعداد

آخر تحديث: 28 نوفمبر 2026. الموقع: **https://www.stamppassport.app**

## ✅ خلص

- **الموقع:** صار على الدومين تبعك www.stamppassport.app، والعنوان القديم stamp-gilt.vercel.app ما عاد يشتغل.
- **قاعدة البيانات:**
  - كل الجداول موجودة.
  - انضافت جداول الأفلام القصيرة.
  - الكتالوج (50 عمل) موجود.
- **كود الدخول:** صار 6 أرقام. كان 8، والتطبيق ما كان يقبله.
- **البحث:** الأفلام والمسلسلات والألعاب تطلع بدون مفاتيح:
  - الأفلام والألعاب من Wikidata.
  - المسلسلات من TVmaze.
- **الأصوات:** صارت تشتغل على الآيفون والأندرويد.
  - لو زر الصامت بجنب الآيفون مفعّل، ما بيطلع صوت، زي صوت الكيبورد بالضبط.

---

## 1. إيميل التحقق (لازم) · 5 دقايق

نسخة Supabase المجانية ما ترسل إيميلات إلا لأعضاء فريقك، وبحد أقصى إيميلين بالساعة. عشان توصل الإيميلات لكل الناس، لازم نربطها بإيميل خاص. أسهل طريقة Gmail.

1. يفضّل تسوي Gmail جديد للتطبيق، عشان ما يبين إيميلك الشخصي للناس.
2. فعّل التحقق بخطوتين: https://myaccount.google.com/signinoptions/twosv
3. سوّ App password:
   1. افتح https://myaccount.google.com/apppasswords
   2. اكتب الاسم `STAMP` واضغط Create.
   3. انسخ الـ16 حرف.
4. افتح Supabase ← مشروع **Stamp** ← Authentication ← Emails ← **SMTP Settings** ← فعّل Enable custom SMTP، وعبّي:

   | الخانة | القيمة |
   | --- | --- |
   | Sender email | الـ Gmail |
   | Sender name | `STAMP` |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | الـ Gmail |
   | Password | الـ16 حرف |

   ثم اضغط **Save**.
5. قلّي «خلصت». أنا أركّب شكل الإيميل (الكود + الرابط) وأرفع حد الإرسال.
   - لو بتسويها بنفسك: الصق محتوى `supabase/templates/sign-in.html` بقالب **Magic link** وقالب **Confirm signup**.

## 2. المفاتيح في Vercel (اختياري، بس أحسن)

افتح Vercel ← مشروع **stamp** ← Settings ← Environment Variables ← Add. اختار Production وأضف:

| الاسم | من وين | ليش |
| --- | --- | --- |
| `TMDB_API_KEY` | themoviedb.org ← Settings ← API | نتائج أفلام ومسلسلات أدق، مع وصف لكل عمل |
| `RAWG_API_KEY` | rawg.io/apidocs (عندك واحد) | ألعاب مع مدة اللعب |
| `ANTHROPIC_API_KEY` | console.anthropic.com ← API Keys | الأرشيفي والدبلوماسي بالذكاء الاصطناعي |

بعدها قلّي وأنا أعيد النشر، أو افتح Deployments ← آخر واحد ← Redeploy.

> لا تحط أي مفتاح بالشات ولا بالكود. مكانها Vercel بس.

## 3. لما نخلص: احذف التوكنات

- Vercel: https://vercel.com/account/settings/tokens ← `Claude STAMP` ← Delete
- Supabase: https://supabase.com/dashboard/account/tokens ← `Claude STAMP` ← Revoke

---

## لو بدك تشغّل Claude على جهازك

افتح Claude Code بمجلد المشروع `C:\Users\moham\Projects\Stamp` والصق هذا:

```
اقرأ HANDOFF.md و SETUP.md، وسوّ git pull.
مشروع Supabase: ollqrvvmuhigysawfofy. مشروع Vercel: stamp (team lisanfault). الموقع: https://www.stamppassport.app
1. سجّل دخول: npx supabase login ثم npx supabase link --project-ref ollqrvvmuhigysawfofy
2. تأكد إن كل المايقريشنز مطبّقة (npx supabase migration list).
3. بعد ما أوصل SMTP بالداشبورد: حط supabase/templates/sign-in.html بقالب Magic link وقالب Confirm signup، والعنوان "Your STAMP code"، وخلي حد الإيميلات 30 بالساعة.
4. ساعدني أضيف TMDB_API_KEY و RAWG_API_KEY و ANTHROPIC_API_KEY في Vercel. أنا أكتب القيم بنفسي، لا تطلبها مني بالشات.
5. أعد النشر، وتأكد إن https://www.stamppassport.app/api/media/search?q=dune&kind=film يرجّع نتائج.
```
