// HTML string builders for the BIO BOT chat bubbles.
// Pure functions: (data) -> html string. No React, no state — keep flow logic in Bot.jsx.

const SECRETARY_PHONE = "04-9901927";
const SECRETARY_EMAIL = "nataliav@braude.ac.il";

// Reserves (מילואים) flow: button markup is data, not code. Edit the tables, not HTML.
const RESERVES_BTN =
  "px-3 py-1.5 rounded-full border border-bio-green bg-surface-card text-bio-green text-xs font-medium hover:bg-surface-raised transition-colors shadow-sm";
const RESERVES_DAY_BTN = `${RESERVES_BTN} w-full text-right`;

const RESERVES_MITVOT = [
  { key: "mitve_tashpah_sem_a", label: "מתווה תשפד - סמסטר א", display: 'מתווה תשפ"ד - סמסטר א\'' },
  { key: "mitve_tashpah_sem_b", label: "מתווה תשפד - סמסטר ב", display: 'מתווה תשפ"ד - סמסטר ב\'' },
  { key: "mitve_tashpeh_sem_a", label: "מתווה תשפה - סמסטר א", display: 'מתווה תשפ"ה - סמסטר א\'' },
  { key: "mitve_tashpeh_sem_b", label: "מתווה תשפה - סמסטר ב", display: 'מתווה תשפ"ה - סמסטר ב\'' },
  { key: "mitve_tashpuv_sem_a", label: "מתווה תשפו - סמסטר א", display: 'מתווה תשפ"ו - סמסטר א\'' },
];

const RESERVES_GROUPS = {
  mitve_tashpah_sem_a: [
    { key: "group_1", label: "קבוצה 1", text: "שורתו 7 ימים או יותר מתחילת הסמסטר" },
    { key: "group_2", label: "קבוצה 2", text: "שורתו עד 7 ימים מתחילת הסמסטר" },
    { key: "group_3", label: "קבוצה 3", text: "בני/בנות זוג של מילואימניק/ית" },
    { key: "group_4", label: "קבוצה 4", text: "נפגעו בצורה משמעותית וממושכת מהמצב" },
    { key: "group_5", label: "קבוצה 5", text: "שאר הסטודנטים (ללא שירות מילואים)" },
  ],
  mitve_tashpah_sem_b: [
    { key: "group_11", label: "קבוצה 11", text: "שירות במילואים לתקופה של 100 ימים לפחות" },
    { key: "group_22", label: "קבוצה 22", text: "שירות במילואים לתקופה של 61 עד 99 ימים" },
    { key: "group_33", label: "קבוצה 33", text: "שירות במילואים לתקופה של 30 עד 60 ימים" },
    { key: "group_44", label: "קבוצה 44", text: "סטודנטים ובני זוג שנפגעו בצורה משמעותית ומפונים" },
  ],
  mitve_tashpeh_sem_a: [
    { key: "group_111", label: "קבוצה 111", text: "שירות של 35 ימים ומעלה במצטבר / משרתים בקבע ייעודי קדמי" },
    { key: "group_222", label: "קבוצה 222", text: "סטודנטים השייכים לאחת מהקבוצות עם הורות לילד עד גיל 13" },
    { key: "group_333", label: "קבוצה 333", text: "שירות במילואים של פחות מ-21 ימים במצטבר במהלך הסמסטר" },
    { key: "group_444", label: "קבוצה 444", text: "נפגעו בצורה משמעותית במלחמה ומפונים, כולל בני/בנות זוג" },
  ],
  mitve_tashpeh_sem_b: [
    { key: "group_111", label: "קבוצה 111", text: "שירות של 35 ימים ומעלה במצטבר / משרתים בקבע ייעודי קדמי" },
    { key: "group_222", label: "קבוצה 222", text: "סטודנטים השייכים לאחת מהקבוצות עם הורות לילד עד גיל 13" },
    { key: "group_333", label: "קבוצה 333", text: "שירות במילואים של פחות מ-21 ימים במצטבר במהלך הסמסטר" },
    { key: "group_444", label: "קבוצה 444", text: "נפגעו בצורה משמעותית במלחמה ומפונים, כולל בני/בנות זוג" },
    { key: "group_555", label: "קבוצה 5", text: "שירות של 300 ימים ומעלה / לוחמים בייעוד קדמי מעל 200 ימים" },
  ],
  mitve_tashpuv_sem_a: [
    { key: "group_11_v", label: "קבוצה 11", text: "שירות מילואים של 35 ימים ומעלה בסמסטר, סטודנט/ית הורה לילד עד גיל 13, משרתים בקבע ביחידות ייעוד קדמי" },
    { key: "group_22_v", label: "קבוצה 22", text: "שירות מילואים בין 21 ל-35 ימים בסמסטר / מעל 35 ימים בשנה אקדמית / שירות סמוך לתחילת הסמסטר ובמהלכו" },
    { key: "group_33_v", label: "קבוצה 33", text: "משרתי מילואים קצרי טווח (עד 21 ימים בסמסטר) וסטודנטים הורים" },
    { key: "group_44_v", label: "קבוצה 44", text: "פצועי/ות, שורדי/ות, בני משפחה של חללים, מקרים חריגים" },
    { key: "group_55_v", label: "קבוצה 55", text: "קבע ייעוד קדמי / הורים עם בן/בת זוג בשירות מעל 300 ימים מתחילת המלחמה במהלך הלימודים" },
  ],
};

