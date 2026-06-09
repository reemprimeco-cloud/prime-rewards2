import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "ar";

export interface Translations {
  // Navigation
  nav_dashboard: string;
  nav_rewards: string;
  nav_spin: string;
  nav_invoices: string;
  nav_profile: string;
  nav_referral: string;
  nav_history: string;
  nav_notifications: string;
  nav_sign_out: string;
  nav_my_dashboard: string;

  // Admin Nav
  admin_nav_dashboard: string;
  admin_nav_customers: string;
  admin_nav_invoices: string;
  admin_nav_rewards: string;
  admin_nav_campaigns: string;
  admin_nav_fraud: string;
  admin_nav_settings: string;
  admin_panel: string;
  admin_back_to_site: string;

  // Landing Page
  landing_badge: string;
  landing_headline: string;
  landing_sub: string;
  landing_cta_dashboard: string;
  landing_cta_rewards: string;
  landing_stat_points: string;
  landing_stat_points_label: string;
  landing_stat_spin: string;
  landing_stat_spin_label: string;
  landing_stat_tiers: string;
  landing_stat_tiers_label: string;
  landing_how_title: string;
  landing_step1_title: string;
  landing_step1_desc: string;
  landing_step2_title: string;
  landing_step2_desc: string;
  landing_step3_title: string;
  landing_step3_desc: string;
  landing_tiers_title: string;
  landing_tiers_sub: string;
  landing_cta_section_title: string;
  landing_cta_section_sub: string;
  landing_cta_join: string;
  landing_footer: string;

  // Dashboard
  dash_welcome: string;
  dash_points_balance: string;
  dash_tier_status: string;
  dash_progress_to: string;
  dash_points_to_next: string;
  dash_points_expire: string;
  dash_expires_in: string;
  dash_days: string;
  dash_recent_activity: string;
  dash_view_all: string;
  dash_no_activity: string;
  dash_quick_actions: string;
  dash_submit_invoice: string;
  dash_browse_rewards: string;
  dash_spin_wheel: string;
  dash_my_badges: string;
  dash_earned: string;
  dash_lifetime_points: string;
  dash_total_redeemed: string;
  dash_member_since: string;
  dash_referral_code: string;

  // Rewards Store
  rewards_title: string;
  rewards_sub: string;
  rewards_your_points: string;
  rewards_filter_all: string;
  rewards_filter_discount: string;
  rewards_filter_free_service: string;
  rewards_filter_merchandise: string;
  rewards_redeem: string;
  rewards_points_required: string;
  rewards_not_enough: string;
  rewards_out_of_stock: string;
  rewards_success: string;
  rewards_empty: string;
  rewards_type_discount: string;
  rewards_type_free_service: string;
  rewards_type_merchandise: string;
  rewards_type_free_delivery: string;
  rewards_type_free_design: string;
  rewards_type_double_points: string;

  // Invoices
  invoice_title: string;
  invoice_sub: string;
  invoice_number_label: string;
  invoice_number_placeholder: string;
  invoice_amount_label: string;
  invoice_amount_placeholder: string;
  invoice_notes_label: string;
  invoice_notes_placeholder: string;
  invoice_submit: string;
  invoice_submitting: string;
  invoice_success: string;
  invoice_history_title: string;
  invoice_status_pending: string;
  invoice_status_approved: string;
  invoice_status_rejected: string;
  invoice_status_flagged: string;
  invoice_points_earned: string;
  invoice_empty: string;
  invoice_tip: string;

  // Spin Wheel
  spin_title: string;
  spin_sub: string;
  spin_spin_btn: string;
  spin_spinning: string;
  spin_already_spun: string;
  spin_come_back: string;
  spin_congrats: string;
  spin_won: string;
  spin_points: string;
  spin_better_luck: string;
  spin_history: string;

  // Profile
  profile_title: string;
  profile_edit: string;
  profile_save: string;
  profile_cancel: string;
  profile_name: string;
  profile_email: string;
  profile_phone: string;
  profile_member_since: string;
  profile_badges_title: string;
  profile_no_badges: string;
  profile_earned_on: string;

