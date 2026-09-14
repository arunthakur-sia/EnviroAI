// CR05 section 6: access model strings.
import fs from "node:fs";

const en = {
  common: { copy: "Copy" },
  shell: {
    previewBanner: "Previewing as {label}. Read-only: nothing can be changed.",
    previewExit: "Exit preview",
  },
  login: {
    accountLocked: "This account is locked for 15 minutes after repeated failed attempts.",
  },
  profile: {
    signOutAll: "Sign out of all devices",
    signOutAllHint: "Ends every active session for this account, including this one.",
    signOutAllCta: "Sign out everywhere",
  },
  invite: {
    title: "You are invited to SiaNexus",
    hello: "Welcome, {name}. Set your password to activate the account.",
    invalid: "This invitation is not valid",
    invalidHint: "It may have expired (links last 7 days) or been revoked. Ask your administrator for a new one.",
    password: "Password",
    confirm: "Confirm password",
    policy: "At least 12 characters, with at least one letter and one digit.",
    acceptableUse:
      "I will use SiaNexus for National Planning Council work, respect document classifications, and never share my account.",
    cta: "Activate account",
    errors: {
      mismatch: "The passwords do not match.",
      too_short: "The password needs at least 12 characters.",
      needs_letter: "Add at least one letter.",
      needs_digit: "Add at least one digit.",
      too_common: "That password is too common; choose another.",
      invalid_invite: "This invitation is no longer valid.",
      user_exists: "This account already exists; sign in instead.",
      generic: "Something went wrong. Try again.",
    },
  },
  settings: {
    tabs: { access: "Access" },
    accessCol: "Access",
    previewAs: "Preview as",
    portals: {
      home: "Home",
      vault: "Vault",
      strategy: "Strategy",
      statistics: "Statistics",
      indices: "Indices",
      trends: "Trends",
      ask: "Ask",
      lessons: "Lessons",
      podcast: "Cast",
      experts: "Experts",
      hr: "HR",
      settings: "Settings",
    },
    access: {
      title: "Access: {name}",
      scope: "Department scope",
      scopeAll: "All departments",
      scopeOwn: "Own department",
      reason: "Reason for the next override",
      reasonPlaceholder: "Why this exception exists",
      expiry: "Expiry (optional)",
      cycleHint:
        "Click a portal or matrix cell to cycle: role default, then grant, then deny, then back to the role default. The reason and expiry above are attached to the next click.",
      portals: "Portal visibility",
      sources: { role: "role", grant: "grant", deny: "deny", none: "off" },
      overridesTitle: "Active overrides",
      auditTitle: "Audit trail",
      noAudit: "No access changes recorded yet.",
      overrideSaved: "Override saved",
      domainsTitle: "Allowed sign-in domains",
      domainsHint:
        "Only these email domains can sign in or be invited. The login form answers with a neutral message for anything else.",
      addDomain: "Add domain",
      removeDomain: "Remove {domain}",
      domainsSaved: "Domains saved",
      inviteTitle: "Invite users",
      inviteEmail: "Email",
      inviteName: "Name",
      inviteRole: "Role",
      inviteDepartment: "Department",
      inviteClearance: "Clearance",
      inviteCta: "Create invitation",
      csvTitle: "Or paste CSV (email, name, role, clearance)",
      csvPlaceholder: "maryam.x@npc.qa, Maryam X, Contributor, 2",
      csvCta: "Invite all rows",
      invitesCreated: "{count} invitation(s) created",
      someRejected: "{count} row(s) rejected (domain or existing account)",
      linksTitle: "Invitation links (no mail server locally; share these directly, they are also logged)",
      linkCopied: "Link copied",
      copyLink: "Copy link",
      revoke: "Revoke",
      status: "Status",
      expires: "Expires",
      actions: "Actions",
      inviteStatus: { pending: "Pending", accepted: "Accepted", expired: "Expired", revoked: "Revoked" },
      noInvites: "No invitations yet.",
      selfRegistrationNote:
        "Self-registration is disabled: accounts exist only through these invitations.",
    },
  },
};

