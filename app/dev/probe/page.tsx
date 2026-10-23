"use client";

import { useState } from "react";
import { answer, pending, startReal, tick } from "@/lib/sim/engine";
import { jpData } from "@/lib/sim/data/jp";
import { JOBS } from "@/lib/sim/data/jp-jobs";
import { isResponsible } from "@/lib/sim/helpers";
import { workStylesFor } from "@/lib/sim/data/jp-turning";
import type { CurrentSelf, GameState, Person } from "@/lib/sim/types";

const rnd = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

function makeSelf(r: () => number): CurrentSelf {
  const age = 18 + Math.floor(r() * 40);
  const job = JOBS[Math.floor(r() * JOBS.length)];
  const mode = r();
  const married = r() < 0.4;
  const kids = married ? Math.floor(r() * 3) : 0;
  const edu = (["univ", "hs_work", "vocational", "grad"] as const)[Math.floor(r() * 4)];
  const region = (["tokyo", "metro", "local", "rural"] as const)[Math.floor(r() * 4)];
  const ws = workStylesFor(job.id);
  if (mode < 0.12) return { age: 60 + Math.floor(r() * 20), prefecture: "東京都", sex: "male", condition: "none", mbti: null, edu: "hs_work", occ: "none", job: null, workStyle: "private", region, married, kids, housing: "rent", savings: 500, marital: married ? "married" : "single", retired: true, kidBirthAges: Array.from({ length: kids }, () => 30), kidSexes: Array.from({ length: kids }, () => "boy" as const) } as unknown as CurrentSelf;
  if (mode < 0.22) return { age: 25 + Math.floor(r() * 20), prefecture: "東京都", sex: "female", condition: "none", mbti: null, edu: "hs_work", occ: "none", job: null, workStyle: "private", region, married: false, kids: 0, housing: r() < 0.5 ? "homeless" : "rent", savings: 5, marital: "single" } as unknown as CurrentSelf;
  return { age, prefecture: "東京都", sex: r() < 0.5 ? "male" : "female", condition: "none", mbti: null, edu, occ: job.occ, job: job.id, workStyle: ws[0], region, married, kids, housing: r() < 0.3 ? "owned" : "rent", savings: Math.floor(r() * 800), marital: married ? "married" : "single", kidBirthAges: Array.from({ length: kids }, () => age - 2 - Math.floor(r() * 10)), kidSexes: Array.from({ length: kids }, () => "boy" as const) } as unknown as CurrentSelf;
}

type Flags = { id: string; title: string; age: number; job: string; why: string };
const working = (p: Person) => p.occ !== null && p.occ !== "retired";

