import { JOBS as CATALOG } from "@/lib/sim/data/jp-jobs";
import { HOME_PRICE, monthlyMan, passRate } from "@/lib/sim/data/jp-turning";
import { COUNTRIES } from "@/lib/sim/data/jp-countries";
import { assignJob, bump, fullName, moveAbroad, moveHome, moveTo, randomPartner } from "@/lib/sim/helpers";
import { incomeOf } from "@/lib/sim/salary";
import { weighted } from "@/lib/sim/rng";
import type { CountryData, GameState, IntentRule, Occ, Region } from "@/lib/sim/types";

// 手入力の文章から、人生の出来事を読み取る辞書(日本語)。AI は使わず、言葉の手がかりで読み取る。
// 動詞(引っ越す・なる・始める…)と、対象(場所・職業・学び…)が、そろったときに当てはまる。

const MOVE_VERBS = /引っ越|引越|移住|移り住|上京|住む|住もう|転居|戻る|帰る|移る|暮らす/;
const JOB_VERBS = /なる|なりたい|目指|転職|就職|就く|始め|働|仕事|として|入社|採用|勤め|やる|やりたい/;

const PLACES: { re: RegExp; region?: Region; birth?: boolean }[] = [
  { re: /地元|故郷|ふるさと/, birth: true },
  { re: /東京|都内|23区|世田谷|杉並|江戸川|足立|板橋|練馬|大田/, region: "tokyo" },
  { re: /大阪|名古屋|福岡|札幌|仙台|横浜|川崎|さいたま|埼玉|神戸|西宮|吹田|京都|広島|千葉|大都市|都会/, region: "metro" },
  { re: /金沢|松山|熊本|静岡|新潟|岡山|浜松|盛岡|前橋|長岡|倉敷|地方都市|地方/, region: "local" },
  { re: /田舎|農村|郊外|山間|離島|島|田園|自然の多い|自然のある/, region: "rural" },
];

function findCity(data: CountryData, token: string): { region: Region; city: string } | null {
  for (const region of Object.keys(data.cities) as Region[]) {
    const city = data.cities[region].find((c) => c.includes(token));
    if (city) return { region, city };
  }
  return null;
}

const OVERSEAS = new RegExp(`海外|外国|異国|${COUNTRIES.map((c) => c.kw.source).join("|")}`);