  // Transactions
  tx_title: string;
  tx_sub: string;
  tx_filter_all: string;
  tx_filter_earned: string;
  tx_filter_redeemed: string;
  tx_filter_expired: string;
  tx_empty: string;
  tx_points: string;

  // Notifications
  notif_title: string;
  notif_mark_read: string;
  notif_empty: string;
  notif_all_read: string;

  // Referral
  referral_title: string;
  referral_sub: string;
  referral_your_code: string;
  referral_copy: string;
  referral_copied: string;
  referral_share_link: string;
  referral_how_title: string;
  referral_step1: string;
  referral_step2: string;
  referral_step3: string;
  referral_qr_title: string;
  referral_download_qr: string;

  // Admin Dashboard
  admin_dash_title: string;
  admin_dash_total_customers: string;
  admin_dash_active_customers: string;
  admin_dash_total_points: string;
  admin_dash_total_redemptions: string;
  admin_dash_recent_invoices: string;
  admin_dash_top_customers: string;

  // Admin Customers
  admin_cust_title: string;
  admin_cust_search: string;
  admin_cust_adjust_points: string;
  admin_cust_points: string;
  admin_cust_tier: string;
  admin_cust_joined: string;

  // Admin Invoices
  admin_inv_title: string;
  admin_inv_approve: string;
  admin_inv_reject: string;
  admin_inv_pending: string;
  admin_inv_customer: string;
  admin_inv_amount: string;
  admin_inv_date: string;

  // Admin Rewards
  admin_rew_title: string;
  admin_rew_add: string;
  admin_rew_edit: string;
  admin_rew_delete: string;
  admin_rew_active: string;
  admin_rew_disabled: string;

  // Admin Campaigns
  admin_camp_title: string;
  admin_camp_add: string;
  admin_camp_active: string;
  admin_camp_upcoming: string;
  admin_camp_ended: string;
  admin_camp_multiplier: string;

  // Admin Fraud
  admin_fraud_title: string;
  admin_fraud_open: string;
  admin_fraud_reviewed: string;
  admin_fraud_dismissed: string;
  admin_fraud_review: string;
  admin_fraud_dismiss: string;

  // Admin Settings
  admin_set_title: string;
  admin_set_seed: string;
  admin_set_seed_btn: string;
  admin_set_qr_title: string;
  admin_set_qr_generate: string;
  admin_set_qr_download: string;

  // Common
  loading: string;
  error: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  close: string;
  confirm: string;
  search: string;
  filter: string;
  all: string;
  yes: string;
  no: string;
  currency: string;
  points_abbr: string;
  login: string;
  logout: string;
  back: string;
  next: string;
  submit: string;
  success: string;
  failed: string;
}

