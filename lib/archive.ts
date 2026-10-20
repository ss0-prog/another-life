"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { firebaseEnabled, getDb } from "@/lib/firebase";
import { jpData } from "@/lib/sim/data/jp";
import { autoRun, startAlt, startReal, summarize } from "@/lib/sim/engine";
import { createRng, pick } from "@/lib/sim/rng";
import type { BranchKind, CurrentSelf, LifeSummary, Setup } from "@/lib/sim/types";
import type { Echo } from "@/lib/types";

// 公開してよい形(持病・MBTI・性自認・惹かれる相手・自由記述・細かい地名を除いたもの)の人生。
export type PublicLife = Pick<LifeSummary, "deathAge" | "stats" | "assets"> & { echo: Echo; deathCause?: string };

export type ArchiveEntry = {
  id: string;
  createdAt: string | null;
  // 昔のサンプル(いまは使わない)との互換のため、残してある。いつも false。
  sample: boolean;
  branchLabel: string;
  branchAge: number;
  alt: PublicLife;
  real: PublicLife;
  owner?: string;
  // 公開した本人が、その人生にそえたひとこと。
  comment?: string;
};

const toPublic = (l: LifeSummary): PublicLife => ({ deathAge: l.deathAge, deathCause: l.deathCause, stats: l.stats, assets: l.assets, echo: l.pub });

export const branchLabelOf = (setup: Setup) => {
  const b = jpData.branches[setup.branch.kind];
  const o = b.options.find((x) => x.id === setup.branch.option);
  return `${b.label}: ${o?.label ?? jpData.jobs.find((j) => j.id === setup.branch.option)?.title ?? ""}`;
};

// 本人が公開を選んだ結果から、アーカイブの1件をつくる。
export function entryFrom(id: string, setup: Setup, alt: LifeSummary, real: LifeSummary, owner: string, comment = ""): ArchiveEntry {
  const note = comment.trim().slice(0, COMMENT_MAX);
  return { id, createdAt: new Date().toISOString(), sample: false, branchLabel: branchLabelOf(setup), branchAge: setup.branch.age, alt: toPublic(alt), real: toPublic(real), owner, ...(note ? { comment: note } : {}) };
}

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
  } catch (e) {
    console.error("publish failed", e);
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

export const COMMENT_MAX = 500;