const rules: IntentRule[] = [
  // ---- 住む場所 ----
  {
    id: "emigrate",
    label: "海外移住",
    test: OVERSEAS,
    also: /移住|住む|住もう|暮らす|暮らし|引っ越|引越|赴任|渡る|移る|定住|永住/,
    apply: (s, rng, data, m) => {
      const p = s.person;
      const text = m.input ?? "";
      const named = COUNTRIES.find((c) => c.kw.test(text));
      if (p.abroad && named && p.abroad.country === named.name) return "";
      const city = moveAbroad(p, rng, data, named?.id);
      return `${city}に移り住んだ`;
    },
  },
  {
    id: "return_home",
    label: "帰国",
    test: /帰国|日本に(戻|帰)|日本へ(戻|帰)/,
    apply: (s, rng, data) => {
      const p = s.person;
      if (!p.abroad) return "";
      const city = moveHome(p, rng, data);
      bump(p, { bonds: 4, joy: 3 });
      return `日本に帰国し、${city}で暮らし始めた`;
    },
  },
  {
    id: "move",
    label: "引っ越し",
    test: new RegExp(`(${PLACES.map((x) => x.re.source).join("|")})`),
    also: MOVE_VERBS,
    apply: (s, rng, data, m) => {
      const p = s.person;
      const text = m.input ?? "";
      if (/実家|親と同居/.test(text)) return "";
      const hit = PLACES.find((x) => x.re.test(text));
      if (!hit) return "";
      if (hit.birth) {
        p.region = p.birthRegion;
        p.city = p.birthPlace;
        p.withParents = false;
        bump(p, { bonds: 5 });
        return `地元の${p.city}に戻った`;
      }
      const token = m[0];
      const named = findCity(data, token);
      const region = named?.region ?? hit.region!;
      if (region === p.region && !named) return "";
      if (named) {
        p.region = named.region;
        p.city = named.city;
        p.withParents = false;
      } else moveTo(p, rng, data, region);
      bump(p, { bonds: -2, money: -2 });
      return `${p.city}に引っ越した`;
    },
  },
  {
    id: "parents_home",
    label: "実家に戻る",
    test: /実家に(戻|帰)|親と同居|親元/,
    apply: (s) => {
      const p = s.person;
      p.region = p.birthRegion;
      p.city = p.birthPlace;
      p.withParents = true;
      bump(p, { bonds: 5, money: 2 });
      return "実家に戻り、親と暮らし始めた";
    },
  },

  // ---- 仕事(厚労省の職種区分にもとづく職種の言葉を、辞書にする) ----
  ...CATALOG.filter((j) => j.kw).map<IntentRule>((j) => ({
    id: `job_${j.id}`,
    label: j.title,
    test: j.kw!,
    also: JOB_VERBS,
    apply: (s, rng, data) => {
      const p = s.person;
      if (p.age < 16 || p.occ === "retired") return "";
      // 資格や試験が必要な職種は、頭の良さと学びで決まる確率で届く。
      if (j.qual) {
        let r = passRate(p, j.qual.diff);
        if (j.qual.grad && p.edu !== "grad") r *= 0.15;
        if (rng() > r) {
          const title = assignJob(p, j.occ, rng, data);
          return `${j.title}を目指したが届かず、${title}として働くことになった(合格の目安は約${Math.round(r * 100)}%だった)`;
        }
      }
      p.occ = j.occ;
      p.job = j.id;
      p.payMult = j.mult;
      p.employment = j.selfDefault ? "self" : "regular";
      p.sector = "private";
      if (j.occ === "agri") {
        p.region = "rural";
        p.city = data.cities.rural[Math.floor(rng() * data.cities.rural.length)];
        p.withParents = false;
      }
      let text = `${j.title}として働き始めた`;
      if (!j.selfDefault && p.econ < -0.6 && rng() < 0.45) {
        p.employment = "nonregular";
        text += "(採用が絞られた時期で、非正規からのスタートになった)";
      }
      return text;
    },
  })),
  {
    id: "go_public",
    label: "公務員",
    test: /公務員|役所|市役所|自治体|県庁|警察官|消防士/,
    also: JOB_VERBS,
    apply: (s, rng, data) => {
      const p = s.person;
      if (p.age < 16 || p.occ === "retired") return "";
      const r = passRate(p, 55);
      if (rng() > r) return `公務員試験に挑戦したが、合格には届かなかった(合格の目安は約${Math.round(r * 100)}%だった)`;
      if (p.occ === null) assignJob(p, "office", rng, data, "office_general");
      p.sector = "public";
      p.employment = "regular";
      return "公務員として働き始めた";
    },
  },
  {
    id: "go_self",
    label: "独立",
    test: /フリーランス|起業|独立|開業|自営|個人事業/,
    also: /する|したい|目指|始め|なる|やる|やりたい|を決/,
    apply: (s, rng, data) => {
      const p = s.person;
      if (p.age < 20 || p.occ === "retired") return "";
      if (p.occ === null) assignJob(p, "sales", rng, data);
      p.employment = "self";
      p.sector = "private";
      p.payMult *= 0.9;
      bump(p, { money: Math.round((rng() - 0.4) * 10), learn: 2 });
      return "独立して、自分の仕事を始めた";
    },
  },
  {
    id: "job_change",
    label: "転職",
    test: /転職/,
    apply: (s, rng, data) => {
      const p = s.person;
      if (!p.occ || p.occ === "retired") return "";
      // 景気しだいで、条件のよい転職になるか、厳しい転職になるか。
      const good = p.econ >= -0.4 || rng() < 0.5;
      const next = weighted<Occ>(rng, { ...data.transition.occ, [p.occ]: 0 });
      p.occ = next;
      p.payMult = good ? 1.05 : 0.88;
      return good ? `${data.occLabel[next]}に転職した` : `不況の中、条件は下がったが、${data.occLabel[next]}に転職した`;
    },
  },
  {
    id: "promote",
    label: "昇進",
    test: /昇進|管理職|出世|リーダー/,
    apply: (s) => {
      const p = s.person;
      if (!p.occ || p.occ === "retired" || p.employment === "self") return "";
      p.payMult *= 1.1;
      bump(p, { money: 3, health: -3, bonds: -1 });
      return "昇進をめざして、責任ある仕事に力を注いだ";
    },
  },
  {
    id: "side_job",
    label: "副業",
    test: /副業|パラレル|ダブルワーク/,
    apply: (s, rng) => {
      bump(s.person, { money: Math.round((rng() - 0.35) * 12), learn: 3, health: -2 });
      return "副業を始め、働き方を広げた";
    },
  },
  {
    id: "reduce_work",
    label: "仕事を減らす",
    test: /仕事を減|時短|ワークライフ|休職|育休|産休|育児休業|セミリタイア/,
    apply: (s) => {
      const p = s.person;
      if (!p.occ || p.occ === "retired") return "";
      p.payMult *= 0.88;
      bump(p, { health: 6, bonds: 4, money: -2 });
      return "仕事を減らして、暮らしの時間を増やした";
    },
  },
  {
    id: "retire",
    label: "退職",
    test: /定年|リタイア|早期退職|仕事を辞め|会社を辞め|退職/,
    apply: (s) => {
      const p = s.person;
      if (!p.occ || p.occ === "retired") return "";
      if (p.age >= 50) {
        p.occ = "retired";
        bump(p, { health: 3 });
        return "仕事を退いた";
      }
      p.payMult *= 0.85;
      bump(p, { health: 4, money: -4 });
      return "会社を辞めて、次の道を探し始めた";
    },
  },
  {
    id: "work_long",
    label: "働き続ける",
    test: /働き続け|生涯現役|ずっと働/,
    apply: (s) => {
      s.person.workLong = true;
      bump(s.person, { money: 3, health: -1 });
      return "働けるかぎり働き続けると決めた";
    },
  },

  // ---- 学び ----
  {
    id: "grad",
    label: "大学院",
    test: /大学院/,
    apply: (s) => {
      const p = s.person;
      bump(p, { learn: 12, money: -6 });
      if (p.occ && p.occ !== "retired") p.payMult *= 1.06;
      return p.age >= 26 ? "社会人として、大学院で学び始めた" : "大学院で、学びを深め始めた";
    },
  },
  {
    id: "univ",
    label: "大学で学ぶ",
    test: /大学(に|へ)?(入|通|進|行)|入学|編入|入り直|学び直/,
    apply: (s) => {
      const p = s.person;
      bump(p, { learn: 8, money: -5 });
      return p.age >= 23 ? "社会人として、学校に通って学び直し始めた" : "学びを深めるために、学校に進んだ";
    },
  },
  {
    id: "study_abroad",
    label: "留学",
    test: /留学/,
    apply: (s) => {
      bump(s.person, { learn: 10, money: -10, bonds: 4 });
      return "留学して、異国の地で学んだ";
    },
  },
  {
    id: "certificate",
    label: "資格",
    test: /資格|検定|免許|試験に合格|合格を目指/,
    apply: (s, rng) => {
      const p = s.person;
      bump(p, { learn: 8, money: -2 });
      if (p.occ && p.occ !== "retired" && rng() < 0.4 + p.stats.learn / 250) {
        p.payMult *= 1.04;
        return "資格を取得して、仕事の幅が広がった";
      }
      return "資格の取得に挑戦した";
    },
  },
  {
    id: "language",
    label: "語学",
    test: /語学|英語|中国語|韓国語|英会話/,
    apply: (s) => {
      bump(s.person, { learn: 6 });
      return "語学の勉強を始めた";
    },
  },

  // ---- 家族 ----
  {
    id: "marry",
    label: "結婚",
    test: /結婚(する|したい|を決|します)|プロポーズ|入籍|婚約/,
    apply: (s, rng, data) => {
      const p = s.person;
      if (p.married) return "";
      p.married = true;
      p.withParents = false;
      p.stayingSingle = false;
      const spouse = p.partner && p.partner.status === "dating" ? p.partner : randomPartner(rng, data, p.age, "dating", p.mbti, p);
      spouse.status = "married";
      p.partner = spouse;
      bump(p, { bonds: 8, money: -3 });
      return `${fullName(spouse)}さんと結婚した`;
    },
  },
  {
    id: "divorce",
    label: "離婚",
    test: /離婚|別居/,
    apply: (s) => {
      const p = s.person;
      if (!p.married) return "";
      p.married = false;
      const ex = p.partner ? `${p.partner.given}さんと` : "";
      if (p.partner) p.partner.status = "ex";
      bump(p, { bonds: -6, money: -6, health: -3 });
      return `${ex}離婚して、ひとりで新しい生活を始めた`;
    },
  },
  {
    id: "want_kids",
    label: "子ども",
    test: /(子ども|子供|赤ちゃん|出産|妊娠)/,
    also: /ほしい|欲しい|持つ|授か|産む|生ま|作る|つくる|出産|妊娠|迎え/,
    apply: (s) => {
      const p = s.person;
      p.childWish = 2.2;
      p.childFree = false;
      bump(p, { bonds: 3 });
      return p.married ? "子どもを迎える準備を始めた" : "いつか子どもを迎えたいと思うようになった";
    },
  },
  {
    id: "no_kids",
    label: "子どもを持たない",
    test: /(子ども|子供)(は|を)?(持たない|いらない|作らない)|DINK|ディンク/,
    apply: (s) => {
      s.person.childFree = true;
      return "子どもを持たない暮らしを選んだ";
    },
  },
  {
    id: "single",
    label: "ひとりで生きる",
    test: /独身|ひとりで生きる|一人で生きる|結婚しない|おひとりさま/,
    apply: (s) => {
      s.person.stayingSingle = true;
      s.person.marriageBias = 0.1;
      return "ひとりで生きていくと決めた";
    },
  },
  {
    id: "dating",
    label: "出会い",
    test: /婚活|出会い|恋人|彼氏|彼女|パートナーを|同棲/,
    apply: (s, rng, data, m) => {
      const p = s.person;
      if (p.married) return "";
      p.marriageBias = 2.5;
      p.stayingSingle = false;
      bump(p, { bonds: 4 });
      // 「恋人」「彼氏」などの言葉があれば、交際相手が現れる(名前は、乱数で決まる)。
      if (/恋人|彼氏|彼女|同棲/.test(m.input ?? "") && (!p.partner || p.partner.status === "ex")) {
        p.partner = randomPartner(rng, data, p.age, "dating", p.mbti, p);
        return `${fullName(p.partner)}さんと出会い、交際が始まった`;
      }
      return "出会いを求めて、動き始めた";
    },
  },
  {
    id: "care_parents",
    label: "親の介護",
    test: /介護|親の面倒|親を支え|親の世話/,
    also: /する|始め|向き合|支え|看|面倒|世話/,
    apply: (s) => {
      const p = s.person;
      p.caregiving = true;
      bump(p, { bonds: 4, health: -3, money: -4 });
      return "親の介護に向き合い始めた";
    },
  },

  // ---- 住まい ----
  {
    id: "buy_home",
    label: "住まいを買う",
    test: /家を買|マイホーム|マンションを(買|購入)|一戸建て|戸建て|住宅を(買|購入)|住宅購入|家を建て/,
    apply: (s, rng, data) => {
      const p = s.person;
      if (p.owned) return "";
      const price = HOME_PRICE[p.region] * 0.85;
      const takeHome = incomeOf(p, data, p.econ) * (p.married ? 1.35 : 1) * data.cashflow.takeHome;
      if (monthlyMan(price) * 12 > takeHome * 0.35) return "住宅の購入を考えたが、ローンの審査が通らなかった";
      p.owned = true;
      p.withParents = false;
      bump(p, { money: -3 });
      return "ローンを組んで、住まいを買った";
    },
  },
  {
    id: "rent",
    label: "賃貸",
    test: /賃貸|家は買わない|借りて暮らす/,
    apply: (s) => {
      s.person.homeBias = 0.6;
      return "賃貸のまま、身軽に暮らすことにした";
    },
  },

  // ---- 資産・健康・つながり ----
  {
    id: "stocks",
    label: "株を始める",
    test: /株|投資|NISA|ニーサ|積立|ファンド|資産運用/,
    apply: (s) => {
      if (s.wallet.stocks) return "";
      s.wallet.stocks = true;
      return "株式投資を始めた";
    },
  },
  {
    id: "health",
    label: "健康づくり",
    test: /禁煙|禁酒|運動|ジム|ランニング|ダイエット|健康|食事を見直|睡眠|ヨガ|筋トレ/,
    apply: (s) => {
      bump(s.person, { health: 7 });
      return "健康のために、生活を見直した";
    },
  },
  {
    id: "treatment",
    label: "治療・療養",
    test: /療養|入院|治療|通院|手術|リハビリ/,
    apply: (s) => {
      bump(s.person, { health: 10, money: -3 });
      return "治療と療養に向き合った";
    },
  },
  {
    id: "social",
    label: "人とつながる",
    test: /友人|友達|仲間|ボランティア|サークル|コミュニティ|地域活動|町内会|交流/,
    apply: (s) => {
      bump(s.person, { bonds: 7 });
      return "人とのつながりを広げた";
    },
  },
  {
    id: "travel",
    label: "旅",
    test: /旅に出|旅行|世界一周|放浪|旅をする|バックパック/,
    apply: (s) => {
      bump(s.person, { health: 3, bonds: 3, money: -3 });
      return "旅に出て、日常から離れた時間を過ごした";
    },
  },
  {
    id: "rest",
    label: "休む",
    test: /のんびり|ゆっくり|休養|スローライフ|充電|休む/,
    apply: (s) => {
      bump(s.person, { health: 6 });
      return "しばらく、ゆっくり休む時間をとった";
    },
  },
  {
    id: "challenge",
    label: "挑戦",
    test: /挑戦|チャレンジ|冒険|思い切って|賭け/,
    apply: (s, rng) => {
      bump(s.person, { money: Math.round((rng() - 0.4) * 20), learn: 3 });
      return "思い切って、新しいことに挑戦した";
    },
  },
  {
    id: "saving",
    label: "貯める",
    test: /貯金|貯める|節約|倹約|備え|堅実/,
    apply: (s) => {
      bump(s.person, { money: 4 });
      return "お金を貯めることに力を注いだ";
    },
  },
];

export const intents = rules;
export type { GameState };
