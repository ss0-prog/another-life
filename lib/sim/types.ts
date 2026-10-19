import type { Curve, Rng } from "@/lib/sim/rng";
import type { Echo } from "@/lib/types";

export type Region = "tokyo" | "metro" | "local" | "rural";
export type Occ = "mgmt" | "tech" | "office" | "sales" | "service" | "security" | "agri" | "production" | "transport" | "construction" | "logistics";
// 勤め先の区分: 民間・公務員(国や自治体)。自営は雇用形態(Employment = "self")で表す。
export type Sector = "private" | "public";
// 職種(厚労省の職種区分にもとづく)。mult は大分類の平均を1としたときの給料の倍率(概算)。qual は資格・試験の難しさの目安。
export type JobDef = {
  id: string;
  occ: Occ;
  group?: string;
  title: string;
  mult: number;
  note: string;
  qual?: { diff: number; grad?: boolean; label: string };
  kw?: RegExp;
  selfDefault?: boolean;
};
export type Edu = "univ" | "vocational" | "hs_work" | "grad";
export type Money = "tight" | "modest" | "comfortable" | "ample";
export type Housing = "parents" | "rent_single" | "rent_family" | "owned_house" | "owned_flat";
export type Sex = "female" | "male" | "none";
// 性自認(自分をどんな性だと感じているか)と、恋愛・性的指向(どんな人に惹かれるか)。
// sex(生まれたときの性別)は、平均寿命や賃金の統計の計算に使う。この二つは、恋人や家族の描き方に使う。
export type GenderId = "cis" | "trans_man" | "trans_woman" | "nonbinary" | "unsure";
export type Orientation = "hetero" | "homo" | "bi" | "ace";
export type PartnerGender = "man" | "woman" | "nonbinary";
// 子どもの預け先(0〜5歳)。仕事のあいだ、誰が見るか。
export type CareKind = "daycare" | "kodomoen" | "kindergarten" | "grandparents" | "sitter" | "home_self" | "home_partner";
export type Condition = "none" | "heart" | "diabetes" | "asthma" | "sensory" | "other";
export type Ailment = "none" | "hypertension" | "diabetes2" | "mental" | "cancer" | "heart_acq" | "intractable" | "chronic_pain" | "other";
export type School = "none" | "hs" | "vocational" | "univ" | "grad";
export type Background = "tight" | "modest" | "comfortable";
export type Employment = "regular" | "nonregular" | "self";
export type Firm = "large" | "mid" | "small";
export type Major = "humanities" | "science" | "medical" | "education" | "art";
export type BranchKind = "childhood" | "education" | "job" | "place" | "family";
// 手入力の選択を結果に反映するための「近い方向」。
export type Tag = "challenge" | "stable" | "learn" | "bond" | "rest";

// joy は幸福度。0 になると、うつ状態になる。
export type Stats = { health: number; money: number; bonds: number; learn: number; joy: number };

// 売買できる資産。価格はシミュレーションで、実在の株価ではない。
export type AssetId = "index" | "world" | "balanced" | "reit" | "gold" | "growth" | "crypto" | "bond";
export type AssetDef = {
  id: AssetId;
  label: string;
  desc: string;
  mu: number; // 年率の期待リターン
  sigma: number; // 年率のぶれ
  crashP: number; // 1年に暴落が起きる確率
  crash: [number, number]; // 暴落時の下落幅(割合)
  ruinP: number; // 1年にほぼ無価値になる確率
};
// 貯金(円)と、資産ごとの保有数量。contributed は買った額から売った額を引いたもの。
// stocks は、本人が株を始めたかどうか(始めるかは、その人の選択)。
export type Wallet = { cash: number; units: Record<AssetId, number>; contributed: number; stocks: boolean; debts: Debt[]; plans?: Partial<Record<AssetId, number>>; kidFund?: { units: number; contributed: number } };

