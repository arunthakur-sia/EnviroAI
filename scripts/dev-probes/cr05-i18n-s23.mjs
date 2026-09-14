// CR05 sections 2-3: merge the new strings into messages/en.json + ar.json.
import fs from "node:fs";

const en = {
  common: { remove: "Remove" },
  strategy: {
    supporting: "Supporting",
    canvas: {
      byLead: "By lead",
      leadFilterAria: "Filter by lead",
      allLeads: "All leads",
      leadDepartments: "NPC departments",
      leadEntities: "Entities",
      leadCounts: "{initiatives} initiatives · {projects} projects",
      leadOnTrack: "{pct}% on track",
    },
    leadsEditor: {
      cta: "Edit leads",
      title: "Leads and supporting entities",
      saved: "Leads saved",
      leads: "Lead department(s) and entity(ies)",
      supporting: "Supporting",
      none: "None yet",
      addDepartment: "Add a lead department",
      pickDepartment: "Choose a department",
      addEntity: "Add an entity",
      entityRole: "Entity role",
      asLead: "As lead",
      asSupporting: "Supporting",
      entityPlaceholder: "Search entities, or type a new name",
      createNew: "Create “{name}”",
    },
    stakeholders: {
      title: "Stakeholders",
      add: "Add stakeholder",
      cancel: "Cancel",
      role: "Role",
      searchPlaceholder: "Search people and experts",
      notePlaceholder: "Role note, for example “methodology advisor” (optional)",
      confirm: "Add",
      empty: "No stakeholders recorded yet.",
      profile: "Profile",
      email: "Email {name}",
      roles: {
        sponsor: "Sponsor",
        owner: "Project Owner",
        manager: "Project Manager",
        team: "Team",
        expert: "Expert involved",
        external_partner: "External partner",
      },
    },
  },
  settings: {
    tabs: { entities: "Entities" },
    entitiesTab: {
      searchPlaceholder: "Search the register",
      count: "{count} entities",
      add: "Add entity",
      name: "Name",
      shortName: "Short name",
      kind: "Kind",
      contact: "Contact",
      status: "Status",
      actions: "Actions",
      arReview: "Arabic to review",
      mergedAway: "Merged",
      active: "Active",
      inactive: "Inactive",
      edit: "Edit",
      merge: "Merge into another entity",
      deactivate: "Deactivate",
      activate: "Activate",
      saved: "Entity saved",
      merged: "Entities merged",
      mergeTitle: "Merge “{name}”",
      mergeHint: "Every lead assignment moves to the entity you choose; this row is kept as a merged alias.",
      pickTarget: "Choose the surviving entity",
      mergeCta: "Merge",
      nameEn: "Name (English)",
      nameAr: "Name (Arabic)",
      shortEn: "Short name (English)",
      shortAr: "Short name (Arabic)",
      website: "Website",
      contactName: "Contact name",
      contactEmail: "Contact email",
      kinds: {
        ministry: "Ministry",
        agency: "Agency",
        authority: "Authority",
        company: "Company",
        international: "International",
        other: "Other",
      },
    },
  },
};

const ar = {
  common: { remove: "إزالة" },
  strategy: {
    supporting: "جهات مساندة",
    canvas: {
      byLead: "حسب الجهة المسؤولة",
      leadFilterAria: "تصفية حسب الجهة المسؤولة",
      allLeads: "كل الجهات",
      leadDepartments: "إدارات المجلس",
      leadEntities: "الجهات",
      leadCounts: "{initiatives} مبادرة · {projects} مشروعًا",
      leadOnTrack: "{pct}% على المسار",
    },
    leadsEditor: {
      cta: "تعديل الجهات المسؤولة",
      title: "الجهات المسؤولة والمساندة",
      saved: "تم حفظ الجهات",
      leads: "الإدارة أو الجهة المسؤولة (يجوز أكثر من واحدة)",
      supporting: "الجهات المساندة",
      none: "لا يوجد بعد",
      addDepartment: "إضافة إدارة مسؤولة",
      pickDepartment: "اختر إدارة",
      addEntity: "إضافة جهة",
      entityRole: "دور الجهة",
      asLead: "جهة مسؤولة",
      asSupporting: "جهة مساندة",
      entityPlaceholder: "ابحث عن جهة، أو اكتب اسمًا جديدًا",
      createNew: "إنشاء “{name}”",
    },
    stakeholders: {
      title: "أصحاب العلاقة",
      add: "إضافة صاحب علاقة",
      cancel: "إلغاء",
      role: "الدور",
      searchPlaceholder: "ابحث عن موظفين وخبراء",
      notePlaceholder: "ملاحظة الدور، مثل “مستشار منهجية” (اختياري)",
      confirm: "إضافة",
      empty: "لم يُسجَّل أصحاب علاقة بعد.",
      profile: "الملف",
      email: "مراسلة {name}",
      roles: {
        sponsor: "الراعي",
        owner: "مالك المشروع",
        manager: "مدير المشروع",
        team: "فريق العمل",
        expert: "خبير مشارك",
        external_partner: "شريك خارجي",
      },
    },
  },
  settings: {
    tabs: { entities: "الجهات" },
    entitiesTab: {
      searchPlaceholder: "ابحث في السجل",
      count: "{count} جهة",
      add: "إضافة جهة",
      name: "الاسم",
      shortName: "الاسم المختصر",
      kind: "النوع",
      contact: "جهة الاتصال",
      status: "الحالة",
      actions: "إجراءات",
      arReview: "العربية بحاجة لمراجعة",
      mergedAway: "مدمجة",
      active: "نشطة",
      inactive: "غير نشطة",
      edit: "تعديل",
      merge: "دمج في جهة أخرى",
      deactivate: "إلغاء التفعيل",
      activate: "تفعيل",
      saved: "تم حفظ الجهة",
      merged: "تم دمج الجهتين",
      mergeTitle: "دمج “{name}”",
      mergeHint: "تنتقل كل مهام الإسناد إلى الجهة التي تختارها، ويبقى هذا الصف اسمًا مدمجًا.",
      pickTarget: "اختر الجهة الباقية",
      mergeCta: "دمج",
      nameEn: "الاسم (بالإنجليزية)",
      nameAr: "الاسم (بالعربية)",
      shortEn: "الاسم المختصر (بالإنجليزية)",
      shortAr: "الاسم المختصر (بالعربية)",
      website: "الموقع الإلكتروني",
      contactName: "اسم جهة الاتصال",
      contactEmail: "بريد جهة الاتصال",
      kinds: {
        ministry: "وزارة",
        agency: "جهاز",
        authority: "هيئة",
        company: "شركة",
        international: "منظمة دولية",
        other: "أخرى",
      },
    },
  },
};

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

for (const [file, patch] of [
  ["messages/en.json", en],
  ["messages/ar.json", ar],
]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  deepMerge(data, patch);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`merged into ${file}`);
}
