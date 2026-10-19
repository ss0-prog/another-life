import type { Rng } from "@/lib/sim/rng";
import type { Person } from "@/lib/sim/types";

// 「ひとこま」: 数字にならない、心に残る場面。
// 恋人・家族・子ども・友人・ペットなど、まわりの人との、短い情景を、ときどき、年表にはさむ。
// 長くせず、1〜2文で、音・におい・手ざわりのような、小さな手がかりだけを書く。AI は使わない(ひな形と、状況の条件で選ぶ)。
// 同じ場面は、15年(ありふれたものは20〜30年)はくり返さない。毎年は出さず、平均して、4年に1度ほど。

export type Moment = { id: string; text: string; joy?: number; bonds?: number };
type Def = { id: string; w?: number; cd?: number; ok: (p: Person) => boolean; text: (p: Person, r: Rng) => string; joy?: number; bonds?: number };

const alive = (p: Person, who: "mother" | "father") => p.age < p.parentDeath[who];
const passed = (p: Person, who: "mother" | "father") => p.age - p.parentDeath[who];
const partnerName = (p: Person) => `${p.partner?.given ?? ""}さん`;
const inLove = (p: Person) => !!p.partner && (p.partner.status === "dating" || p.partner.status === "married");
const kidName = (p: Person, i: number) => p.kidList[i]?.name || "子ども";
const kidAge = (p: Person, i: number) => p.age - p.kidList[i].bornAge;
// いまの年齢の子どものうち、条件に合う子の番号(いちばん最初の人)。
const kidIn = (p: Person, lo: number, hi: number) => p.kidList.findIndex((k) => !k.anon && p.age - k.bornAge >= lo && p.age - k.bornAge <= hi);
const parentWord = (p: Person, r: Rng, rr: "mother" | "father" | "any") => (rr === "any" ? (alive(p, "mother") && (!alive(p, "father") || r() < 0.5) ? "母" : "父") : rr === "mother" ? "母" : "父");
const working = (p: Person) => p.occ !== null && p.occ !== "retired";