// 最初に入力してもらう「今の自分」。
// 住まいの答え。居候(友人や親戚の家)・寮や社宅・シェアハウス・施設や病院・定まった住まいがない、も選べる。
export type HousingAnswer = "owned" | "rent" | "parents" | "lodging" | "dorm" | "share" | "facility" | "homeless";
export type Marital = "single" | "married" | "divorced" | "widowed" | "partnered";
export type DebtAnswer = "none" | "scholarship" | "several" | "huge";

export type CurrentSelf = {
  age: number;
  prefecture: string; // 生まれた都道府県
  sex: Sex;
  genderId?: GenderId; // 性自認(書かなければ、生まれたときの性別と同じ)
  orientation?: Orientation; // 恋愛・性的指向(書かなければ、異性)
  condition: Condition;
  mbti: string | null;
  edu: Edu;
  occ: Occ | "none"; // none = 学生・働いていない
  job: string | null; // 職種(JobDef.id)。未指定なら、大分類の標準的な職種
  workStyle: "private" | "public" | "self" | "nonregular"; // 民間・公務員・自営・非正規(パート・派遣・契約)
  region: Region; // いま住んでいる地域
  married: boolean;
  kids: number;
  housing: HousingAnswer;
  savings: number | null; // いまの貯金(万円)。未入力なら年齢からの目安
  ailment?: Ailment; // いま通院・治療している病気(先天性とは別)
  school?: School; // いま通っている学校。none なら通っていない。通っている間は edu は卒業の見込み
  yearsLeft?: number; // 在学中なら、卒業まであと何年か
  kidBirthAges?: number[]; // 子どもが生まれたときの、自分の年齢(子どもごと)
  kidSexes?: ("boy" | "girl" | "unknown")[]; // 子どもの性別(子どもごと)
  partnerName?: string; // 配偶者の名前(書かなければ、ランダム)
  marital?: Marital; // 婚姻の状況。married は、marital が married のときだけ true
  retired?: boolean; // 仕事を退いて、年金などで暮らしている(occ は none)
  homemaker?: boolean; // 専業主婦・主夫(occ は none)
  debt?: DebtAnswer; // いまの借金
  major?: Major; // 大学・大学院の、専攻の分野
  field?: string; // 専攻・学科の詳しい分類(大学・専門学校・高校)
  survey?: Partial<Record<"feel" | "tie" | "body" | "wealth" | "habit", string>>; // 事前の調査の答え(はじまりの能力値になる)
  eduDetail?: "junior_high" | "dropout"; // 中学卒・中退(edu は hs_work に近いものとして扱う)
};

export type Branch = { kind: BranchKind; option: string; age: number };

export type Setup = { self: CurrentSelf; branch: Branch; seed: number };