const reservesMitveButtons = () =>
  RESERVES_MITVOT.map(
    (m) => `<button class="${RESERVES_BTN}" onclick="window.handleReservesMitve?.('${m.key}', '${m.label}')">${m.display}</button>`
  ).join("");

const reservesDayButtons = (mitveKey) => {
  const groups = RESERVES_GROUPS[mitveKey];
  if (!groups)
    return `<button class="${RESERVES_BTN}" onclick="window.handleReservesDays('default_reserves', 'שירות מילואים פעיל')">שירות מילואים פעיל</button>`;
  return groups
    .map((g) => `<button class="${RESERVES_DAY_BTN}" onclick="window.handleReservesDays('${g.key}', '${g.label}')">${g.label}: ${g.text}</button>`)
    .join("");
};

export const greetingHtml = () => `
  <div class="space-y-2">
    <div class="text-xl font-bold text-brand-navy">ברוכים הבאים ל-BIO BOT</div>
    <p class="text-gray-700">אני כאן כדי לעזור לך עם מידע אקדמי, קורסים וייעוץ במחלקה.</p>
    <div class="text-sm font-semibold text-bio-green mt-2 font-sans">
      אנא בחר באיזה שנת לימודים התחלת כדי לעזור לך
    </div>
  </div>
`;

export const reservesMitvotPromptHtml = () => `
      <div class="space-y-2 font-sans" dir="rtl">
        <b class="text-brand-navy">עבור איזה מתווה וסמסטר תרצה לבדוק התאמות?</b>
        <div class="flex flex-wrap gap-2 justify-end mt-2">
          ${reservesMitveButtons()}
        </div>
      </div>
    `;

export const reservesDaysPromptHtml = (mitveKey) => `
        <div class="space-y-2 font-sans w-full" dir="rtl">
          <b class="text-brand-navy">לאיזו קבוצת זכאות אתם שייכים לפי תנאי המכללה?</b>
          <div class="flex flex-col gap-2 items-stretch mt-2 max-w-xl">
            ${reservesDayButtons(mitveKey)}
          </div>
        </div>
      `;

export const reservesSavedHtml = () => `
        <div class="space-y-1 font-sans" dir="rtl">
          <b class="text-bio-green">מצוין! שמרתי את פרטי הזכאות שלך.</b>
          <p class="text-sm text-gray-600">עכשיו אתה יכול להקליד כל שאלה חופשית בתיבת הטקסט למטה (למשל: *"מתי מועדי ב'?"* או *"מגיע לי פטור מנוכחות?"*), ואני אבדוק לך את זה ישירות בתוך סעיפי המתווה הרשמיים.</p>
        </div>
      `;

