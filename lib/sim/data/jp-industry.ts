import { JOBS, OCC_LABEL, OCC_OFFICIAL } from "@/lib/sim/data/jp-jobs";
import { applyChangeIncome, incomeOf, round10 } from "@/lib/sim/salary";
import { assignJob } from "@/lib/sim/helpers";
import type { CountryData, JobDef, Occ, Person, TurningOption, TurningQuestion } from "@/lib/sim/types";

// 別の業界へ移る(未経験の業界を含む)ときは、かならず、行き先の業界と職種を、自分で選ぶ(ランダムには、決めない)。
export const INDUSTRIES: Occ[] = ["tech", "office", "sales", "service", "production", "transport", "construction", "logistics", "security", "agri"];

// 業界の給料の水準のちがいが、年収にかなり効く(未経験の分、少し下がる)。
export function moveTarget(p: Person, d: CountryData, econ: number, job: JobDef, factor: number): { now: number; next: number } {
  const now = incomeOf(p, d, econ);
  const cur = p.occ && p.occ !== "retired" ? d.income.base[p.occ] : d.income.base.office;
  const level = Math.max(0.65, Math.min(1.35, Math.pow(d.income.base[job.occ] / cur, 0.6)));
  return { now, next: now * factor * level * (p.occ === job.occ ? 1 : 0.95) };
}

// 選んだ職種に移る。年収は、前の年収に、倍率をかけたもの。
export function switchToJob(p: Person, r: () => number, d: CountryData, job: JobDef, factor: number): string {
  const target = moveTarget(p, d, p.econ, job, factor).next;
  const title = assignJob(p, job.occ, r, d, job.id);
  applyChangeIncome(p, d, p.econ, target);
  return title;
}

const jobOptions = (jobs: JobDef[], factor: number, finish: (p: Person, title: string, job: JobDef) => string): TurningOption[] =>
  jobs.map((j) => ({
    id: j.id,
    label: j.title,
    apply: (p, r, d) => finish(p, switchToJob(p, r, d, j, factor), j),
    detail: (p, env, d) => {
      const { now, next } = moveTarget(p, d, env.econ, j, factor);
      const x = round10(now);
      const y = round10(next);
      return `年収の目安: いま約${x}万円 → 移ったあと 約${y}万円(${y - x >= 0 ? "+" : "-"}${Math.abs(y - x)}万円)。${j.note}`;
    },
  }));

// 業界 → (分野) → 職種。選んだ職種に、そのまま移る。
export function industryQuestion(opts: { factor: number; finish: (p: Person, title: string, job: JobDef) => string; exclude?: (p: Person) => Occ | null }): TurningQuestion {
  return {
    title: "どの業界へ？",
    prompt: "行きたい業界を選んでください。そのあと、職種を選びます(資格が必要な職種は、ここには出ません)。",
    options: INDUSTRIES.map((o) => ({
      id: `occ_${o}`,
      label: OCC_LABEL[o],
      show: (p: Person) => opts.exclude?.(p) !== o,
      apply: () => "",
      detail: () => `${OCC_OFFICIAL[o]}。`,
      children: (): TurningQuestion => {
        const jobs = JOBS.filter((j) => j.occ === o && !j.qual && j.id !== "politician");
        const groups = [...new Set(jobs.map((j) => j.group).filter(Boolean))] as string[];
        if (groups.length > 1) {
          return {
            title: `${OCC_LABEL[o]}の、どの分野？`,
            prompt: "分野を選ぶと、そのなかの職種が出ます。",
            options: groups.map((g) => ({
              id: g,
              label: g,
              apply: () => "",
              children: (): TurningQuestion => ({ title: `${g}の職種`, prompt: "どの職種に移るだろう。", options: jobOptions(jobs.filter((j) => j.group === g), opts.factor, opts.finish) }),
            })),
          };
        }
        return { title: `${OCC_LABEL[o]}の職種`, prompt: "どの職種に移るだろう。", options: jobOptions(jobs, opts.factor, opts.finish) };
      },
    })),
  };
}