// ゲーム中のひとりの人物。occ が null の間は学生(または子ども)。
export type Person = {
  age: number;
  // いまの持病(あとから診断される場合は ailmentOnset に予定が入る)。
  ailment: Ailment;
  ailmentOnset: { age: number; id: Ailment } | null;
  // 居候・寮や社宅・シェアハウス・施設や病院・定まった住まいがない、のとき。生活費や暮らしに効く。
  housingKind: "lodging" | "dorm" | "share" | "facility" | "homeless" | null;
  // いまのアルバイトと、議員などの職(任期の終わりに、再選の結果が出る)。
  // 周りの人(友人・上司・義理の家族)の MBTI。出会ったときに決まる。
  npc: Record<string, string>;
  // こどもNISAへの積立(円)。決まったあと、flush で、値動きのある資産に変わる。
  kidFundYen: number;
  // 転職の話が来たときの、移り先の職業(選んでもらうまで)。
  jobOffer: Occ | null;
  jobOfferJob: string | null;
  // 転職したときの、前の職とくらべた賃金の倍率(雇用動向調査の分布から、話が出た時点で決まる)。
  jobOfferFactor: number;
  // 治療を受けるかを聞く場面の、費用(万円)と理由。
  treatMan: number;
  // 卒業の1年前に決めた卒業後の道(選んだ道の id)。卒業のときに、実行する。
  jobPlan: string[] | null;
  // 相続したお金(万円)。使い道を選ぶまで、手元には入らない。
  inheritMan: number;
  // のめり込んでいる習慣(ギャンブル・タバコ・お酒)。temptKind は、いま誘いを受けている種類。
  habit: { kind: "gamble" | "smoke" | "drink"; since: number } | null;
  temptKind: "gamble" | "smoke" | "drink";
  // 五つの能力値とは別の、暮らしの数値(0〜100)。ストレス(高いと悪い)・社会的な信用・仕事の実績・人としての魅力。
  extra: Extra;
  // 売買で持っているもの(id → 手に入れた歳)。
  owns: Record<string, number>;
  // 引っ越しや留学で、続けられなくなったこと(出来事に、書き添える)。
  leftNote: string;
  treatLabel: string;
  // NISAへの積立(円)。決まったあと、flush で、値動きのある資産に変わる。
  nisaYen: number;
  // 事前の調査で答えた「いまの体の調子」と、年齢相応の健康との差(健康の土台に足す)。
  healthAdj: number;
  // 「いまの人と結婚に向けて進む」と決めた年齢(そのあと、結婚の話が出る)。
  proposeAt: number | null;
  // 年金の受け取り方(繰り下げ)。pensionFrom の年齢になるまで受け取らず、そのあとは pensionMult 倍になる。
  pensionFrom?: number;
  pensionMult?: number;
  parttime: { id: string; since: number } | null;
  office: { id: string; since: number; terms?: number; rank?: "minister" | "pm" | "former_pm"; rankSince?: number } | null;
  // 在学中の人の、卒業する年齢(なければ標準の年齢)。
  gradAge: number | null;
  sex: Sex;
  genderId?: GenderId;
  orientation?: Orientation;
  condition: Condition;
  mbti: string | null;
  background: Background;
  birthPlace: string;
  birthRegion: Region;
  edu: Edu;
  region: Region;
  city: string;
  // これまで暮らした場所(引っ越しの軌跡)。
  homes?: { age: number; place: string }[];
  occ: Occ | "retired" | null;
  job: string | null;
  sector: Sector;
  // 頭の良さ(0〜100)。進学や資格の合格率に効く。
  intel: number;
  // 昇進する前の職(降格や転職で戻るため)。
  prev: { occ: Occ; job: string | null; payMult: number } | null;
  // 選択の結果などで増減した貯金(円)。エンジンが、貯金に反映して0に戻す。
  cashDelta: number;
  // 出来事の理由づけに使う、直近の出来事(種類 → 起きた年齢)。
  history: Record<string, number>;
  scheduled: Scheduled[];
  // 心の状態(うつ状態の年数)と、深刻な病気。どちらも、死期を早める。
  mood: "ok" | "depressed";
  moodYears: number;
  sick: boolean;
  lessons: TakenLesson[];
  partner: Partner | null;
  // 自己破産した年齢(していなければ null)。7年は、銀行やカードで借りられない。
  bankrupt: number | null;
  abroad: Abroad | null;
  kidList: KidInfo[];
  childcare?: { kind: CareKind; since: number }; // いまの、子どもの預け先(いちばん下の子が小学校に入るまで)
  pets: PetInfo[];
  // 親が亡くなる、あなたの年齢(母・父)。
  parentDeath: { mother: number; father: number };
  parentOffset: { mother: number; father: number };
  married: boolean;
  kids: number;
  owned: boolean;
  withParents: boolean;
  stayingSingle: boolean;
  childFree: boolean;
  caregiving: boolean;
  workLong: boolean;
  // 自分で決めた退職の年齢(未選択なら標準の定年)。
  retireAt: number | null;
  employment: Employment;
  firm: Firm;
  major: Major | null;
  // 専攻・学科の詳しい分類(jp-majors の id)。卒業後の進路の候補に使う。
  field: string | null;
  // 職種の中での違い(看護と介護、大手と中小など)による給料の倍率。
  payMult: number;
  // いまの景気(年齢ごとの指数)。選択の効果が景気に左右されるとき、ここを見る。
  econ: number;
  marriageBias: number;
  childWish: number;
  homeBias: number;
  stats: Stats;
};