export const requiredCoursesHtml = (courses, sem) => {
  const rows = courses
    .map((c) => {
      const credits = c.credits ? `${c.credits} נ"ז` : 'ללא נ"ז';
      return `
        <div class="rounded-xl border border-surface-border bg-surface-page px-3 py-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-content-primary leading-snug">
              <span class="font-bold">${c.courseName}</span>
              <span class="text-content-muted">(${credits})</span>
            </span>
            <span class="text-xs text-content-muted shrink-0">סימול: <span class="font-mono">${c.courseCode}</span></span>
          </div>
          ${c.relations?.length ? `
            <div class="mt-1 text-xs">
              ${c.relations.map((r) => `
                <span class="inline-block ms-2 font-semibold ${r.type === "PREREQUISITE" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}">
                  · ${r.type === "PREREQUISITE" ? "קדם" : "צמוד"}: ${r.courseName}
                </span>
              `).join("")}
            </div>
          ` : ""}
        </div>
        `;
    })
    .join("");

  return `
        <div class="w-full rounded-2xl border border-surface-border bg-surface-card shadow-lg overflow-hidden font-sans" dir="rtl">
          <div class="bg-brand-navy text-white px-4 py-2.5 flex items-center justify-between">
            <span class="font-bold text-base">קורסי חובה - סמסטר ${sem}</span>
            <span class="text-xs opacity-80">${courses.length} קורסים</span>
          </div>
          <div class="p-3 space-y-2">
            ${rows}
          </div>
        </div>
      `;
};

export const advisorHtml = (a, advisorFormUrl) => `
  <div class="p-3 rounded-2xl border space-y-1.5 font-sans bg-blue-50 border-blue-100 text-gray-800">
    <div class="font-bold text-brand-navy">היועץ האקדמי שלך:</div>
    <div class="text-sm text-gray-800"><b>שם:</b> ${a.name}</div>
    <div class="text-sm text-gray-800">
      <b>מייל:</b>
      <a href="mailto:${a.email}" class="text-bio-green underline">${a.email}</a>
    </div>
    <div class="mt-1.5 text-xs p-2 rounded border bg-white border-blue-50 text-gray-700">
      זכור למלא
      <a href="${advisorFormUrl}" class="underline font-bold text-bio-green">טופס ייעוץ</a>
      לפני הפנייה.
    </div>
  </div>
`;

export const exceptionalRegistrationHtml = (exceptionFormUrl) => `
<div class="rounded-2xl p-4 shadow-sm space-y-3 bg-white border border-blue-100 text-gray-800">
  <div class="text-lg font-bold text-bio-green">רישום או ביטול חריג לקורסים</div>

  <div class="text-sm text-gray-800">
    משתמשים ברישום חריג כאשר <strong>לא ניתן להירשם לקורס דרך תחנת מידע</strong>.
  </div>

  <div class="rounded-xl p-2.5 text-sm space-y-1 bg-blue-50 border border-blue-200">
    <div class="font-semibold mb-1">מתי זה קורה בדרך כלל?</div>
    <div>אין מקום פנוי בקורס</div>
    <div>נכשלת בקורס פעמיים</div>
    <div>מועד הרישום/הביטול הסתיים</div>
  </div>

  <div class="text-sm font-semibold">תהליך הגשת בקשה לרישום חריג:</div>

  <div class="text-sm space-y-2" dir="rtl">
    ${[
      "מורידים את הטופס.",
      "ממלאים פרטי הקורס והסיבה לבקשה.",
      "שולחים מייל מנומס ליועץ ומסבירים את הבקשה שלכם כולל צירוף הטופס.",
      "היועץ מאשר/דוחה את הבקשה וממשיך את הטיפול.",
    ].map((t, i) => `
    <div class="flex items-start gap-3">
      <span class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-brand-navy text-white text-sm font-bold">${i + 1}</span>
      <span>${t}</span>
    </div>`).join("")}
  </div>

  <div class="border-t border-gray-200 pt-2.5 text-sm space-y-1.5">
    <div>
      <strong>טופס רישום/ביטול קורס:</strong><br/>
      <a href="${exceptionFormUrl}" class="underline text-bio-green" target="_blank" rel="noreferrer">להורדת הטופס</a>
    </div>
    <div class="text-gray-700">
      <strong>מזכירות:</strong> ${SECRETARY_PHONE}<br/>
      <strong>מייל:</strong>
      <a class="underline text-bio-green" href="mailto:${SECRETARY_EMAIL}">${SECRETARY_EMAIL}</a>
    </div>
  </div>
</div>
`;