// 矛盾の判定ルール: 当てはまると、その場面は、いまの状態と合っていない。
function check(id: string, p: Person, opts: string[]): string[] {
  const bad: string[] = [];
  const resp = isResponsible(p);
  const work = ["career25", "career40", "later60", "ev:job_change", "ev:early_retire", "ev:relocation", "ev:overseas_post", "ev:burnout_leave", "ev:work_end", "ev:political_call"];
  if (work.includes(id) && resp) bad.push("責任ある立場なのに、働き方の選択");
  if (["career25", "career40", "ev:job_change", "ev:early_retire", "ev:relocation", "ev:overseas_post", "ev:burnout_leave"].includes(id) && !working(p)) bad.push("働いていないのに、仕事の選択");
  if (["ev:marry", "ev:romance", "ev:asked_out", "ev:cohabit", "partner28"].includes(id) && p.married) bad.push("結婚しているのに、結婚前の選択");
  if (id === "ev:affair" && !p.married) bad.push("結婚していないのに、不倫の選択");
  if (id === "ev:have_child" && !p.partner && !p.married) bad.push("相手がいないのに、子どもの選択");
  if (id === "kids31" && (p.kids > 0 || !p.married)) bad.push("子どもの選択が状態と合わない");
  if (id === "home35" && (p.owned || p.abroad)) bad.push("持ち家か海外なのに、住まいの選択");
  if (id === "ev:return_or_stay" && !p.abroad) bad.push("海外にいないのに、帰国の選択");
  if (id === "ev:overseas_post" && p.abroad) bad.push("海外にいるのに、海外赴任の選択");
  if (id === "ev:move_ask" && (resp || p.withParents)) bad.push("責任ある立場か実家なのに、引っ越しの選択");
  if (id === "ev:hobby_offer" && p.lessons.length >= 5) bad.push("5つやっているのに、趣味の選択");
  if (id === "ev:pet" && p.pets.filter((x) => !x.died).length >= 2) bad.push("ペットが多いのに、ペットの選択");
  if (id === "ev:nisa_offer" && !working(p)) bad.push("働いていないのに、NISAの選択");
  if (id === "pension65" && p.age < 65) bad.push("年齢が合わない");
  if (id === "later60" && p.occ === "retired") bad.push("退職しているのに、何歳まで働くか");
  if (id === "ev:retire_life" && p.occ !== "retired") bad.push("退職していないのに、退職後の暮らし");
  // 選択肢の言葉と、状態のずれ
  const txt = opts.join("|");
  if ((p.job === "ceo" || p.job === "founder" || p.job === "owner" || p.job === "politician" || p.office) && /管理職|昇進|転職|副業/.test(txt)) bad.push("経営者・議員なのに、昇進・転職・副業の言葉");
  if (p.employment === "self" && /転職|会社を辞め/.test(txt) && !/独立/.test(id)) bad.push("自営なのに、転職の言葉");
  if (p.married && /結婚する|結婚を意識/.test(txt)) bad.push("結婚しているのに、結婚の言葉");
  if (p.owned && /家を買う|住宅を買う/.test(txt)) bad.push("持ち家なのに、家を買う言葉");
  if (p.kids === 0 && /子どもが.*(育|入学|卒業)/.test(txt)) bad.push("子どもがいないのに、子どもの言葉");
  if (!working(p) && /昇進|管理職/.test(txt)) bad.push("働いていないのに、昇進の言葉");
  if (p.employment !== "regular" && /昇進|管理職|責任ある立場/.test(txt)) bad.push("正社員でないのに、昇進・管理職の言葉");
  if (p.employment === "self" && /休職|定年|再雇用|会社に残る|会社を離れる|転勤|辞令/.test(txt)) bad.push("自営なのに、会社員の言葉");
  if (p.employment === "nonregular" && /定年/.test(txt)) bad.push("非正規なのに、定年の言葉");
  if (p.sector === "public" && /株式|上場/.test(txt)) bad.push("公務員なのに、会社の言葉");
  if (p.pets.length === 0 && /ペット(を|が).*(亡|看取)/.test(txt)) bad.push("ペットがいないのに、ペットの言葉");
  if ((p.partner === null || p.partner?.status === "ex") && /パートナー(が|と|に)/.test(txt) && !["ev:remarry", "ev:pregnancy", "ev:parental_leave", "ev:have_child", "ev:crime_temptation"].includes(id)) bad.push("相手がいないのに、パートナーの言葉");
  return bad;
}

type Stat = { n: number; ageMin: number; ageMax: number; married: number; kids: number; working: number; retired: number; self: number; resp: number; abroad: number; owned: number; parents: number; dating: number; title: string; prompt: string };
const stats: Record<string, Stat> = {};
// 年表に出た一文と、そのときの状態のずれ。
function checkEvent(text: string, p: Person): string[] {
  const bad: string[] = [];
  const resp = isResponsible(p);
  const boss = working(p) && p.employment !== "self" && !resp && !["shogi", "idol", "streamer", "athlete"].includes(p.job ?? "");
  if (/上司|同僚|職場の|配属|異動/.test(text) && !boss && !/(出所|刑期|亡く|退職|定年|家族|友人)/.test(text)) bad.push("上司・同僚・異動の言葉なのに、勤め人ではない");
  if (/昇進|昇格|降格/.test(text) && (p.employment !== "regular" || resp)) bad.push("昇進・降格の言葉なのに、正社員ではない");
  if (/転職|会社を辞め/.test(text) && (resp || p.employment === "self")) bad.push("転職の言葉なのに、自営か責任ある立場");
  if (/育休|産休|育児休業/.test(text) && p.employment === "self") bad.push("育休の言葉なのに、自営");
  if (/わが子|子どもの(入学|卒業|進学)/.test(text) && p.kids === 0) bad.push("子どもがいないのに、子どもの言葉");
  if (/夫|妻|配偶者/.test(text) && !p.married && !/(離婚|死別|亡く|先立)/.test(text) && p.partner?.status !== "ex") bad.push("結婚していないのに、配偶者の言葉");
  if (/定年/.test(text) && (p.employment === "self" || resp)) bad.push("定年の言葉なのに、自営か責任ある立場");
  if (/会社(が|を|に|で|の)/.test(text) && p.employment === "self" && p.occ !== "retired" && !/(創業|起こ|設立|経営|開業|独立|自分の会社|保険|会社員|配偶者|パートナー|親|父|母|辞めて|退職|友人|転職)/.test(text)) bad.push("会社の言葉なのに、自営");
  if (/部下/.test(text) && p.occ !== "mgmt" && !resp && p.job !== "manager") bad.push("部下の言葉なのに、管理職ではない");
  if (/(出社|通勤|満員電車)/.test(text) && (p.employment === "self" || resp)) bad.push("通勤の言葉なのに、自営か責任ある立場");
  if (/ボーナス|賞与/.test(text) && (p.employment !== "regular")) bad.push("ボーナスの言葉なのに、正社員ではない");
  return bad;
}

