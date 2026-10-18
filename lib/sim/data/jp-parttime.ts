import type { OfficeDef, PartTimeDef } from "@/lib/sim/types";

// アルバイト。年収(万円)は、学生の働き方(週に10〜15時間ほど)を想定した目安で、設計上の仮定。
// 社会人が副業として行うと、収入は同じでも、体と時間への負担が増える。
const P = (id: string, label: string, minAge: number, yearlyMan: number, effect: PartTimeDef["effect"], note: string, milestones: PartTimeDef["milestones"]): PartTimeDef => ({ id, label, minAge, yearlyMan, effect, note, milestones });

const TAGS: Record<string, PartTimeDef["tags"]> = {
  convenience: ["social", "steady"], restaurant: ["social"], tutor_pt: ["logic", "social"], delivery_pt: ["solo", "outdoor"], office_pt: ["steady", "solo"], factory_pt: ["steady", "solo"], event_pt: ["social", "stage"], side_remote: ["solo", "creative"],
};

export const PART_TIMES: PartTimeDef[] = [
  P("convenience", "コンビニの店員", 16, 55, { learn: 0.1, bonds: 0.5, health: -0.4 }, "シフトで働く。夜勤は時給が高い。", [{ years: 1, text: "仕事に慣れ、バイト仲間と親しくなった", delta: { bonds: 3 } }, { years: 3, text: "新人に仕事を教える立場になった", delta: { joy: 3 } }]),
  P("restaurant", "飲食店のホール・キッチン", 16, 55, { bonds: 0.6, health: -0.5 }, "忙しいが、賄いが出ることも。", [{ years: 1, text: "常連のお客さんに、顔を覚えてもらえた", delta: { joy: 4 } }]),
  P("tutor_pt", "塾講師・家庭教師", 18, 80, { learn: 0.5, bonds: 0.3, health: -0.2 }, "教えることで、自分の理解も深まる(大学生以上)。", [{ years: 2, text: "教えた生徒が、志望校に合格した", delta: { joy: 8, bonds: 3 } }]),
  P("delivery_pt", "配達・軽作業", 18, 70, { health: -0.7 }, "時間の自由がきくが、体力を使う。天気に左右される。", [{ years: 1, text: "道に詳しくなり、効率よく回れるようになった", delta: { joy: 2 } }]),
  P("office_pt", "事務・データ入力", 18, 60, { learn: 0.3, health: -0.2 }, "静かな環境で働ける。収入は、控えめ。", [{ years: 2, text: "職場の人に信頼され、仕事を任されるようになった", delta: { joy: 3, money: 2 } }]),
  P("factory_pt", "工場・倉庫の軽作業", 18, 85, { health: -0.9 }, "決まった作業を、集中してこなす。夜勤は高め。", [{ years: 1, text: "ラインのリーダー役を任された", delta: { money: 2 } }]),
  P("event_pt", "イベントスタッフ・販売", 16, 45, { bonds: 0.8, joy: 0.3 }, "単発や短期が多く、人との出会いがある。", [{ years: 1, text: "いろいろな現場で、顔のきく人が増えた", delta: { bonds: 4 } }]),
  P("side_remote", "在宅の副業(ライティング・デザインなど)", 18, 65, { learn: 0.5, health: -0.3 }, "時間と場所を選ばない。収入は、実力しだい。", [{ years: 2, text: "継続して頼まれる取引先ができた", delta: { money: 3, joy: 3 } }]),
];

for (const x of PART_TIMES) x.tags = TAGS[x.id];

export const partTimeById = (id: string) => PART_TIMES.find((x) => x.id === id);

// 出馬(選挙に立候補する)。費用は、供託金(公職選挙法第92条)と、選挙運動の費用の目安の合計(万円)。
// 供託金: 衆議院小選挙区300万円・参議院選挙区300万円・都道府県知事300万円(確認ずみ)。そのほかは、公職選挙法にもとづく目安。
// 選挙運動の費用: 衆議院小選挙区は、令和3年・6年の収支報告(神奈川県・佐賀県・富山県)で、候補者1人あたり約500〜690万円。
// 参議院選挙区は、令和7年の富山県で約970万円(候補者5人)。都道府県議会議員は、令和5年の佐賀県で約220万円。
// 市議会議員・市区町村長・知事は、データを確認できていない設計上の仮定。
// win は、条件が平均的なときの当選のしやすさ(設計上の仮定)。
const O = (id: string, label: string, minAge: number, depositMan: number, campaignMan: number, win: number, payMult: number, term: number, note: string): OfficeDef => ({ id, label, minAge, depositMan, campaignMan, costMan: depositMan + campaignMan, win, payMult, term, note });
export const OFFICES: OfficeDef[] = [
  O("city", "市区町村の議員", 25, 30, 100, 0.4, 0.9, 4, "地域に根ざした活動。報酬は多くないが、地元の信頼が力になる。供託金は市議会議員で約30万円(町村議は不要)。"),
  O("pref", "都道府県の議員", 25, 60, 220, 0.3, 1.25, 4, "県の政策を決める。組織や知名度が求められる。供託金は60万円、運動費は約220万円(令和5年の佐賀県の平均)。"),
  O("mayor", "市区町村長・知事", 30, 300, 1000, 0.18, 1.8, 4, "地域のトップ。供託金は、知事で300万円(市長は約100万円)。当選の壁は高いが、影響力も大きい(知事は30歳以上)。"),
  O("lower", "衆議院議員(国会)", 25, 300, 600, 0.12, 2.6, 4, "国政の場。小選挙区の供託金は300万円、運動費は約500〜690万円(令和3年・6年の収支報告)。有効投票の10%に届かないと、供託金は没収される。"),
  O("upper", "参議院議員(国会)", 30, 300, 900, 0.1, 2.6, 6, "国政の場。選挙区の供託金は300万円、運動費は約970万円(令和7年の富山県)。任期は6年で、30歳以上から。"),
];
export const officeById = (id: string) => OFFICES.find((x) => x.id === id);
