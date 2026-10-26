import type { LessonDef } from "@/lib/sim/types";

// 習い事の一覧。費用や効果は、設計上の仮定(だいたいの目安)。
const L = (id: string, label: string, group: string, minAge: number, costMan: number, effect: LessonDef["effect"], note: string, milestones: LessonDef["milestones"], maxAge?: number): LessonDef => ({ id, label, group, minAge, maxAge, costMan, effect, note, milestones });

export const LESSONS: LessonDef[] = [
  // ---- スポーツ ----
  L("swim", "水泳", "スポーツ", 4, 12, { health: 1.2, joy: 0.5 }, "体力がつき、風邪をひきにくくなる。", [{ years: 2, text: "級が上がり、泳ぎに自信がついた", delta: { joy: 3 } }, { years: 5, text: "大会に出場して、自己ベストを出した", delta: { bonds: 2, joy: 4 } }]),
  L("soccer", "サッカー", "スポーツ", 5, 8, { health: 1.2, bonds: 1 }, "仲間と走るのが楽しい。", [{ years: 2, text: "試合に出られるようになった", delta: { joy: 4 } }, { years: 4, text: "チームで大会に出て、仲間と悔し涙を流した", delta: { bonds: 4 } }]),
  L("baseball", "野球", "スポーツ", 6, 10, { health: 1.0, bonds: 1.2 }, "チームで戦う経験が積める。", [{ years: 3, text: "レギュラーに選ばれた", delta: { joy: 4 } }]),
  L("tennis", "テニス", "スポーツ", 5, 15, { health: 1.0, bonds: 0.6 }, "生涯続けやすいスポーツ。", [{ years: 3, text: "ラリーが続くようになり、試合が楽しくなった", delta: { joy: 3 } }]),
  L("martial", "空手・柔道", "スポーツ", 5, 8, { health: 1.0, bonds: 0.5, learn: 0.3 }, "礼儀と心の強さが身につく。", [{ years: 2, text: "昇級して、帯の色が変わった", delta: { joy: 3 } }, { years: 6, text: "黒帯を取得した", delta: { joy: 6 } }]),
  L("dance", "ダンス", "スポーツ", 4, 10, { health: 0.9, joy: 0.8 }, "体を動かして、表現する楽しさがある。", [{ years: 2, text: "発表会のステージに立った", delta: { joy: 5, bonds: 2 } }]),
  L("gym", "体操・陸上", "スポーツ", 4, 9, { health: 1.3 }, "基礎体力がぐんと伸びる。", [{ years: 3, text: "記録会で、自己ベストを更新した", delta: { joy: 3 } }]),
  L("yoga", "ヨガ・ピラティス", "スポーツ", 16, 10, { health: 1.0, joy: 0.8 }, "心と体を整える時間になる。", [{ years: 1, text: "体の柔らかさと呼吸の深さを実感した", delta: { health: 2, joy: 3 } }]),
  L("fitness", "ジム・ボクシング", "スポーツ", 16, 12, { health: 1.4, joy: 0.4 }, "体を鍛える習慣がつく。", [{ years: 1, text: "体つきが変わり、体力に自信がついた", delta: { health: 3, joy: 3 } }]),
  L("golf", "ゴルフ", "スポーツ", 20, 30, { health: 0.5, bonds: 1.0 }, "人づきあいが広がる。費用はかさむ。", [{ years: 2, text: "仲間とのコンペで、はじめて100を切った", delta: { joy: 4, bonds: 2 } }]),

  // ---- 音楽・芸術 ----
  L("piano", "ピアノ", "音楽・芸術", 3, 14, { learn: 0.8, joy: 0.6 }, "指先と集中力が育つ。", [{ years: 2, text: "発表会で、はじめて人前で演奏した", delta: { joy: 5, bonds: 2 } }, { years: 5, text: "コンクールに出場して、努力が実を結んだ", delta: { joy: 6, learn: 2 } }]),
  L("guitar", "ギター", "音楽・芸術", 8, 12, { joy: 1.0, bonds: 0.6 }, "好きな曲を弾けるようになる。", [{ years: 1, text: "好きな曲を、通して弾けるようになった", delta: { joy: 5 } }, { years: 3, text: "仲間とバンドを組んで、ライブに出た", delta: { bonds: 4, joy: 5 } }]),
  L("violin", "バイオリン", "音楽・芸術", 3, 16, { learn: 0.8, joy: 0.5 }, "耳と根気が鍛えられる。", [{ years: 3, text: "発表会で、ソロを任された", delta: { joy: 5 } }]),
  L("vocal", "歌・ボイトレ", "音楽・芸術", 8, 10, { joy: 1.0, health: 0.3 }, "声を出すのが、気持ちいい。", [{ years: 1, text: "歌声をほめられ、自信がついた", delta: { joy: 4 } }]),
  L("painting", "絵画・造形", "音楽・芸術", 4, 9, { learn: 0.5, joy: 0.9 }, "自分の世界を形にする時間になる。", [{ years: 2, text: "作品が展覧会に飾られた", delta: { joy: 6, bonds: 1 } }]),
  L("calligraphy", "書道", "音楽・芸術", 5, 6, { learn: 0.6, joy: 0.4 }, "姿勢と心が整う。", [{ years: 3, text: "段位を取得した", delta: { joy: 4 } }]),
  L("ballet", "バレエ", "音楽・芸術", 3, 18, { health: 0.8, joy: 0.7 }, "体幹と表現力が育つ。費用はかさむ。", [{ years: 3, text: "発表会で、舞台に立った", delta: { joy: 6, bonds: 2 } }]),
  L("theater", "演劇・ミュージカル", "音楽・芸術", 8, 12, { bonds: 1.0, joy: 0.9 }, "仲間と一つの舞台をつくる。", [{ years: 2, text: "公演を成功させ、拍手に包まれた", delta: { joy: 7, bonds: 3 } }]),

  // ---- 学び ----
  L("english", "英会話", "学び", 4, 15, { learn: 1.2 }, "世界が少し、広がる。", [{ years: 2, text: "外国の人と、ふつうに会話できた", delta: { learn: 3, joy: 4 } }, { years: 4, text: "英語の検定に合格した", delta: { learn: 3 } }]),
  L("abacus", "そろばん・計算", "学び", 5, 6, { learn: 1.0 }, "計算と集中力が身につく。", [{ years: 3, text: "段位を取得した", delta: { learn: 2, joy: 3 } }]),
  L("programming", "プログラミング", "学び", 8, 14, { learn: 1.2, joy: 0.4 }, "ものづくりの楽しさを知る。", [{ years: 1, text: "はじめて、自分でゲームやアプリをつくった", delta: { learn: 3, joy: 5 } }, { years: 4, text: "作品が、コンテストで評価された", delta: { learn: 3, joy: 5 } }]),
  L("cram", "学習塾", "学び", 6, 30, { learn: 2.0, joy: -0.3, health: -0.2 }, "成績は上がりやすいが、ゆとりは減る。", [{ years: 2, text: "苦手科目を克服した", delta: { learn: 3 } }]),
  L("chinese", "中国語・韓国語など", "学び", 14, 14, { learn: 1.0 }, "新しい言葉で、新しい世界が開ける。", [{ years: 2, text: "現地で、簡単な会話ができた", delta: { learn: 3, joy: 4 } }]),
  L("qualification", "資格講座", "学び", 18, 20, { learn: 1.5, money: 0.3 }, "仕事や暮らしに役立つ資格をめざす。", [{ years: 1, text: "資格試験に合格した", delta: { learn: 4, money: 2, joy: 5 } }]),
  L("cooking", "料理教室", "学び", 12, 8, { joy: 0.6, bonds: 0.5, health: 0.3 }, "食卓が、ゆたかになる。", [{ years: 1, text: "家族や友人に、手料理をふるまって喜ばれた", delta: { bonds: 3, joy: 4 } }]),
  L("tea", "茶道・華道", "学び", 12, 10, { joy: 0.7, learn: 0.3 }, "静かな時間のなかで、心が整う。", [{ years: 3, text: "季節の茶会で、お点前を披露した", delta: { joy: 5 } }]),
  L("photo", "写真・映像", "学び", 14, 10, { joy: 0.9, learn: 0.4 }, "日常の景色が、特別に見えてくる。", [{ years: 2, text: "写真展に作品を出展した", delta: { joy: 5, bonds: 2 } }]),
  L("sewing", "手芸・ものづくり", "学び", 10, 6, { joy: 0.7 }, "手を動かす時間が、気持ちをほぐす。", [{ years: 1, text: "はじめての作品が完成し、人に贈った", delta: { joy: 4, bonds: 2 } }]),

  // ---- 趣味(だれかに教わらず、自分のペースで楽しむもの) ----
  L("fishing", "釣り", "趣味", 8, 3, { joy: 1.0, health: 0.4 }, "自然のなかで、ゆっくり過ごせる。", [{ years: 1, text: "はじめて、大きな魚が釣れた", delta: { joy: 5 } }, { years: 4, text: "釣り仲間ができ、休日の楽しみが増えた", delta: { bonds: 3 } }]),
  L("hiking", "登山・ハイキング", "趣味", 10, 4, { health: 1.2, joy: 0.8 }, "山頂からの景色が、日々の疲れを忘れさせる。", [{ years: 2, text: "仲間と、少し高い山の頂に立った", delta: { joy: 5, health: 2 } }]),
  L("camp", "キャンプ", "趣味", 8, 6, { joy: 1.0, bonds: 0.6 }, "火を囲む夜が、心をほぐす。", [{ years: 2, text: "道具が少しずつそろい、キャンプが暮らしの一部になった", delta: { joy: 4, bonds: 2 } }]),
  L("games", "ゲーム・ボードゲーム", "趣味", 6, 3, { joy: 1.1, bonds: 0.4, health: -0.2 }, "夢中になれる時間。やりすぎには注意。", [{ years: 2, text: "ゲームを通じて、遠くの友人ができた", delta: { bonds: 4 } }]),
  L("reading", "読書・映画", "趣味", 8, 2, { learn: 0.8, joy: 0.6 }, "物語が、世界を広げてくれる。", [{ years: 3, text: "感想を語り合える友人ができた", delta: { bonds: 3, joy: 3 } }]),
  L("gardening", "園芸・家庭菜園", "趣味", 10, 2, { joy: 0.8, health: 0.5 }, "育てる楽しみが、毎日に張りをくれる。", [{ years: 1, text: "はじめての収穫を、食卓で味わった", delta: { joy: 5 } }]),
  L("running", "ランニング", "趣味", 10, 2, { health: 1.3, joy: 0.5 }, "走ると頭がすっきりする。", [{ years: 2, text: "はじめて、市民マラソンを完走した", delta: { joy: 6, health: 3 } }]),
  L("diy", "DIY・工作", "趣味", 10, 4, { joy: 0.9, learn: 0.4 }, "自分の手で、暮らしを作る。", [{ years: 2, text: "家具を、自分の手で作りあげた", delta: { joy: 5 } }]),
  L("volunteer", "地域のボランティア", "趣味", 14, 1, { bonds: 1.2, joy: 0.6 }, "人の役に立つことが、自分の支えにもなる。", [{ years: 2, text: "地域の人に、顔と名前を覚えてもらえた", delta: { bonds: 5 } }]),
  L("travel_club", "旅行・街歩き", "趣味", 14, 8, { joy: 1.0, learn: 0.4, bonds: 0.3 }, "知らない街を歩くのが好きになった。", [{ years: 2, text: "行った街の数が、ずいぶん増えた", delta: { joy: 4 } }]),
];