function run(seed: number, viol: Record<string, { n: number; ex: string }>, seen: Record<string, number>) {
  const r = rnd(seed);
  const self = makeSelf(r);
  let s: GameState = startReal({ self, branch: { kind: "work", option: "x", age: self.age }, seed: seed } as never);
  let guard = 0;
  let seenEv = s.events.length;
  while (s.deathAge === null && guard++ < 3000) {
    for (; seenEv < s.events.length; seenEv++) {
      for (const b of checkEvent(s.events[seenEv].event, s.person)) {
        const k = `EVENT :: ${b}`;
        const v = (viol[k] ??= { n: 0, ex: "" });
        v.n++;
        if (v.n <= 3) v.ex += `[${s.person.age}歳・${s.person.job}・${s.person.employment}] ${s.events[seenEv].event.slice(0, 50)}\n`;
      }
    }
    const tp = pending(s, jpData, 11);
    if (tp) {
      const opts = tp.options.filter((o) => !o.show || o.show(s.person));
      seen[tp.id] = (seen[tp.id] ?? 0) + 1;
      {
        const p = s.person;
        const st = (stats[tp.id] ??= { n: 0, ageMin: 999, ageMax: 0, married: 0, kids: 0, working: 0, retired: 0, self: 0, resp: 0, abroad: 0, owned: 0, parents: 0, dating: 0, title: tp.title, prompt: tp.prompt.slice(0, 60) });
        st.n++; st.ageMin = Math.min(st.ageMin, p.age); st.ageMax = Math.max(st.ageMax, p.age);
        if (p.married) st.married++; if (p.kids > 0) st.kids++; if (working(p)) st.working++; if (p.occ === "retired") st.retired++; if (p.employment === "self") st.self++; if (isResponsible(p)) st.resp++; if (p.abroad) st.abroad++; if (p.owned) st.owned++; if (p.withParents) st.parents++; if (p.partner?.status === "dating") st.dating++;
      }
      for (const b of check(tp.id, s.person, opts.map((o) => o.label))) {
        const k = `${tp.id} :: ${b}`;
        const v = (viol[k] ??= { n: 0, ex: "" });
        v.n++;
        if (!v.ex) v.ex = `${s.person.age}歳・${s.person.job}・${s.person.employment}/${s.person.sector}`;
      }
      const pick = opts.find((o) => o.auto) ?? opts[0];
      s = answer(s, tp, { kind: "option", path: [pick.id] });
    } else s = tick(s);
  }
}

export default function Probe() {
  const [out, setOut] = useState("");
  return (
    <main className="p-6">
      <button className="border px-4 py-2" onClick={() => {
        const viol: Record<string, { n: number; ex: string }> = {};
        const seen: Record<string, number> = {};
        let errs = "";
        for (let i = 1; i <= 500; i++) {
          try { run(i * 104729, viol, seen); } catch (e) { errs += String(e).slice(0, 80) + ";"; }
        }
        setOut(JSON.stringify({ errs, viol, stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, `${v.title}|n${v.n}|age${v.ageMin}-${v.ageMax}|m${Math.round(v.married / v.n * 100)} k${Math.round(v.kids / v.n * 100)} w${Math.round(v.working / v.n * 100)} r${Math.round(v.retired / v.n * 100)} s${Math.round(v.self / v.n * 100)} R${Math.round(v.resp / v.n * 100)} ab${Math.round(v.abroad / v.n * 100)} o${Math.round(v.owned / v.n * 100)} wp${Math.round(v.parents / v.n * 100)} d${Math.round(v.dating / v.n * 100)}`])) }));
      }}>run</button>
      <pre id="out">{out}</pre>
    </main>
  );
}