const en: Translations = {
  // Navigation
  nav_dashboard: "Dashboard",
  nav_rewards: "Rewards",
  nav_spin: "Loyalty Spin",
  nav_invoices: "Invoices",
  nav_profile: "Profile",
  nav_referral: "Refer & Earn",
  nav_history: "History",
  nav_notifications: "Notifications",
  nav_sign_out: "Sign Out",
  nav_my_dashboard: "My Dashboard",

  // Admin Nav
  admin_nav_dashboard: "Dashboard",
  admin_nav_customers: "Customers",
  admin_nav_invoices: "Invoices",
  admin_nav_rewards: "Rewards",
  admin_nav_campaigns: "Campaigns",
  admin_nav_fraud: "Fraud Queue",
  admin_nav_settings: "Settings",
  admin_panel: "Admin Panel",
  admin_back_to_site: "Back to Site",

  // Landing
  landing_badge: "PRIME Printing Co. Loyalty Program",
  landing_headline: "Earn Rewards Every Time You Print",
  landing_sub: "Join Prime Rewards and turn every printing order into points. Unlock exclusive discounts, free services, and premium perks as you climb from Bronze to Platinum.",
  landing_cta_dashboard: "Go to Dashboard",
  landing_cta_rewards: "View Rewards",
  landing_stat_points: "1 pt",
  landing_stat_points_label: "per 10 KD spent",
  landing_stat_spin: "Milestone",
  landing_stat_spin_label: "Loyalty Spin",
  landing_stat_tiers: "4 Tiers",
  landing_stat_tiers_label: "Bronze to Platinum",
  landing_how_title: "How It Works",
  landing_step1_title: "Submit Your Invoice",
  landing_step1_desc: "Upload your PRIME Printing Co. invoice and earn points instantly based on the amount.",
  landing_step2_title: "Earn & Level Up",
  landing_step2_desc: "Accumulate points to climb through Bronze, Silver, Gold, and Platinum tiers.",
  landing_step3_title: "Redeem Rewards",
  landing_step3_desc: "Exchange your points for exclusive discounts, free services, and premium merchandise.",
  landing_tiers_title: "Membership Tiers",
  landing_tiers_sub: "The more you print, the more you earn",
  landing_cta_section_title: "Ready to Start Earning?",
  landing_cta_section_sub: "Join thousands of PRIME Printing Co. customers already earning rewards.",
  landing_cta_join: "Join Prime Rewards",
  landing_footer: "© 2026 PRIME Printing Co. All rights reserved.",

  // Dashboard
  dash_welcome: "Welcome back",
  dash_points_balance: "Points Balance",
  dash_tier_status: "Tier Status",
  dash_progress_to: "Progress to",
  dash_points_to_next: "points to next tier",
  dash_points_expire: "Points Expiry",
  dash_expires_in: "Expires in",
  dash_days: "days",
  dash_recent_activity: "Recent Activity",
  dash_view_all: "View All",
  dash_no_activity: "No activity yet. Submit your first invoice to earn points!",
  dash_quick_actions: "Quick Actions",
  dash_submit_invoice: "Submit Invoice",
  dash_browse_rewards: "Browse Rewards",
  dash_spin_wheel: "Spin Wheel",
  dash_my_badges: "My Badges",
  dash_earned: "Earned",
  dash_lifetime_points: "Lifetime Points",
  dash_total_redeemed: "Total Redeemed",
  dash_member_since: "Member Since",
  dash_referral_code: "Referral Code",

  // Rewards Store
  rewards_title: "Rewards Store",
  rewards_sub: "Redeem your points for exclusive rewards",
  rewards_your_points: "Your Points",
  rewards_filter_all: "All",
  rewards_filter_discount: "Discounts",
  rewards_filter_free_service: "Free Services",
  rewards_filter_merchandise: "Merchandise",
  rewards_redeem: "Redeem",
  rewards_points_required: "pts required",
  rewards_not_enough: "Not enough points",
  rewards_out_of_stock: "Out of stock",
  rewards_success: "Reward redeemed successfully!",
  rewards_empty: "No rewards available right now.",
  rewards_type_discount: "Discount",
  rewards_type_free_service: "Free Service",
  rewards_type_merchandise: "Merchandise",
  rewards_type_free_delivery: "Free Delivery",
  rewards_type_free_design: "Free Design",
  rewards_type_double_points: "Double Points",

  // Invoices
  invoice_title: "Submit Invoice",
  invoice_sub: "Earn points by submitting your PRIME Printing Co. invoices",
  invoice_number_label: "Invoice Number",
  invoice_number_placeholder: "e.g. INV-2026-001",
  invoice_amount_label: "Invoice Amount (KD)",
  invoice_amount_placeholder: "e.g. 150.000",
  invoice_notes_label: "Notes (optional)",
  invoice_notes_placeholder: "Any additional information...",
  invoice_submit: "Submit Invoice",
  invoice_submitting: "Submitting...",
  invoice_success: "Invoice submitted! Points will be added after review.",
  invoice_history_title: "My Invoices",
  invoice_status_pending: "Pending",
  invoice_status_approved: "Approved",
  invoice_status_rejected: "Rejected",
  invoice_status_flagged: "Flagged",
  invoice_points_earned: "pts earned",
  invoice_empty: "No invoices submitted yet.",
  invoice_tip: "Tip: You earn 1 point for every 10 KD spent.",

  // Spin Wheel
  spin_title: "Loyalty Spin",
  spin_sub: "Earn a free spin on your first purchase and every 5 invoices after that!",
  spin_spin_btn: "Spin the Wheel!",
  spin_spinning: "Spinning...",
  spin_already_spun: "No Spins Available",
  spin_come_back: "Submit 5 approved invoices to unlock your next spin!",
  spin_congrats: "Congratulations!",
  spin_won: "You won",
  spin_points: "points!",
  spin_better_luck: "Better luck next time!",
  spin_history: "Spin History",

  // Profile
  profile_title: "My Profile",
  profile_edit: "Edit Profile",
  profile_save: "Save Changes",
  profile_cancel: "Cancel",
  profile_name: "Full Name",
  profile_email: "Email Address",
  profile_phone: "Phone Number",
  profile_member_since: "Member Since",
  profile_badges_title: "My Badges",
  profile_no_badges: "No badges earned yet. Keep earning points!",
  profile_earned_on: "Earned on",

  // Transactions
  tx_title: "Transaction History",
  tx_sub: "Your complete points history",
  tx_filter_all: "All",
  tx_filter_earned: "Earned",
  tx_filter_redeemed: "Redeemed",
  tx_filter_expired: "Expired",
  tx_empty: "No transactions yet.",
  tx_points: "pts",

  // Notifications
  notif_title: "Notifications",
  notif_mark_read: "Mark All Read",
  notif_empty: "No notifications yet.",
  notif_all_read: "All caught up!",

  // Referral
  referral_title: "Refer & Earn",
  referral_sub: "Share your referral code and earn bonus points",
  referral_your_code: "Your Referral Code",
  referral_copy: "Copy Code",
  referral_copied: "Copied!",
  referral_share_link: "Share Link",
  referral_how_title: "How It Works",
  referral_step1: "Share your unique referral code with friends",
  referral_step2: "They sign up and submit their first invoice",
  referral_step3: "You both earn bonus points!",
  referral_qr_title: "Your Referral QR Code",
  referral_download_qr: "Download QR Code",

  // Admin Dashboard
  admin_dash_title: "Admin Dashboard",
  admin_dash_total_customers: "Total Customers",
  admin_dash_active_customers: "Active Customers",
  admin_dash_total_points: "Total Points Issued",
  admin_dash_total_redemptions: "Total Redemptions",
  admin_dash_recent_invoices: "Recent Invoices",
  admin_dash_top_customers: "Top Customers",

  // Admin Customers
  admin_cust_title: "Customer Management",
  admin_cust_search: "Search customers...",
  admin_cust_adjust_points: "Adjust Points",
  admin_cust_points: "Points",
  admin_cust_tier: "Tier",
  admin_cust_joined: "Joined",

  // Admin Invoices
  admin_inv_title: "Invoice Management",
  admin_inv_approve: "Approve",
  admin_inv_reject: "Reject",
  admin_inv_pending: "Pending",
  admin_inv_customer: "Customer",
  admin_inv_amount: "Amount",
  admin_inv_date: "Date",

  // Admin Rewards
  admin_rew_title: "Rewards Store",
  admin_rew_add: "Add Reward",
  admin_rew_edit: "Edit",
  admin_rew_delete: "Delete",
  admin_rew_active: "Active",
  admin_rew_disabled: "Disabled",

  // Admin Campaigns
  admin_camp_title: "Campaigns",
  admin_camp_add: "New Campaign",
  admin_camp_active: "Active",
  admin_camp_upcoming: "Upcoming",
  admin_camp_ended: "Ended",
  admin_camp_multiplier: "multiplier",

  // Admin Fraud
  admin_fraud_title: "Fraud Queue",
  admin_fraud_open: "Open",
  admin_fraud_reviewed: "Reviewed",
  admin_fraud_dismissed: "Dismissed",
  admin_fraud_review: "Mark Reviewed",
  admin_fraud_dismiss: "Dismiss",

  // Admin Settings
  admin_set_title: "Settings",
  admin_set_seed: "Seed Default Data",
  admin_set_seed_btn: "Seed Default Badges & Rewards",
  admin_set_qr_title: "QR Code Generator",
  admin_set_qr_generate: "Generate",
  admin_set_qr_download: "Download QR Code",

  // Common
  loading: "Loading...",
  error: "Something went wrong",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  close: "Close",
  confirm: "Confirm",
  search: "Search",
  filter: "Filter",
  all: "All",
  yes: "Yes",
  no: "No",
  currency: "KD",
  points_abbr: "pts",
  login: "Sign In",
  logout: "Sign Out",
  back: "Back",
  next: "Next",
  submit: "Submit",
  success: "Success",
  failed: "Failed",
};