const ar = {
  common: { copy: "نسخ" },
  shell: {
    previewBanner: "أنت تعاين بصفة {label}. وضع قراءة فقط: لا يمكن تغيير شيء.",
    previewExit: "إنهاء المعاينة",
  },
  login: {
    accountLocked: "قُفل هذا الحساب لمدة 15 دقيقة بعد محاولات فاشلة متكررة.",
  },
  profile: {
    signOutAll: "تسجيل الخروج من جميع الأجهزة",
    signOutAllHint: "ينهي كل الجلسات النشطة لهذا الحساب، بما فيها هذه الجلسة.",
    signOutAllCta: "خروج من كل مكان",
  },
  invite: {
    title: "أنت مدعو إلى سيا نكسس",
    hello: "أهلًا {name}. عيّن كلمة المرور لتفعيل الحساب.",
    invalid: "هذه الدعوة غير صالحة",
    invalidHint: "قد تكون انتهت (تصلح الروابط 7 أيام) أو أُلغيت. اطلب من المسؤول دعوة جديدة.",
    password: "كلمة المرور",
    confirm: "تأكيد كلمة المرور",
    policy: "12 حرفًا على الأقل، وفيها حرف ورقم على الأقل.",
    acceptableUse:
      "سأستخدم سيا نكسس لأعمال المجلس الوطني للتخطيط، وأحترم تصنيفات الوثائق، ولن أشارك حسابي مع أحد.",
    cta: "تفعيل الحساب",
    errors: {
      mismatch: "كلمتا المرور غير متطابقتين.",
      too_short: "تحتاج كلمة المرور إلى 12 حرفًا على الأقل.",
      needs_letter: "أضف حرفًا واحدًا على الأقل.",
      needs_digit: "أضف رقمًا واحدًا على الأقل.",
      too_common: "كلمة المرور هذه شائعة جدًا؛ اختر غيرها.",
      invalid_invite: "لم تعد هذه الدعوة صالحة.",
      user_exists: "هذا الحساب موجود بالفعل؛ سجّل الدخول.",
      generic: "حدث خطأ ما. حاول مجددًا.",
    },
  },
  settings: {
    tabs: { access: "الوصول" },
    accessCol: "الوصول",
    previewAs: "معاينة بصفته",
    portals: {
      home: "الرئيسية",
      vault: "المستودع",
      strategy: "الاستراتيجية",
      statistics: "الإحصاءات",
      indices: "المؤشرات",
      trends: "الاتجاهات",
      ask: "اسأل",
      lessons: "الدروس",
      podcast: "البودكاست",
      experts: "الخبراء",
      hr: "الموارد البشرية",
      settings: "الإعدادات",
    },
    access: {
      title: "وصول: {name}",
      scope: "نطاق الإدارة",
      scopeAll: "كل الإدارات",
      scopeOwn: "إدارته فقط",
      reason: "سبب الاستثناء التالي",
      reasonPlaceholder: "لماذا يوجد هذا الاستثناء",
      expiry: "تاريخ الانتهاء (اختياري)",
      cycleHint:
        "انقر على أي بوابة أو خلية في المصفوفة للتبديل: افتراضي الدور، ثم منح، ثم منع، ثم العودة للافتراضي. يُرفَق السبب والتاريخ أعلاه بالنقرة التالية.",
      portals: "ظهور البوابات",
      sources: { role: "الدور", grant: "منح", deny: "منع", none: "مغلق" },
      overridesTitle: "الاستثناءات الفعالة",
      auditTitle: "سجل التدقيق",
      noAudit: "لا تغييرات وصول مسجلة بعد.",
      overrideSaved: "حُفظ الاستثناء",
      domainsTitle: "نطاقات البريد المسموح بها",
      domainsHint:
        "لا يدخل ولا يُدعى إلا من يحمل هذه النطاقات، ويرد نموذج الدخول برسالة محايدة لغيرها.",
      addDomain: "إضافة نطاق",
      removeDomain: "إزالة {domain}",
      domainsSaved: "حُفظت النطاقات",
      inviteTitle: "دعوة مستخدمين",
      inviteEmail: "البريد",
      inviteName: "الاسم",
      inviteRole: "الدور",
      inviteDepartment: "الإدارة",
      inviteClearance: "التصنيف",
      inviteCta: "إنشاء دعوة",
      csvTitle: "أو الصق CSV (البريد، الاسم، الدور، التصنيف)",
      csvPlaceholder: "maryam.x@npc.qa, مريم، مساهم، 2",
      csvCta: "دعوة كل الصفوف",
      invitesCreated: "أُنشئت {count} دعوة",
      someRejected: "رُفض {count} صفًا (نطاق غير مسموح أو حساب موجود)",
      linksTitle: "روابط الدعوة (لا خادم بريد محليًا؛ شاركها مباشرة، وهي مسجلة أيضًا)",
      linkCopied: "نُسخ الرابط",
      copyLink: "نسخ الرابط",
      revoke: "إلغاء",
      status: "الحالة",
      expires: "تنتهي",
      actions: "إجراءات",
      inviteStatus: { pending: "معلقة", accepted: "قُبلت", expired: "منتهية", revoked: "ملغاة" },
      noInvites: "لا دعوات بعد.",
      selfRegistrationNote: "التسجيل الذاتي معطل: لا تُنشأ الحسابات إلا عبر هذه الدعوات.",
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
