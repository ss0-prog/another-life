import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Section } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "コンセプト",
  alternates: { canonical: "/concept" },
  description: "選ばなかった道の先で生きるもうひとりの自分を、最後まで見届けるシミュレーション。",
};

export default function ConceptPage() {
  return (
    <PageShell title="コンセプト" lead="人生のどこかで、あなたは一つの道を選び、もう一つの道を手放しました。">
      <Section title="このサイトでできること">
        <p>「別の宇宙のあなた」は、自分の人生のターニングポイントからやり直しをする体験ができるサイトです。</p>
        <p>占いでも、人生診断でも、未来の予測でもありません。ありえたかもしれない一生を、実際の統計をもとにシミュレートします。</p>
      </Section>

      <Section title="遊び方">
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            今のあなたについての情報を入力します。年齢、生まれた場所、性別、先天性の持病、MBTI(わかれば)、学歴、仕事、住まい、家族、貯金などです。
            <span className="mt-1 block text-sm leading-7 text-dim">※ ここで入力したデータは、このサイトのシミュレーション以外には使いません。</span>
          </li>
          <li>「あのとき別の道を選んでいたら」と思う場面(ターニングポイント)を選び、実際とは違う選択をします。</li>
          <li>そこから人生が再び始まり、時間が一年ずつ流れます。節目では選択肢が現れ、あなた自身が選びます。</li>
          <li>貯金は、シミュレーション上の株価で自由に運用できます。</li>
          <li>最期まで進んだら、「現実のあなた」の一生と見比べます。</li>
        </ol>
      </Section>

      <Section title="大切にしていること">
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="text-warm">評価しない。</strong>どちらの人生が良い、悪いとは言いません。違いを並べるだけです。
          </li>
          <li>
            <strong className="text-warm">景気は同じ、運命は別々。</strong>景気や空模様、株価の動きは、二つの人生で共通です。一方、寿命や事故・急病といった運命のいたずらは、それぞれの人生で別々に決まります。若くして亡くなる人生も、起こりえます。
          </li>
          <li>
            <strong className="text-warm">仮定を隠さない。</strong>どこまでが実際の統計で、どこからが仮定なのかは、<Link href="/sources" className="underline underline-offset-4 hover:text-warm">データについて</Link>のページに書いています。
          </li>
        </ul>
      </Section>

      <Section title="ご注意">
        <p>ここで描かれる人生は、日本の統計的な傾向と設計上の仮定にもとづく、想像の物語です。実在の人生を予測するものではありません。株価は架空のものであり、投資の助言ではありません。</p>
        <p>死や病気も、統計に従って起こります。つらく感じたときは、無理をせず、画面を閉じてください。</p>
      </Section>
    </PageShell>
  );
}