const ar: Translations = {
  // Navigation
  nav_dashboard: "لوحة التحكم",
  nav_rewards: "المكافآت",
  nav_spin: "دوران الولاء",
  nav_invoices: "الفواتير",
  nav_profile: "الملف الشخصي",
  nav_referral: "أحل واربح",
  nav_history: "السجل",
  nav_notifications: "الإشعارات",
  nav_sign_out: "تسجيل الخروج",
  nav_my_dashboard: "لوحتي",

  // Admin Nav
  admin_nav_dashboard: "لوحة التحكم",
  admin_nav_customers: "العملاء",
  admin_nav_invoices: "الفواتير",
  admin_nav_rewards: "المكافآت",
  admin_nav_campaigns: "الحملات",
  admin_nav_fraud: "الاحتيال",
  admin_nav_settings: "الإعدادات",
  admin_panel: "لوحة الإدارة",
  admin_back_to_site: "العودة للموقع",

  // Landing
  landing_badge: "برنامج ولاء PRIME للطباعة",
  landing_headline: "اكسب مكافآت مع كل طباعة",
  landing_sub: "انضم إلى Prime Rewards وحوّل كل طلب طباعة إلى نقاط. افتح خصومات حصرية وخدمات مجانية ومزايا مميزة بينما تتسلق من برونز إلى بلاتينيوم.",
  landing_cta_dashboard: "الذهاب للوحة التحكم",
  landing_cta_rewards: "عرض المكافآت",
  landing_stat_points: "نقطة",
  landing_stat_points_label: "لكل 10 د.ك",
  landing_stat_spin: "علامة فارقة",
  landing_stat_spin_label: "دوران الولاء",
  landing_stat_tiers: "4 مستويات",
  landing_stat_tiers_label: "من برونز إلى بلاتينيوم",
  landing_how_title: "كيف يعمل البرنامج",
  landing_step1_title: "أرسل فاتورتك",
  landing_step1_desc: "ارفع فاتورة PRIME للطباعة واكسب النقاط فوراً بناءً على المبلغ.",
  landing_step2_title: "اكسب وارتقِ",
  landing_step2_desc: "اجمع النقاط للارتقاء عبر مستويات برونز، فضي، ذهبي، وبلاتيني.",
  landing_step3_title: "استبدل مكافآتك",
  landing_step3_desc: "استبدل نقاطك بخصومات حصرية وخدمات مجانية وبضائع مميزة.",
  landing_tiers_title: "مستويات العضوية",
  landing_tiers_sub: "كلما طبعت أكثر، كلما كسبت أكثر",
  landing_cta_section_title: "هل أنت مستعد للبدء؟",
  landing_cta_section_sub: "انضم إلى آلاف عملاء PRIME للطباعة الذين يكسبون المكافآت.",
  landing_cta_join: "انضم إلى Prime Rewards",
  landing_footer: "© 2026 PRIME للطباعة. جميع الحقوق محفوظة.",

  // Dashboard
  dash_welcome: "مرحباً بعودتك",
  dash_points_balance: "رصيد النقاط",
  dash_tier_status: "مستوى العضوية",
  dash_progress_to: "التقدم نحو",
  dash_points_to_next: "نقطة للمستوى التالي",
  dash_points_expire: "انتهاء صلاحية النقاط",
  dash_expires_in: "تنتهي خلال",
  dash_days: "يوم",
  dash_recent_activity: "النشاط الأخير",
  dash_view_all: "عرض الكل",
  dash_no_activity: "لا يوجد نشاط بعد. أرسل فاتورتك الأولى لكسب النقاط!",
  dash_quick_actions: "إجراءات سريعة",
  dash_submit_invoice: "إرسال فاتورة",
  dash_browse_rewards: "تصفح المكافآت",
  dash_spin_wheel: "عجلة الحظ",
  dash_my_badges: "شاراتي",
  dash_earned: "مكتسبة",
  dash_lifetime_points: "إجمالي النقاط",
  dash_total_redeemed: "إجمالي المستبدل",
  dash_member_since: "عضو منذ",
  dash_referral_code: "كود الإحالة",

  // Rewards Store
  rewards_title: "متجر المكافآت",
  rewards_sub: "استبدل نقاطك بمكافآت حصرية",
  rewards_your_points: "نقاطك",
  rewards_filter_all: "الكل",
  rewards_filter_discount: "خصومات",
  rewards_filter_free_service: "خدمات مجانية",
  rewards_filter_merchandise: "بضائع",
  rewards_redeem: "استبدال",
  rewards_points_required: "نقطة مطلوبة",
  rewards_not_enough: "نقاط غير كافية",
  rewards_out_of_stock: "نفد المخزون",
  rewards_success: "تم استبدال المكافأة بنجاح!",
  rewards_empty: "لا توجد مكافآت متاحة حالياً.",
  rewards_type_discount: "خصم",
  rewards_type_free_service: "خدمة مجانية",
  rewards_type_merchandise: "بضاعة",
  rewards_type_free_delivery: "توصيل مجاني",
  rewards_type_free_design: "تصميم مجاني",
  rewards_type_double_points: "نقاط مضاعفة",

  // Invoices
  invoice_title: "إرسال فاتورة",
  invoice_sub: "اكسب نقاطاً بإرسال فواتير PRIME للطباعة",
  invoice_number_label: "رقم الفاتورة",
  invoice_number_placeholder: "مثال: INV-2026-001",
  invoice_amount_label: "مبلغ الفاتورة (د.ك)",
  invoice_amount_placeholder: "مثال: 150.000",
  invoice_notes_label: "ملاحظات (اختياري)",
  invoice_notes_placeholder: "أي معلومات إضافية...",
  invoice_submit: "إرسال الفاتورة",
  invoice_submitting: "جاري الإرسال...",
  invoice_success: "تم إرسال الفاتورة! ستُضاف النقاط بعد المراجعة.",
  invoice_history_title: "فواتيري",
  invoice_status_pending: "قيد المراجعة",
  invoice_status_approved: "معتمدة",
  invoice_status_rejected: "مرفوضة",
  invoice_status_flagged: "مُبلَّغ عنها",
  invoice_points_earned: "نقطة مكتسبة",
  invoice_empty: "لم يتم إرسال أي فواتير بعد.",
  invoice_tip: "تلميح: تكسب نقطة واحدة لكل 10 د.ك تنفقها.",

  // Spin Wheel
  spin_title: "دوران الولاء",
  spin_sub: "احصل على دوران مجاني عند شرائك الأول وكل 5 فواتير بعد ذلك!",
  spin_spin_btn: "أدر العجلة!",
  spin_spinning: "جاري الدوران...",
  spin_already_spun: "لا توجد دورانات متاحة",
  spin_come_back: "قدم 5 فواتير معتمدة لفتح دورانك التالية!",
  spin_congrats: "تهانينا!",
  spin_won: "لقد فزت بـ",
  spin_points: "نقطة!",
  spin_better_luck: "حظاً أوفر في المرة القادمة!",
  spin_history: "سجل الدوران",

  // Profile
  profile_title: "ملفي الشخصي",
  profile_edit: "تعديل الملف",
  profile_save: "حفظ التغييرات",
  profile_cancel: "إلغاء",
  profile_name: "الاسم الكامل",
  profile_email: "البريد الإلكتروني",
  profile_phone: "رقم الهاتف",
  profile_member_since: "عضو منذ",
  profile_badges_title: "شاراتي",
  profile_no_badges: "لم تكسب أي شارات بعد. استمر في كسب النقاط!",
  profile_earned_on: "مكتسبة في",

  // Transactions
  tx_title: "سجل المعاملات",
  tx_sub: "سجل نقاطك الكامل",
  tx_filter_all: "الكل",
  tx_filter_earned: "مكتسبة",
  tx_filter_redeemed: "مستبدلة",
  tx_filter_expired: "منتهية",
  tx_empty: "لا توجد معاملات بعد.",
  tx_points: "نقطة",

  // Notifications
  notif_title: "الإشعارات",
  notif_mark_read: "تحديد الكل كمقروء",
  notif_empty: "لا توجد إشعارات بعد.",
  notif_all_read: "لا توجد إشعارات جديدة!",

  // Referral
  referral_title: "أحل واربح",
  referral_sub: "شارك كود الإحالة الخاص بك واكسب نقاطاً إضافية",
  referral_your_code: "كود الإحالة الخاص بك",
  referral_copy: "نسخ الكود",
  referral_copied: "تم النسخ!",
  referral_share_link: "مشاركة الرابط",
  referral_how_title: "كيف يعمل",
  referral_step1: "شارك كودك الفريد مع الأصدقاء",
  referral_step2: "يسجلون ويرسلون أول فاتورة لهم",
  referral_step3: "تكسبون نقاطاً إضافية معاً!",
  referral_qr_title: "رمز QR للإحالة",
  referral_download_qr: "تحميل رمز QR",

  // Admin Dashboard
  admin_dash_title: "لوحة الإدارة",
  admin_dash_total_customers: "إجمالي العملاء",
  admin_dash_active_customers: "العملاء النشطون",
  admin_dash_total_points: "إجمالي النقاط الممنوحة",
  admin_dash_total_redemptions: "إجمالي الاستبدالات",
  admin_dash_recent_invoices: "الفواتير الأخيرة",
  admin_dash_top_customers: "أفضل العملاء",

  // Admin Customers
  admin_cust_title: "إدارة العملاء",
  admin_cust_search: "بحث عن عميل...",
  admin_cust_adjust_points: "تعديل النقاط",
  admin_cust_points: "النقاط",
  admin_cust_tier: "المستوى",
  admin_cust_joined: "تاريخ الانضمام",

  // Admin Invoices
  admin_inv_title: "إدارة الفواتير",
  admin_inv_approve: "اعتماد",
  admin_inv_reject: "رفض",
  admin_inv_pending: "قيد الانتظار",
  admin_inv_customer: "العميل",
  admin_inv_amount: "المبلغ",
  admin_inv_date: "التاريخ",

  // Admin Rewards
  admin_rew_title: "متجر المكافآت",
  admin_rew_add: "إضافة مكافأة",
  admin_rew_edit: "تعديل",
  admin_rew_delete: "حذف",
  admin_rew_active: "نشط",
  admin_rew_disabled: "معطل",

  // Admin Campaigns
  admin_camp_title: "الحملات",
  admin_camp_add: "حملة جديدة",
  admin_camp_active: "نشطة",
  admin_camp_upcoming: "قادمة",
  admin_camp_ended: "منتهية",
  admin_camp_multiplier: "مضاعف",

  // Admin Fraud
  admin_fraud_title: "قائمة الاحتيال",
  admin_fraud_open: "مفتوحة",
  admin_fraud_reviewed: "تمت المراجعة",
  admin_fraud_dismissed: "مرفوضة",
  admin_fraud_review: "تحديد كمراجَع",
  admin_fraud_dismiss: "رفض",

  // Admin Settings
  admin_set_title: "الإعدادات",
  admin_set_seed: "بيانات افتراضية",
  admin_set_seed_btn: "إضافة الشارات والمكافآت الافتراضية",
  admin_set_qr_title: "مولّد رمز QR",
  admin_set_qr_generate: "توليد",
  admin_set_qr_download: "تحميل رمز QR",

  // Common
  loading: "جاري التحميل...",
  error: "حدث خطأ ما",
  save: "حفظ",
  cancel: "إلغاء",
  delete: "حذف",
  edit: "تعديل",
  close: "إغلاق",
  confirm: "تأكيد",
  search: "بحث",
  filter: "تصفية",
  all: "الكل",
  yes: "نعم",
  no: "لا",
  currency: "د.ك",
  points_abbr: "نقطة",
  login: "تسجيل الدخول",
  logout: "تسجيل الخروج",
  back: "رجوع",
  next: "التالي",
  submit: "إرسال",
  success: "نجاح",
  failed: "فشل",
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: en,
  isRTL: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("prime-language") as Language) ?? "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("prime-language", lang);
  };

  const isRTL = language === "ar";
  const t = language === "ar" ? ar : en;

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [isRTL, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