// free は、本人が自分の言葉で書いた文章(公開時には伏せる)。label は、伏せたときに出す「読み取った内容」。
// 借金。borrower の暮らしを、ゆっくり重くする。
export type LenderId = "family" | "friend" | "bank" | "card" | "shark";
export type Debt = { lender: LenderId; amount: number; rate: number; since: number; missed: number };
export type LenderDef = { id: LenderId; label: string; rate: number; bonds: number; joy: number; health: number; note: string };

// 恋人・配偶者。名前は、乱数で作る。
export type Partner = { given: string; family: string; since: number; status: "crush" | "dating" | "married" | "ex"; mbti?: string | null; gender?: PartnerGender; sex?: "female" | "male" };

// 海外で暮らしているとき。country は国の名前。収入・物価は、日本を1としたときの倍率。
// 留学中は study、在留資格は visa(留学 → 就労 → 永住 → 国籍)。permAt は、永住権が認められる年齢。
export type Abroad = {
  country: string;
  city: string;
  incomeFactor: number;
  costFactor: number;
  since: number;
  study?: { until: number; kind: "lang" | "college" | "grad" };
  visa?: "student" | "work" | "permanent" | "citizen";
  permAt?: number;
};
export type CountryDef = { id: string; name: string; cities: string[]; incomeFactor: number; costFactor: number; kw: RegExp; lines: string[] };

// 習い事(大人も子どもも、いつでも始める・やめる。同時にできるのは5つまで)。
// 活動の性質(性格との向き不向きに使う)。
export type ActTag = "social" | "solo" | "creative" | "logic" | "outdoor" | "craft" | "service" | "stage" | "steady";

export type LessonDef = {
  tags?: ActTag[];
  // この性格(MBTI の正規表現)の人にだけ、選べる活動。
  needs?: string;
  id: string;
  label: string;
  group: string;
  minAge: number;
  maxAge?: number;
  costMan: number; // 年間の費用(万円)。子どもの場合は、親が払う。
  effect: Partial<Stats>; // 続けているあいだ、毎年の変化
  note: string;
  milestones: { years: number; text: string; delta?: Partial<Stats> }[];
};
export type TakenLesson = { id: string; since: number };

// アルバイト。同時にひとつ。
export type PartTimeDef = {
  tags?: ActTag[];
  id: string;
  label: string;
  minAge: number;
  yearlyMan: number; // 年収の目安(万円)
  effect: Partial<Stats>; // 続けているあいだ、毎年の変化
  note: string;
  milestones: { years: number; text: string; delta?: Partial<Stats> }[];
};
// 出馬(議員・首長)。
// costMan = 供託金(depositMan)+ 選挙運動の費用(campaignMan)。供託金は、一定の得票があれば、戻る。
export type OfficeDef = { id: string; label: string; minAge: number; costMan: number; depositMan: number; campaignMan: number; win: number; payMult: number; term: number; note: string };
export const MAX_LESSONS = 5;

// 子ども・ペット・親
// sex: 生まれたとき、50%ずつで決まる。
// 分岐の前に生まれていた子どもは、名前も性別も決まっていない(anon)。
export type KidInfo = { name: string; bornAge: number; sex: "boy" | "girl" | "unknown"; anon?: boolean };
export type PetInfo = { name: string; kind: string; adoptedAge: number; died?: boolean };
// 名づけの待ち(子どもが生まれた、ペットを迎えた)。
export type NamingRequest = { kind: "child" | "pet"; index: number; label: string };

