import type { Major } from "@/lib/sim/types";

// 専攻・学科(大学・大学院は、分野 → 専攻。専門学校・高校は、分野・学科)と、そこから就きやすい職種(職種の id)。
// 分け方と、就きやすさは、設計上の目安で、実際の統計の転記ではない。

export type MajorDetail = { id: string; label: string; jobs: string[] };
export type MajorCategory = { id: Major; label: string; details: MajorDetail[] };

// 大学・大学院
export const UNIV_FIELDS: MajorCategory[] = [
  {
    id: "humanities",
    label: "文系(法・経済・文学・社会など)",
    details: [
      { id: "h_law", label: "法学・政治学", jobs: ["city_hall", "national_clerk", "legal_office", "lawyer", "bureaucrat", "office_general"] },
      { id: "h_econ", label: "経済・経営・商学", jobs: ["accounting_clerk", "finance_sales", "trading_co", "accountant", "pr_marketing", "office_general", "ec_shop"] },
      { id: "h_lit", label: "文学・人文・外国語", jobs: ["journalist", "translator", "curator", "novelist", "tour_guide", "pr_marketing", "office_general"] },
      { id: "h_social", label: "社会学・心理学・福祉", jobs: ["social_worker", "psychologist", "city_hall", "care_manager", "journalist", "office_general"] },
      { id: "h_intl", label: "国際・地域・観光", jobs: ["trading_co", "translator", "diplomat", "tour_guide", "cabin", "travel_office"] },
    ],
  },
  {
    id: "science",
    label: "理系(情報・工学・理学・農学など)",
    details: [
      { id: "s_info", label: "情報・数理", jobs: ["software", "data_sci", "it_infra", "sys_consultant", "game_creator", "researcher"] },
      { id: "s_elec", label: "電気・電子・通信", jobs: ["electric_eng", "it_infra", "researcher", "software", "sys_consultant"] },
      { id: "s_mech", label: "機械・航空・自動車", jobs: ["machine_eng", "transport_eng", "researcher", "electric_eng", "auto_mechanic"] },
      { id: "s_chem", label: "化学・材料・生物", jobs: ["chem_eng", "researcher", "brewer", "food_factory", "pharmacist"] },
      { id: "s_arch", label: "建築・土木・環境", jobs: ["arch_eng", "civil_eng", "interior", "researcher", "city_hall"] },
      { id: "s_phys", label: "数学・物理・地球科学", jobs: ["researcher", "data_sci", "software", "trader", "school_teacher"] },
      { id: "s_agri", label: "農学・水産・環境", jobs: ["researcher", "farmer", "forestry", "fisher", "food_factory", "city_hall"] },
    ],
  },
  {
    id: "medical",
    label: "医療・薬・看護・保健系",
    details: [
      { id: "m_med", label: "医学", jobs: ["doctor", "researcher"] },
      { id: "m_pharm", label: "薬学", jobs: ["pharmacist", "researcher"] },
      { id: "m_nurse", label: "看護学", jobs: ["nurse", "care_manager", "paramedic"] },
      { id: "m_rehab", label: "リハビリ・保健(理学療法・放射線など)", jobs: ["rehab", "radiology", "other_health", "trainer"] },
      { id: "m_dent", label: "歯学・歯科衛生", jobs: ["dentist", "dental_hyg"] },
      { id: "m_nutr", label: "栄養・食物", jobs: ["dietitian", "food_factory", "cook", "researcher"] },
      { id: "m_vet", label: "獣医学", jobs: ["vet", "researcher", "zookeeper"] },
    ],
  },
  {
    id: "education",
    label: "教育系",
    details: [
      { id: "e_elem", label: "小学校・中学校の教員養成", jobs: ["school_teacher", "tutor", "other_teacher"] },
      { id: "e_secondary", label: "高校の教科(国語・数学・英語など)", jobs: ["hs_teacher", "school_teacher", "tutor"] },
      { id: "e_early", label: "保育・幼児教育", jobs: ["kindergarten", "childcare", "social_worker"] },
      { id: "e_special", label: "特別支援・福祉教育", jobs: ["social_worker", "school_teacher", "care_manager"] },
      { id: "e_pe", label: "体育・スポーツ教育", jobs: ["hs_teacher", "trainer", "athlete", "school_teacher"] },
    ],
  },
  {
    id: "art",
    label: "芸術・スポーツ系",
    details: [
      { id: "a_design", label: "デザイン・建築デザイン", jobs: ["designer", "web_designer", "interior", "fashion", "game_creator"] },
      { id: "a_fine", label: "美術・写真・マンガ", jobs: ["artist", "manga", "photographer", "curator", "designer"] },
      { id: "a_music", label: "音楽・舞台・演劇", jobs: ["musician", "composer", "actor", "singer", "entertainer"] },
      { id: "a_media", label: "映像・メディア・文芸", jobs: ["film_director", "game_creator", "photographer", "novelist", "journalist"] },
      { id: "a_sports", label: "スポーツ科学・競技", jobs: ["trainer", "athlete", "hs_teacher", "fitness_staff"] },
    ],
  },
];

