"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { firebaseEnabled, getDb } from "@/lib/firebase";
import { jpData } from "@/lib/sim/data/jp";
import { autoRun, startAlt, startReal, summarize } from "@/lib/sim/engine";
import { createRng, pick } from "@/lib/sim/rng";
import type { BranchKind, CurrentSelf, LifeSummary, Setup } from "@/lib/sim/types";
import type { Echo } from "@/lib/types";

// 公開してよい形(持病・MBTI・自由記述・細かい地名を除いたもの)の人生。
export type PublicLife = Pick<LifeSummary, "deathAge" | "stats" | "assets"> & { echo: Echo; deathCause?: string };

export type ArchiveEntry = {
  id: string;
  createdAt: string | null; // サンプルは null
  sample: boolean;
  branchLabel: string;
  branchAge: number;
  alt: PublicLife;
  real: PublicLife;
  owner?: string;
};

const toPublic = (l: LifeSummary): PublicLife => ({ deathAge: l.deathAge, deathCause: l.deathCause, stats: l.stats, assets: l.assets, echo: l.pub });

export const branchLabelOf = (setup: Setup) => {
  const b = jpData.branches[setup.branch.kind];
  const o = b.options.find((x) => x.id === setup.branch.option);
  return `${b.label}: ${o?.label ?? jpData.jobs.find((j) => j.id === setup.branch.option)?.title ?? ""}`;
};

// 本人が公開を選んだ結果から、アーカイブの1件をつくる。
export function entryFrom(id: string, setup: Setup, alt: LifeSummary, real: LifeSummary, owner: string): ArchiveEntry {
  return { id, createdAt: new Date().toISOString(), sample: false, branchLabel: branchLabelOf(setup), branchAge: setup.branch.age, alt: toPublic(alt), real: toPublic(real), owner };
}

// サンプル: 種から決まる、統計シミュレーションだけでつくった人生(選択は標準の道)。
export function makeSample(n: number): ArchiveEntry {
  const rng = createRng(n * 2654435761);
  const prefecture = pick(rng, jpData.prefectures);
  const occs = Object.keys(jpData.occLabel).filter((k) => k !== "retired" && k !== "student") as Exclude<CurrentSelf["occ"], "none">[];
  const self: CurrentSelf = {
    age: 30 + Math.floor(rng() * 35),
    prefecture: prefecture.name,
    sex: pick(rng, ["female", "male", "none"] as const),
    condition: "none",
    mbti: null,
    edu: pick(rng, ["hs_work", "vocational", "univ", "univ", "grad"] as const),
    occ: pick(rng, occs),
    job: null,
    workStyle: pick(rng, ["private", "private", "private", "public", "self"] as const),
    region: pick(rng, ["tokyo", "metro", "local", "local", "rural"] as const),
    married: rng() < 0.6,
    kids: Math.floor(rng() * 3),
    housing: pick(rng, ["owned", "rent", "rent", "parents"] as const),
    savings: null,
  };
  if (!self.married) self.kids = 0;
  const kind = pick(rng, ["education", "job", "place", "family"] as const) as BranchKind;
  const options = jpData.branches[kind].options.filter((o) => !o.matches(self));
  const option = pick(rng, options);
  const age = Math.min(jpData.branches[kind].defaultAge, self.age - 1);
  const setup: Setup = { self, branch: { kind, option: option.id, age }, seed: n * 7919 + 17 };
  const alt = summarize(autoRun(startAlt(setup)));
  const real = summarize(autoRun(startReal(setup)));
  return { id: `sample-${n}`, createdAt: null, sample: true, branchLabel: branchLabelOf(setup), branchAge: age, alt: toPublic(alt), real: toPublic(real) };
}

export const SAMPLE_COUNT = 18;
export const isSampleId = (id: string) => /^sample-\d+$/.test(id);
export const sampleList = () => Array.from({ length: SAMPLE_COUNT }, (_, i) => makeSample(i + 1));

export const archiveEnabled = firebaseEnabled;

export async function listShared(): Promise<ArchiveEntry[]> {
  if (!firebaseEnabled) return [];
  try {
    const q = query(collection(getDb(), "shared"), orderBy("createdAt", "desc"), limit(30));
    return (await getDocs(q)).docs.map((d) => d.data() as ArchiveEntry);
  } catch {
    return [];
  }
}

export async function getShared(id: string): Promise<ArchiveEntry | null> {
  if (isSampleId(id)) {
    const n = Number(id.slice(7));
    return n >= 1 && n <= SAMPLE_COUNT ? makeSample(n) : null;
  }
  if (!firebaseEnabled) return null;
  try {
    const snap = await getDoc(doc(getDb(), "shared", id));
    return snap.exists() ? (snap.data() as ArchiveEntry) : null;
  } catch {
    return null;
  }
}

export async function publishEntry(entry: ArchiveEntry): Promise<boolean> {
  try {
    await setDoc(doc(getDb(), "shared", entry.id), entry);
    return true;
  } catch {
    return false;
  }
}

export async function unpublishEntry(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(getDb(), "shared", id));
    return true;
  } catch {
    return false;
  }
}