// fx は、この出来事で、グラフ(能力値・資産)がどう動いたか。money は資産の増減(円)。
export type EventFx = { money?: number; stats?: Partial<Stats> };
export type GameEvent = { age: number; event: string; weight: number; tag?: Tag; free?: boolean; label?: string; fx?: EventFx };

export type GameState = {
  seed: number;
  person: Person;
  events: GameEvent[];
  done: string[];
  wallet: Wallet;
  // 数年後に起きる出来事の予約。
  later: Later[];
  // 選択を求める出来事の順番待ち(EventQuestionDef の id)と、名づけの待ち。
  queue: string[];
  naming: NamingRequest[];
  deathAge: number | null;
  // 亡くなった原因(画面に出す短い言葉)。
  deathCause: string | null;
  deathNote?: DeathNote;
  // 二つの人生で、別々にしたい乱数(突然の死などを、人生ごとに変えるため)。
  salt: number;
  // 70歳(それより前に亡くなった場合は亡くなる時点)の姿。最後の情景に使う。
  snap: Person | null;
  // 毎年の記録(年齢ごとの資産・幸福度・健康)。二つの人生の見比べに使う。
  series?: SeriesPoint[];
  // これまでに達成した実績の id(毎年、更新する。仕事や資産のように、あとで変わるものも、達成した時点で、残す)。
  unlocked?: string[];
};

// 選択肢は枝分かれする。path は、根から選んだ順の id。
// 手入力は、辞書で読み取る。tag は、辞書で読み取れなかったときの「近い方向」(任意)。
export type Choice = { kind: "option"; path: string[] } | { kind: "custom"; text: string; tag: Tag | null };

// お金の使い道の種類(辞書で分類する)。
export type SpendCategory = "learn" | "trip" | "family" | "give" | "self" | "business" | "hobby" | "home" | "car" | "invest" | "save" | "social" | "pet";

// 手入力の文章から読み取った、人生の出来事。
export type IntentRule = {
  id: string;
  label: string;
  test: RegExp;
  // 動詞などの手がかり。あれば、これも含まれているときだけ当てはまる。
  also?: RegExp;
  // 状態を書き換え、年表に残す一文を返す(当てはまらなければ空文字)。
  apply: (s: GameState, rng: Rng, data: CountryData, m: RegExpMatchArray) => string;
};

// 数年後に起きる結果。使い道の結果を、少し先の年表に載せる。
// cashMan は貯金の増減(万円)、divorce は離婚、fired は職を失うこと。
export type Later = { age: number; event: string; weight: number; delta?: Partial<Stats>; payMult?: number; cashMan?: number; divorce?: boolean; fired?: boolean; petDied?: string };
// 選択のなかで予約する、数年後の出来事(years 年後)。エンジンが Later に直す。
export type Scheduled = Omit<Later, "age"> & { years: number };

export type SpendPlan = {
  start: string; // 直後に始めたこと
  effect: Partial<Stats>;
  payoff?: { years: number; chance: number; good: { event: string; delta?: Partial<Stats>; payMult?: number }; bad?: { event: string; delta?: Partial<Stats> } };
};

export type SpendCategoryDef = {
  id: SpendCategory;
  label: string;
  tag: Tag;
  test: RegExp;
  // 金額つきで使うとき、この使い道が代わりに表すので、読み取らない出来事(IntentRule の id)。
  subsumes?: string[];
  // その人の特徴と金額(万円)から、直後の行動と結果を組み立てる。
  plan: (p: Person, man: number, rng: Rng, data: CountryData, econ: number, text: string) => SpendPlan;
};

// 選択を求めない出来事(風邪で寝込んだ、いじめにあった、など)。年齢と状況で、起きやすさが変わる。
export type AutoEvent = {
  id: string;
  // 0 なら、いまは起きない。大きいほど起きやすい(他の出来事との相対的な重み)。
  weight: (p: Person, econ: number) => number;
  // 状態を書き換え、年表に残す文(または複数)を返す。
  apply: (s: GameState, rng: Rng, data: CountryData) => string | string[];
  // 年表で目立たせる強さ(既定 45)。
  importance?: number;
};