// 活動の性質。性格(MBTI)との向き不向きに使う。
const TAGS: Record<string, LessonDef["tags"]> = {
  swim: ["solo", "outdoor"], soccer: ["social", "outdoor"], baseball: ["social", "outdoor"], tennis: ["social", "outdoor"], martial: ["steady", "solo"], dance: ["stage", "social", "creative"],
  gym: ["solo", "steady"], yoga: ["solo"], fitness: ["solo", "steady"], golf: ["social"], piano: ["solo", "steady"], guitar: ["creative", "social"], violin: ["solo", "steady"], vocal: ["stage", "creative"],
  painting: ["creative", "solo"], calligraphy: ["steady", "solo"], abacus: ["logic", "steady"], programming: ["logic", "solo"], cram: ["logic", "steady"], chinese: ["logic"], qualification: ["steady", "logic"],
  cooking: ["craft", "service"], tea: ["steady", "solo"], photo: ["creative", "solo"], sewing: ["craft", "solo"],
  fishing: ["solo", "outdoor"], hiking: ["outdoor"], camp: ["outdoor", "social"], games: ["logic", "social"], reading: ["solo", "creative"], gardening: ["craft", "steady", "solo"], running: ["solo", "outdoor"],
  diy: ["craft", "creative"], volunteer: ["service", "social"], travel_club: ["outdoor", "social", "creative"],
};
for (const l of LESSONS) l.tags = TAGS[l.id];