const MOMENTS: Def[] = [
  // ───── 子ども時代(親・友だち) ─────
  { id: "c_blanket", ok: (p) => p.age >= 5 && p.age <= 12 && (alive(p, "mother") || alive(p, "father")), text: (p, r) => `眠ったふりをしていると${parentWord(p, r, "any")}が来て布団をかけ直してくれた。あたたかい手が、すこし長く肩にのっていた`, joy: 1, bonds: 1 },
  { id: "c_fireworks", ok: (p) => p.age >= 5 && p.age <= 14, text: () => "夏の夜に家族で見た花火。音が胸にどんと響いて隣の手を思わずにぎった", joy: 2, bonds: 1 },
  { id: "c_walkhome", ok: (p) => p.age >= 8 && p.age <= 18, text: () => "放課後の帰り道。友だちとくだらない話で笑っているうちに空が暗くなっていた", joy: 2, bonds: 1 },
  { id: "c_cry_father", ok: (p) => p.age >= 6 && p.age <= 13 && alive(p, "father"), text: () => "泣いて帰った日。父は何も聞かず黙って頭をなでてくれた。大きな手だった", joy: 1, bonds: 1 },
  { id: "c_lunchbox", ok: (p) => p.age >= 6 && p.age <= 17 && alive(p, "mother"), text: () => "弁当のふたを開けると好きなおかずが多めに入っていた。何も言わない母のやさしさだった", joy: 1, bonds: 1 },
  { id: "c_teen_door", ok: (p) => p.age >= 13 && p.age <= 17, text: () => "親の声がうるさくて部屋の戸を閉めた。あとで台所から聞こえる皿の音が胸にささった", joy: -1, bonds: 1 },
  { id: "c_friend_last", ok: (p) => p.age >= 15 && p.age <= 19, text: () => "卒業式のあと教室に最後まで残った。誰もが同じことを考えていて誰も口にしなかった", joy: 1, bonds: 1 },

  // ───── 恋 ─────
  { id: "l_crush", ok: (p) => p.partner?.status === "crush" && p.age < 45, text: (p) => `${partnerName(p)}と目が合った。それだけで一日じゅう落ち着かなかった`, joy: 2 },
  { id: "l_walk", ok: (p) => p.partner?.status === "dating", text: (p) => `${partnerName(p)}と並んで歩いた帰り道。何も話さなくても気まずくなかった`, joy: 2, bonds: 2 },
  { id: "l_remember", ok: (p) => inLove(p), text: (p) => `${partnerName(p)}が前に話したことを覚えていてくれた。小さなことなのに胸があたたかくなった`, joy: 2, bonds: 2 },
  { id: "l_phone", ok: (p) => p.partner?.status === "dating" && p.age < 35, text: (p) => `${partnerName(p)}からの通知が鳴った。画面を見る前から口元がゆるんでいた`, joy: 2 },
  { id: "l_dishes", ok: (p) => p.partner?.status === "married", text: (p) => `夕飯のあと${partnerName(p)}と並んで食器を洗った。何でもない時間がいちばん大切に思えた`, joy: 2, bonds: 2 },
  { id: "l_sleep", ok: (p) => p.partner?.status === "married" && p.age - p.partner.since >= 5, text: (p) => `${partnerName(p)}の寝顔を見ながら一緒に歩いてきた年月を思った`, joy: 1, bonds: 2 },
  { id: "l_note", ok: (p) => inLove(p) && working(p) && p.extra.stress > 55, text: (p) => `遅く帰ると${partnerName(p)}が夕飯をとっておいてくれた。ラップの上に小さなメモが貼ってあった`, joy: 2, bonds: 2 },
  { id: "l_quarrel", ok: (p) => inLove(p) && p.age - (p.history.conflict ?? -99) <= 2, text: (p) => `言いすぎた夜。${partnerName(p)}は背を向けたまま眠った。朝に先に「おはよう」と言ったのは${partnerName(p)}だった`, joy: 0, bonds: 2 },
  { id: "l_depressed", ok: (p) => inLove(p) && p.mood === "depressed", text: (p) => `朝の布団から出られなかった。${partnerName(p)}は何も言わずあたたかいお茶を枕もとに置いていった`, joy: 1, bonds: 2 },
  { id: "l_old_couple", ok: (p) => p.partner?.status === "married" && p.age >= 60, text: (p) => `縁側で${partnerName(p)}と並んでお茶を飲んだ。話すことがなくなっても沈黙が心地よかった`, joy: 2, bonds: 2 },
  { id: "l_ex", ok: (p) => p.partner?.status === "ex" && p.age - p.partner.since <= 12, text: (p) => `ふと${partnerName(p)}と歩いた道に出た。もう連絡は取っていない。それでも元気でいてほしいと思った`, joy: 0, bonds: 0 },

  // ───── 子ども ─────
  { id: "k_finger", ok: (p) => kidIn(p, 0, 1) >= 0, text: (p) => `${kidName(p, kidIn(p, 0, 1))}が初めてあなたの指をぎゅっと握った。小さな手が思ったよりずっとあたたかかった`, joy: 3, bonds: 2 },
  { id: "k_night", ok: (p) => kidIn(p, 0, 2) >= 0, text: (p) => `夜泣きの${kidName(p, kidIn(p, 0, 2))}を抱いて窓の外が白むのを見た。眠いのに不思議と幸せだった`, joy: 2, bonds: 1 },
  { id: "k_draw", ok: (p) => kidIn(p, 3, 6) >= 0, text: (p) => `${kidName(p, kidIn(p, 3, 6))}が描いた似顔絵は髪の毛が空まで伸びていた。冷蔵庫のいちばんいい場所に貼った`, joy: 2, bonds: 2 },
  { id: "k_sportsday", ok: (p) => kidIn(p, 5, 11) >= 0, text: (p) => `運動会で走る${kidName(p, kidIn(p, 5, 11))}を見て気づけば声をあげていた。転んでも立ち上がった`, joy: 3, bonds: 2 },
  { id: "k_hand", ok: (p) => kidIn(p, 3, 8) >= 0, text: (p) => `帰り道に${kidName(p, kidIn(p, 3, 8))}が黙って手をつないできた。この手を離す日が来るのだと思った`, joy: 2, bonds: 2 },
  { id: "k_sick", ok: (p) => kidIn(p, 1, 9) >= 0, text: (p) => `熱を出した${kidName(p, kidIn(p, 1, 9))}の額に手をあてて朝まで起きていた。寝息が落ち着いたとき肩の力が抜けた`, joy: 0, bonds: 2 },
  { id: "k_thanks", ok: (p) => kidIn(p, 13, 17) >= 0, text: (p) => `${kidName(p, kidIn(p, 13, 17))}が不意に「ありがとう」と言った。理由は聞かなかった`, joy: 3, bonds: 2 },
  { id: "k_door", ok: (p) => kidIn(p, 12, 16) >= 0, text: (p) => `${kidName(p, kidIn(p, 12, 16))}が部屋の戸を閉めるようになった。寂しいけれど大人になっているのだと思う`, joy: 0, bonds: 1 },
  { id: "k_leave", ok: (p) => kidIn(p, 18, 20) >= 0, text: (p) => `${kidName(p, kidIn(p, 18, 20))}が家を出る朝。見送ったあと部屋が急に広くなった気がした`, joy: -1, bonds: 2 },
  { id: "k_call", ok: (p) => kidIn(p, 21, 60) >= 0, text: (p) => `${kidName(p, kidIn(p, 21, 60))}から短い近況の連絡が届いた。それだけで一日が明るくなった`, joy: 2, bonds: 2 },
  { id: "k_grandchild", ok: (p) => p.age >= 55 && kidIn(p, 28, 60) >= 0 && p.kids >= 1, w: 0.6, text: (p) => `${kidName(p, kidIn(p, 28, 60))}が久しぶりに顔を出した。玄関の靴の数がふえて家の中が少しにぎやかになった`, joy: 2, bonds: 2 },

  // ───── 親 ─────
  { id: "p_home", ok: (p) => p.age >= 20 && p.age <= 55 && (alive(p, "mother") || alive(p, "father")) && !p.withParents, text: (p) => `${parentWord(p, () => 0.2, "any")}のいる実家に帰った。食卓には黙って好物が並んでいた`, joy: 2, bonds: 2 },
  { id: "p_smaller", ok: (p) => p.age >= 35 && p.age <= 70 && alive(p, "father"), text: () => "久しぶりに会った父の背中が小さくなっていた。気づいてしまったことを言わなかった", joy: -1, bonds: 2 },
  { id: "p_voice", ok: (p) => p.age >= 30 && alive(p, "mother") && p.age >= p.parentDeath.mother - 4, text: () => "電話の母の声が前より小さい。何でもないよと言う声に何でもなくないことを思った", joy: -1, bonds: 2 },
  { id: "p_hospital", ok: (p) => p.age >= 28 && ((alive(p, "mother") && p.age >= p.parentDeath.mother - 1) || (alive(p, "father") && p.age >= p.parentDeath.father - 1)), w: 1.4, text: (p) => `病室で${alive(p, "mother") && p.age >= p.parentDeath.mother - 1 ? "母" : "父"}の手を握った。冷たいのに強く握り返してくれた`, joy: -2, bonds: 2 },
  { id: "p_mother_gone", ok: (p) => passed(p, "mother") >= 1 && passed(p, "mother") <= 5, text: () => "台所に立つと出汁の匂いがした。もう同じ味は食べられない", joy: -1, bonds: 1 },
  { id: "p_father_gone", ok: (p) => passed(p, "father") >= 1 && passed(p, "father") <= 5, text: () => "古い手帳に小さい頃の写真が挟まっていた。しばらくそのまま動けなかった", joy: -1, bonds: 1 },
  { id: "p_mirror", ok: (p) => p.age >= 38 && (!alive(p, "mother") || !alive(p, "father")), w: 0.7, text: () => "鏡の中の自分が亡くなった親に似てきた。笑うとなおさらそっくりだった", joy: 0, bonds: 1 },

  // ───── 友人・職場 ─────
  { id: "f_call", w: 0.8, cd: 20, ok: (p) => p.age >= 20, text: () => "親友から前触れもなく電話があった。声を聞いただけで肩の力が少し抜けた", joy: 2, bonds: 2 },
  { id: "f_old", w: 0.8, cd: 20, ok: (p) => p.age >= 35, text: () => "久しぶりに会った親友は少し老けていた。お互いにそう思って笑った", joy: 2, bonds: 2 },
  { id: "f_night", w: 0.8, cd: 20, ok: (p) => p.age >= 18 && p.age <= 35, text: () => "友人の部屋で朝まで話した。何を話したのかは覚えていない。笑ったことだけ覚えている", joy: 2, bonds: 2 },
  { id: "w_praise", w: 0.8, cd: 20, ok: (p) => working(p) && p.employment !== "self" && p.age >= 22, text: () => "上司がさりげなく「助かったよ」と言った。たったそれだけで報われた気がした", joy: 2, bonds: 1 },
  { id: "w_late", w: 0.8, cd: 20, ok: (p) => working(p) && p.employment !== "self" && p.extra.stress > 60, text: () => "終電の窓に疲れた顔が映っていた。同じ顔の人たちがとなりに並んで揺れていた", joy: -1, bonds: 0 },
  { id: "w_first_pay", w: 0.8, cd: 20, ok: (p) => working(p) && p.age >= 18 && p.age <= 24 && p.age - (p.history.firstJob ?? p.age) <= 1, text: () => "初めての給料で家族に何か買った。渡すときの手が少しふるえた", joy: 2, bonds: 2 },

  // ───── ペット ─────
  { id: "pet_lap", ok: (p) => p.pets.some((x) => !x.died), text: (p) => `${p.pets.find((x) => !x.died)!.name}が足もとで丸くなった。そのぬくもりが今日の疲れをほどいてくれた`, joy: 2, bonds: 1 },
  { id: "pet_gone", ok: (p) => p.pets.some((x) => x.died), w: 0.8, text: (p) => `${p.pets.find((x) => x.died)!.name}の首輪を引き出しの奥で見つけた。しばらく手に持ったままだった`, joy: -1, bonds: 1 },

  // ───── ひとりの時間・暮らし ─────
  { id: "s_rain", w: 0.5, cd: 30, ok: (p) => p.age >= 15, text: () => "雨の夜。傘の下で昔のことをぼんやり思い出していた", joy: 0 },
  { id: "s_sunset", w: 0.5, cd: 30, ok: (p) => p.age >= 15, text: () => "ふと見上げた夕焼けがあまりにきれいで立ち止まった。誰かに見せたいと思った", joy: 1 },
  { id: "s_vending", w: 0.5, cd: 30, ok: (p) => p.age >= 20 && working(p), text: () => "帰り道の自動販売機の灯りがやけにやさしく見えた夜。あたたかい缶を両手で包んだ", joy: 1 },
  { id: "s_morning", w: 0.5, cd: 30, ok: (p) => p.age >= 20 && p.stats.joy >= 60, text: () => "何でもない朝にふと「いま幸せだ」と思った。理由は特になかった", joy: 2 },
  { id: "s_alone", w: 0.5, cd: 30, ok: (p) => p.age >= 18 && p.stats.bonds < 40, text: () => "誰とも話さなかった日の夜。静けさが少し重かった", joy: -1, bonds: 0 },
  { id: "s_station", w: 0.5, cd: 30, ok: (p) => p.age >= 18 && p.age <= 40 && p.region !== p.birthRegion, text: () => "ふるさとの駅の音を思い出した。改札を出ると聞こえた風の匂いごと", joy: 0, bonds: 0 },
  { id: "s_abroad", w: 0.5, cd: 30, ok: (p) => !!p.abroad, text: () => "異国の夜にふるさとの味が無性に恋しくなった。台所に立って似たものを作ってみた", joy: 0 },
  { id: "s_photo", w: 0.5, cd: 30, ok: (p) => p.age >= 40, text: () => "古い写真を整理していた。写っている人の何人かにもう会えないことを思った", joy: 0, bonds: 1 },
  { id: "s_season", w: 0.5, cd: 30, ok: (p) => p.age >= 60, text: () => "縁側にすわって季節が変わる音を聞いた。時間がゆっくり流れていた", joy: 1 },
  { id: "s_thank", w: 0.5, cd: 30, ok: (p) => p.age >= 65, text: () => "ふと、これまで出会った人たちの顔が浮かんだ。ひとりずつに「ありがとう」と言いたくなった", joy: 2, bonds: 1 },
];

// この年の「ひとこま」を、1つ選ぶ(なければ null)。毎年は出さない。
export function pickMoment(p: Person, age: number, rng: Rng): Moment | null {
  if (age < 5) return null;
  // 前の年に出ていたら、まず出さない(ほかの出来事を、うめてしまわないように)。
  const lastAt = Math.max(-99, ...Object.entries(p.history).filter(([k]) => k.startsWith("m:")).map(([, v]) => v));
  if (age - lastAt <= 1) return null;
  if (rng() > 0.32) return null;
  const cands = MOMENTS.filter((m) => {
    const used = p.history[`m:${m.id}`];
    if (used !== undefined && age - used < (m.cd ?? 15)) return false;
    try {
      return m.ok(p);
    } catch {
      return false;
    }
  });
  if (!cands.length) return null;
  const total = cands.reduce((s, m) => s + (m.w ?? 1), 0);
  let r = rng() * total;
  let chosen = cands[cands.length - 1];
  for (const m of cands) {
    r -= m.w ?? 1;
    if (r < 0) {
      chosen = m;
      break;
    }
  }
  return { id: chosen.id, text: chosen.text(p, rng), joy: chosen.joy, bonds: chosen.bonds };
}