// 選択を求める出来事(不倫・裁判・ペットなど)。
export type EventQuestionDef = {
  id: string;
  // 出来事が起きる直前に、状態を整える(例: 気になる人の名前を決める)。
  prepare?: (s: GameState, rng: Rng, data: CountryData) => void;
  weight: (p: Person, econ: number) => number;
  // 出来事が起きたときに年表に残す文。
  intro: (p: Person) => string;
  question: (p: Person) => TurningQuestion;
};

export type Interpretation = {
  actions: IntentRule[];
  category: SpendCategory | null;
  amountMan: number | null;
};

// 選択の場面に添える、いまの状況(景気)。
export type Env = { econ: number; econLabel: string };

export type TurningQuestion = { title: string; prompt: string; options: TurningOption[] };

export type TurningOption = {
  id: string;
  label: string;
  // 選ばないまま時間が進む場合(今の自分の将来)に選ばれる標準の道。
  auto?: boolean;
  show?: (p: Person) => boolean;
  // 確実にかかる費用(万円)。手持ちのお金で払えないときは、選択肢に出さない(auto の道は除く)。
  cost?: (p: Person) => number;
  // 状態を書き換え、年表に残す一文を返す(残さないなら空文字)。
  apply: (p: Person, rng: Rng, data: CountryData) => string;
  // 選択肢の下に出す、細かい説明(いまの地域・年齢・景気に応じた給料や費用の目安など)。
  detail?: (p: Person, env: Env, data: CountryData) => string;
  // さらに細かく選ぶ、次の質問。あれば、これを選んだあとに出る。
  children?: (p: Person) => TurningQuestion;
};

export type TurningPoint = {
  id: string;
  age: number | ((p: Person) => number);
  title: string;
  prompt: string;
  // 状況で変わる本文(あれば prompt より優先)。
  promptFn?: (p: Person) => string;
  when?: (p: Person) => boolean;
  // true の間は、答えても同じ場面をもう一度出す(例: 大学院に進んだあと、もう一度就職を選ぶ)。
  repeatWhile?: (p: Person) => boolean;
  options: TurningOption[];
};

// ターニングポイントの「そのときの思い」。ここで、具体的な道の候補が絞られる。
// options は、その思いにあてはまる道の id。jobFilter は、仕事の分岐で、あてはまる職種の条件。どちらもなければ、すべて。
export type BranchMotive = {
  id: string;
  label: string;
  note?: string;
  options?: string[];
  jobFilter?: (j: JobDef, s: CurrentSelf | null) => boolean;
};

export type BranchOption = {
  id: string;
  label: string;
  // 今の自分がすでにこの道を選んでいる場合は true(候補から外す)。
  matches: (s: CurrentSelf) => boolean;
  apply: (p: Person, rng: Rng, data: CountryData) => string;
};

// 人生ひとつ分の要約。比較画面で使う。
export type Extra = { stress: number; trust: number; career: number; charm: number };
export type SeriesPoint = { age: number; net: number; joy: number; health: number; inc?: number; mar?: boolean; kids?: number; money?: number; bonds?: number; learn?: number; cash?: number; inv?: number; debt?: number; econ?: number; flow?: number; stress?: number; trust?: number; career?: number; charm?: number };
// 人生の大きな分かれ目(能力値や資産が大きく動いた出来事)。
export type TurningMoment = { age: number; event: string; fx?: EventFx; impact: number };

// 亡くなった原因と、その理由。disease は、病気の説明(jp-death.ts)への鍵。
export type DeathNote = { cause: string; disease: string; reasons: string[] };

export type LifeSummary = {
  death?: DeathNote;
  turning?: TurningMoment[];
  series?: SeriesPoint[];
  deathAge: number;
  deathCause: string;
  echo: Echo;
  // 公開用に、持病・MBTI・自由記述・細かい地名を除いたもの。
  pub: Echo;
  // 最終的な資産(万円)と、そのうち運用の損益(万円)。
  assets: { total: number; pnl: number };
  stats: Stats;
  kids: number;
  married: boolean;
  // 達成した実績の id(lib/achievements.ts)。
  achievements?: string[];
};

