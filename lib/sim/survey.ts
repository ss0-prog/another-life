import type { Stats } from "@/lib/sim/types";

// 人生をはじめる前の、いまの暮らしについての質問(事前の調査)。答えで、はじまりの能力値(グラフの出発点)が決まる。
// 点数の割りふりは、設計上の目安で、心理尺度や統計にもとづくものではない。

export type SurveyKey = "feel" | "tie" | "body" | "wealth" | "habit";
export type Survey = Partial<Record<SurveyKey, string>>;

export type SurveyQuestion = {
  key: SurveyKey;
  stat: keyof Stats;
  node: string;
  q: string;
  prompt: string;
  options: { value: string; label: string; score: number }[];
};

export const SURVEY: SurveyQuestion[] = [
  {
    key: "feel",
    stat: "joy",
    node: "幸福度",
    q: "いまの暮らしにどれくらい満足していますか？",
    prompt: "「幸福度」のはじまりの値になります。感じたままで大丈夫です。",
    options: [
      { value: "great", label: "とても満足している", score: 85 },
      { value: "good", label: "まあ満足している", score: 68 },
      { value: "ok", label: "ふつう", score: 50 },
      { value: "low", label: "あまり満足していない", score: 32 },
      { value: "bad", label: "つらい・不満が大きい", score: 15 },
    ],
  },
  {
    key: "tie",
    stat: "bonds",
    node: "つながり",
    q: "悩みを話せる人はどれくらいいますか？",
    prompt: "家族・友人・同僚など。「つながり」のはじまりの値になります。",
    options: [
      { value: "many", label: "何人もいる", score: 80 },
      { value: "some", label: "数人いる", score: 62 },
      { value: "one", label: "ひとりだけ", score: 42 },
      { value: "none", label: "ほとんどいない", score: 22 },
    ],
  },
  {
    key: "body",
    stat: "health",
    node: "健康",
    q: "いまの体の調子はどうですか？",
    prompt: "持病とは別に、ふだんの体力や調子です。「健康」のはじまりの値になります。",
    options: [
      { value: "great", label: "とても元気", score: 88 },
      { value: "good", label: "おおむね元気", score: 72 },
      { value: "ok", label: "ふつう", score: 55 },
      { value: "bad", label: "不調がちで、疲れやすい", score: 38 },
      { value: "poor", label: "かなりつらい", score: 22 },
    ],
  },
  {
    key: "wealth",
    stat: "money",
    node: "経済",
    q: "家計や暮らしのお金のゆとりは？",
    prompt: "貯金の額とは別の、暮らしのゆとりの感覚です。「経済」のはじまりの値になります。",
    options: [
      { value: "plenty", label: "ゆとりがある", score: 80 },
      { value: "ok", label: "ふつうに暮らせる", score: 60 },
      { value: "tight", label: "やりくりが、きびしい", score: 40 },
      { value: "hard", label: "毎月、ぎりぎり", score: 22 },
    ],
  },
  {
    key: "habit",
    stat: "learn",
    node: "学び",
    q: "新しいことを学んだり、考えたりする習慣は？",
    prompt: "勉強・読書・資格・仕事での学びなど。「学び」のはじまりの値になります。",
    options: [
      { value: "often", label: "よくしている", score: 78 },
      { value: "some", label: "ときどきしている", score: 58 },
      { value: "rare", label: "あまりしていない", score: 40 },
      { value: "none", label: "ほとんどしていない", score: 24 },
    ],
  },
];

// 答えから、はじまりの能力値をつくる(答えていない項目は、含まれない)。
export function vitalsOf(survey: Survey | undefined): Partial<Stats> {
  const out: Partial<Stats> = {};
  if (!survey) return out;
  for (const q of SURVEY) {
    const ans = survey[q.key];
    const opt = q.options.find((o) => o.value === ans);
    if (opt) out[q.stat] = opt.score;
  }
  return out;
}