// 専門学校・短大・高専の分野
export const VOC_FIELDS: MajorDetail[] = [
  { id: "v_care", label: "医療・福祉・看護", jobs: ["nurse", "rehab", "dental_hyg", "care_worker", "radiology", "childcare", "care_manager"] },
  { id: "v_it", label: "IT・情報・ゲーム", jobs: ["software", "it_infra", "web_designer", "game_creator", "it_support"] },
  { id: "v_food", label: "調理・製菓・栄養", jobs: ["cook", "patissier", "barista", "dietitian", "bartender"] },
  { id: "v_beauty", label: "美容・ファッション", jobs: ["barber", "beauty_advisor", "fashion", "beauty"] },
  { id: "v_tech", label: "自動車・機械・電気・建築", jobs: ["auto_mechanic", "electrician", "machine_eng", "plumber", "hvac", "carpenter"] },
  { id: "v_biz", label: "ビジネス・会計・事務", jobs: ["accounting_clerk", "office_general", "shop_clerk", "finance_sales"] },
  { id: "v_design", label: "デザイン・芸術・音楽", jobs: ["designer", "web_designer", "photographer", "manga", "musician"] },
  { id: "v_tour", label: "観光・ホテル・ブライダル", jobs: ["hotel", "cabin", "tour_guide", "travel_office", "bridal"] },
  { id: "v_public", label: "公務員・警察・消防(公務員試験対策)", jobs: ["police", "firefighter", "jsdf", "city_hall"] },
];

// 高校の学科
export const HS_FIELDS: MajorDetail[] = [
  { id: "g_general", label: "普通科", jobs: ["shop_clerk", "office_general", "city_hall", "police", "delivery", "care_worker"] },
  { id: "g_industrial", label: "工業科", jobs: ["machine_assembly", "electrician", "auto_mechanic", "carpenter", "plumber", "semiconductor"] },
  { id: "g_commercial", label: "商業科", jobs: ["accounting_clerk", "office_general", "shop_clerk", "finance_sales"] },
  { id: "g_agri", label: "農業・水産科", jobs: ["farmer", "fisher", "food_factory", "forestry", "dairy"] },
  { id: "g_care", label: "福祉・看護科", jobs: ["care_worker", "nurse", "childcare", "home_helper"] },
  { id: "g_arts", label: "芸術・体育科", jobs: ["designer", "musician", "trainer", "athlete", "fitness_staff"] },
];

const ALL: MajorDetail[] = [...UNIV_FIELDS.flatMap((c) => c.details), ...VOC_FIELDS, ...HS_FIELDS];
export const fieldById = (id: string | null | undefined) => (id ? ALL.find((d) => d.id === id) : undefined);
export const fieldJobIds = (id: string | null | undefined): string[] => fieldById(id)?.jobs ?? [];
