// Working-translation display dictionary for the Arabic reference values
// recorded in NCEC dummy records (regions, sectors, statuses...). This is
// decision #4 of ui-plan.md s0: it is a display aid, not the register's own
// bilingual data, so every entry is a working translation. City names are
// deliberately left untranslated here, in Arabic, even in English mode:
// there are too many to hand-translate reliably without risking an
// incorrect place name, so showing the authentic register value was judged
// safer than guessing (noted in the implementation report).
//
// Deliberately NOT server-only: this is a static display dictionary with no
// secrets, and the NcecTable client component needs it to translate cell
// values in the browser.

const DICTIONARY: Record<string, string> = {
  // regions (DMO-005 / DMO-264 / DMO-419 ...)
  الرياض: "Riyadh Region",
  "مكة المكرمة": "Makkah Region",
  "المدينة المنورة": "Madinah Region",
  القصيم: "Qassim Region",
  "المنطقة الشرقية": "Eastern Region",
  عسير: "Asir Region",
  تبوك: "Tabuk Region",
  حائل: "Hail Region",
  "الحدود الشمالية": "Northern Borders Region",
  جازان: "Jazan Region",
  نجران: "Najran Region",
  الباحة: "Al-Baha Region",
  الجوف: "Al-Jouf Region",
  // sectors (DMO-012)
  "الموارد الطبيعية": "Natural Resources",
  "النقل والخدمات اللوجستية": "Transport & Logistics",
  "التطوير الحضري": "Urban Development",
  "الصناعة والتعدين": "Industry & Mining",
  "الطاقة والبتروكيماويات": "Energy & Petrochemicals",
  // permit status (DMO-019) and type (DMO-016)
  ساري: "Active",
  "قيد التجديد": "Under renewal",
  منتهي: "Expired",
  "تصريح تشغيل": "Operating permit",
  "تصريح إنشاء": "Establishment permit",
  // yes / no (DMO-257)
  نعم: "Yes",
  لا: "No",
  // violation severity, DMO-277 (register names the field "type"; the
  // values read as a severity scale — ui-plan.md decision #6)
  جسيمة: "Major",
  متوسطة: "Moderate",
  بسيطة: "Minor",
  // inspection visit type (DMO-259)
  دورية: "Periodic",
  متابعة: "Follow-up",
  مفاجئة: "Surprise",
  "بناءً على بلاغ": "Complaint-based",
  // contamination severity class (DMO-427; "متوسطة" shared with violation severity above)
  حرجة: "Critical",
  منخفضة: "Low",
  عالية: "High",
  // violation name, DMO-276 ("by type" chart)
  "سوء التعامل مع النفايات الخطرة": "Improper handling of hazardous waste",
  "عدم تنفيذ الخطة التصحيحية في موعدها": "Corrective plan not completed on time",
  "تجاوز الحدود المسموحة للانبعاثات": "Emission limit exceedance",
  "تجاوز حدود الضوضاء المسموحة": "Noise limit exceedance",
  "عدم تقديم التقارير البيئية الدورية": "Periodic environmental reports not submitted",
  "تصريف مياه غير مطابقة للمعايير": "Non-compliant water discharge",
  "تشغيل نشاط دون تصريح بيئي ساري": "Operating without a valid environmental permit",
  "عدم تركيب أجهزة الرصد المستمر للانبعاثات": "Continuous emission monitors not installed",
};

const FACILITY_NAME = /^منشأة تجريبية\s*0*(\d+)$/;

/** Translates one Arabic reference value for English mode. Returns the
    original text unchanged in Arabic mode, or when no translation is known
    (city names, free text). */
export function translateValue(locale: string, value: string | null | undefined): string {
  if (!value) return "";
  if (locale !== "en") return value;
  const facility = value.match(FACILITY_NAME);
  if (facility) return `Dummy facility ${facility[1].padStart(3, "0")}`;
  return DICTIONARY[value] ?? value;
}