// 性格によって、はじめて選べる活動(あてはまる MBTI の人にだけ出る)。
const X = (id: string, label: string, minAge: number, costMan: number, effect: LessonDef["effect"], note: string, needs: string, tags: LessonDef["tags"], milestone: LessonDef["milestones"]): LessonDef => ({ id, label, group: "あなたの性格にあう活動", minAge, costMan, effect, note, milestones: milestone, needs, tags });
LESSONS.push(
  X("debate", "ディベート・弁論", 12, 4, { learn: 1.1, bonds: 0.6 }, "議論で相手を説得する力が鍛えられる(外向きで、論理を重んじる人向け)。", "^E.T", ["social", "logic", "stage"], [{ years: 2, text: "大会で堂々と意見を述べて、拍手を受けた", delta: { joy: 5, learn: 3 } }]),
  X("meditation", "座禅・瞑想", 14, 2, { health: 0.8, joy: 1.2 }, "静かに自分と向き合う時間(内向的な人向け)。", "^I", ["solo", "steady"], [{ years: 2, text: "心が落ち着き、ささいなことに動じなくなった", delta: { joy: 6, health: 2 } }]),
  X("creative_writing", "小説・創作の会", 12, 3, { learn: 0.7, joy: 1.0 }, "想像の世界を、言葉にする(直感型の人向け)。", "^.N", ["creative", "solo"], [{ years: 2, text: "書いた作品が、はじめて人に読まれた", delta: { joy: 6, bonds: 2 } }]),
  X("startup_club", "起業サークル・ビジネスの勉強会", 16, 6, { learn: 1.0, money: 0.5, bonds: 0.6 }, "新しいことを始める人たちの輪(外向きで、直感型の人向け)。", "^EN", ["social", "creative", "logic"], [{ years: 2, text: "仲間と、小さな事業のアイデアを形にした", delta: { money: 3, joy: 4, bonds: 3 } }]),
  X("community_lead", "地域のまとめ役(自治会・PTAの役員など)", 24, 1, { bonds: 1.5, joy: 0.5, health: -0.2 }, "人の世話をして、地域をつなぐ(人づきあいを大切にする人向け)。", "^(E.F|.SF)", ["service", "social", "steady"], [{ years: 3, text: "地域の行事を無事にやり遂げ、感謝された", delta: { bonds: 6, joy: 4 } }]),
  X("workshop", "職人の工房に通う(木工・革細工など)", 14, 5, { learn: 0.8, joy: 0.6, money: 0.3 }, "手を動かして技を磨く(現実的で柔軟な人向け)。", "^.S.P", ["craft", "solo"], [{ years: 2, text: "自分で作った品を、人に喜んでもらえた", delta: { joy: 6, money: 2 } }]),
  X("improv", "即興劇・お笑いライブ", 14, 4, { joy: 1.2, bonds: 0.8 }, "その場の空気で、人を笑わせる(外向きで、柔軟な人向け)。", "^E..P", ["stage", "social"], [{ years: 1, text: "ステージで、はじめて大きな笑いをとった", delta: { joy: 8, bonds: 2 } }]),
  X("study_circle", "研究会・読書会(深く掘り下げる)", 14, 3, { learn: 1.3, joy: 0.5 }, "ひとつの題材を、とことん考える(内向的で、直感型の人向け)。", "^IN", ["solo", "logic", "creative"], [{ years: 2, text: "掘り下げたテーマが、発表の場で評価された", delta: { learn: 4, joy: 5 } }]),
);

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