// 国ごとのデータパック。世界版では国ごとにこの型の値を用意する。
export type CountryData = {
  prefectures: { name: string; region: Region }[];
  ailments: { id: Ailment; label: string; healthDelta: number; illness: number; income: number; joy: number }[];
  conditions: { id: Condition; label: string; healthBase: number; illness: number; income: number }[];
  regionLabel: Record<Region, string>;
  occLabel: Record<Occ | "retired" | "student", string>;
  jobs: JobDef[];
  cities: Record<Region, string[]>;
  workStartAge: Record<Edu, number>;
  retireAge: number;
  prior: { background: Record<Background, number> };
  transition: { occ: Record<Occ, number>; region: Record<Region, Record<Region, number>> };
  // 亡くなる確率のうち、事故・急病などの「出来事によるもの」の割合(年齢別)。
  curves: {
    // 病気・うつなどで死期が早まる設計の影響を、全体の平均寿命が公表値に合うよう、ならすための係数。
    mortalityScale: Record<Sex, number>;
    suddenShare: Curve;
    marriageRate: Curve;
    birthRate: Curve;
    jobChange: Curve;
    moveRate: Curve;
    illnessRate: Curve;
    purchaseRate: Curve;
    mortality: Record<Sex, Curve>;
  };
  regionFactor: { marriage: Record<Region, number>; purchase: Record<Region, number> };
  income: {
    base: Record<Occ | "retired", number>;
    ageFactor: Curve;
    regionFactor: Record<Region, number>;
    sexFactor: Record<Sex, number>;
    // 女性の賃金が、男性に対して、年齢ごとにどれだけか(新卒は、ほぼ同じで、年齢とともに差が開く)。
    femaleAgeFactor: Curve;
    eduFactor: Record<Edu, number>;
    employmentFactor: Record<Employment, number>;
    firmFactor: Record<Firm, number>;
    // 景気が1上がると、給料がどれだけ動くか(職種ごとの敏感さ)。
    econSensitivity: Record<Occ, number>;
    majorFactor: Record<Major, number>;
  };
  econLabel: (level: number) => string;
  branches: Record<BranchKind, { label: string; defaultAge: number; minAge: number; options: BranchOption[]; motives: BranchMotive[] }>;
  turningPoints: TurningPoint[];
  countries: CountryDef[];
  lessons: LessonDef[];
  partTimes: PartTimeDef[];
  offices: OfficeDef[];
  lifeEvents: AutoEvent[];
  names: { surname: string[]; boy: string[]; girl: string[]; neutral: string[]; dog: string[]; cat: string[]; small: string[] };
  eventQuestions: EventQuestionDef[];
  intents: IntentRule[];
  spendCategories: SpendCategoryDef[];
  assets: AssetDef[];
  cashflow: {
    takeHome: number; // 手取りの割合
    saveRate: number; // 黒字のうち貯金に回る割合
    pension: number; // 退職後の年収(万円)
    retiredNeed: number; // 退職後の生活費(万円)
    startSavings: Curve; // 年齢ごとの貯金の目安(万円)
    backgroundFactor: Record<Background, number>;
  };
  tags: { id: Tag; label: string; keywords: RegExp }[];
  stageLabel: (age: number, occ: Person["occ"]) => string;
  // 毎年の「いま」のひとこと(画面の彩り。年表には残さない)。
  vignette: (p: Person, seed: number) => string;
  // 日常の小さな出来事の候補(年齢の段階ごと)。
  smallEvents: Record<"child" | "teen" | "young" | "mid" | "senior", string[]>;
  compose: (p: Person, money: Money, rng: Rng, data: CountryData) => Echo["scene"];
};

export type { Rng };
