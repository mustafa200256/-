/* =====================================================================
   العراق AI — إعدادات تجربة الإطلاق
   تطوير: مصطفى حسين — Mustafa Hussein

   كل ما يمكنك تعديله بسهولة موجود في هذا الملف:
     1) IRAQ_AI_URL      ← رابط موقع العراق AI (الأهم)
     2) AUDIO            ← مسار ملف الموسيقى وحجم الصوت
     3) t                ← توقيتات المشاهد بالميلي ثانية
     4) keys             ← منحنيات الشدة والتباطؤ والتخطيط
     5) texts            ← كل النصوص الظاهرة
   ===================================================================== */
(function (global) {
  'use strict';

  /* ★★★★★  ضع رابط العراق AI الحقيقي هنا  ★★★★★
     يجب أن يبدأ بـ https:// أو http://
     مثال على الصيغة فقط (ليس رابطاً مفعّلاً): "https://example.com"
     وهو فارغ عمداً الآن، وإلى أن تضع الرابط يبقى زر «جرّب العراق AI الآن»
     معطّلاً ويظهر تنبيه واضح للمطوّر بدل فتح صفحة فارغة. */
  const IRAQ_AI_URL = "https://www.mustafaai.top";

  /* فتح الرابط في تبويب جديد (مع noopener noreferrer) أم في نفس التبويب */
  var OPEN_IN_NEW_TAB = true;

  /* ---------- الصوت ---------- */
  var AUDIO = {
    enabled: true,
    /* ضع ملفك هنا: assets/audio/iraq-ai-theme.mp3 (أو .ogg).
       يُجرَّب بالترتيب، وإن لم يوجد يعمل صوت احتياطي مولَّد داخل المتصفح. */
    sources: ["assets/audio/iraq-ai-theme.mp3", "assets/audio/iraq-ai-theme.ogg"],
    volume: 0.9,
    loadTimeoutMs: 4000
  };

  /* ---------- التوقيتات (بالميلي ثانية من لحظة بدء الصوت) ----------
     إن استبدلت الموسيقى بملفك الخاص، عدّل هذه الأرقام لتطابق لحظات
     الصمت والـ Drop في مقطوعتك. */
  var T = {
    beatsStart: 2600,     // أول نبضة قلب
    heartFull: 3300,      // اكتمال ظهور القلب
    questionIn: 9000,     // ظهور «عبالكم نتأخر بمشاريعنا؟»
    buildUp: 15000,       // تصاعد الكثافة
    slowStart: 23000,     // بدء تباطؤ القلب
    questionOut: 23600,   // اختفاء السؤال
    silenceStart: 24200,  // لحظة الصمت
    deepBeat: 24850,      // النبضة العميقة
    impact: 25400,        // الانفجار + الـ Drop + الرقم 1
    revealText: 26200,    // «هذا مشروعنا الأول كمل»
    numberRelease: 28600, // تفكك جسيمات الرقم 1
    revealTextOut: 29000, // انتقال النص إلى القسم الختامي
    logoIn: 29200,        // ظهور «العراق AI»
    layoutShiftStart: 29200, // صعود القلب ليصبح خلفية الشعار
    subIn: 31000,         // «واحد من ثلاثة… والباقي بالطريق.»
    kickerIn: 32600,      // «من أرض الحضارات…»
    lineIn: 33800,        // «هذا مشروعنا الأول كمل. والباقي بالطريق.»
    ctaIn: 34500,         // زر العراق AI
    signatureIn: 36000,   // توقيع المطوّر
    idleStart: 36500      // نبضات هادئة مستمرة بعد الانتهاء
  };

  /* ---------- منحنيات الحالة: [الزمن، القيمة] مع تنعيم بينها ---------- */
  var KEYS = {
    appear:    [[0, 0], [T.heartFull, 1]],
    intensity: [[0, 0.12], [T.beatsStart, 0.35], [T.heartFull + 300, 0.55], [T.questionIn, 0.65],
                [T.buildUp, 0.9], [22800, 1.2], [T.silenceStart - 200, 0.35], [T.impact - 100, 0.3],
                [T.impact, 1.7], [27500, 1.05], [30000, 0.8], [34000, 0.75]],
    timeScale: [[0, 1], [T.slowStart, 1], [T.silenceStart - 300, 0.3], [T.impact - 100, 0.28], [T.impact + 50, 1]],
    heartAlpha:[[0, 1], [T.impact, 1], [T.impact + 300, 0.28], [T.numberRelease, 0.28], [T.numberRelease + 1600, 0.7]],
    layout:    [[0, 0], [T.layoutShiftStart, 0], [T.layoutShiftStart + 1800, 1]]
  };

  /* ---------- النصوص ---------- */
  var TEXTS = {
    introLine: "ثواني بس… عندنا شي نريدكم تشوفو.",
    start: "ابدأ التجربة 🔥",
    introHint: "للتجربة الكاملة شغّل صوت جهازك 🎧",
    question: "عبالكم نتأخر بمشاريعنا؟ 👀",
    reveal: "هذا مشروعنا الأول كمل ❤️‍🔥",
    logoName: "العراق",
    logoAi: "AI",
    sub: "واحد من ثلاثة… والباقي بالطريق.",
    kicker: "من أرض الحضارات… إلى مستقبل الذكاء الاصطناعي.",
    finalLine: "هذا مشروعنا الأول كمل. والباقي بالطريق.",
    cta: "جرّب العراق AI الآن ←",
    replay: "↻ أعد التجربة",
    skip: "تخطي",
    devWarn: "⚠️ للمطوّر: لم يُضف رابط العراق AI بعد. افتح js/config.js وضع الرابط (يبدأ بـ https://) في المتغيّر IRAQ_AI_URL.",
    ctaDisabledToast: "زر العراق AI غير مفعّل بعد: لم يُضف الرابط في js/config.js.",
    audioMissing: "لم يُعثر على ملف الموسيقى، يعمل صوت احتياطي مولَّد داخل المتصفح.",
    audioUnsupported: "الصوت غير مدعوم في هذا المتصفح؛ التجربة تعمل بدونه.",
    retry: "إعادة المحاولة",
    muteOn: "كتم الصوت",
    muteOff: "تشغيل الصوت",
    footer: "العراق AI · تطوير مصطفى حسين · Mustafa Hussein",
    signatureEn: "Developed by Mustafa Hussein",
    signatureAr: "تطوير مصطفى حسين"
  };

  /* ---------- نبضات القلب (تُولَّد من التوقيتات؛ تتزامن مع الصوت والمرئيات) ----------
     s = قوة النبضة. deep = النبضة العميقة قبل الانفجار. */
  function buildBeats() {
    var beats = [];
    var t = T.beatsStart, end = 22800, gapStart = 1050, gapEnd = 470;
    while (t < end) {
      var p = (t - T.beatsStart) / (end - T.beatsStart);
      beats.push({ t: Math.round(t), s: 0.55 + 0.4 * p });          // «لَبّ»
      beats.push({ t: Math.round(t + 170), s: 0.35 + 0.3 * p });    // «دَبّ»
      t += gapStart + (gapEnd - gapStart) * p;
    }
    beats.push({ t: 23500, s: 0.9 });
    beats.push({ t: 23670, s: 0.6 });
    beats.push({ t: T.deepBeat, s: 1.15, deep: true });
    return beats;
  }

  global.IRAQ_CONFIG = {
    IRAQ_AI_URL: IRAQ_AI_URL,
    OPEN_IN_NEW_TAB: OPEN_IN_NEW_TAB,
    AUDIO: AUDIO,
    t: T,
    keys: KEYS,
    texts: TEXTS,
    beats: buildBeats()
  };
})(window);
