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
      <Section title="無数の「if」の先へ">
        <p><span className="fancy-underline">ここは、無数の「if」の数だけ存在する、別の宇宙のあなたと出会う場所。</span></p>
        <p>量子力学の「多世界解釈」では、<br />私たちが人生で決断を下すたび、宇宙は枝分かれしていくと考えられています。</p>
        <p>今日とった選択。あの日、あの時の決断……。<br />あなたが選ばなかった無数の選択肢の先には、<br />今も「もう一人のあなた」が生きる平行宇宙(マルチバース)が広がっているのかもしれません。</p>
        <p>さあ、別の宇宙のあなたに会いに行ってみましょう。</p>
      </Section>

      <Section title="このサイトでできること">
        <p>「別の宇宙のあなた」は、自分の人生のターニングポイントからやり直しをする体験ができるサイトです。</p>
        <p>占いでも、人生診断でも、未来の予測でもありません。ありえたかもしれない一生を、実際の統計をもとにシミュレートします。</p>
      </Section>

      <Section title="遊び方">
        <ol className="list-decimal space-y-4 pl-6">
          <li>
            まず、今のあなたについて入力します。入力の詳しさは、「簡単に」(約11問)・「普通」(約19問)・「詳しく」(約28問)から選べます。年齢、生まれた場所、性別、先天性の持病、MBTI(わかれば)、学歴、仕事、住まい、家族、貯金などを答えます。答えたくない項目は、飛ばせます。
            <span className="mt-1 block text-sm leading-7 text-dim">※ ここで入力したデータは、このサイトのシミュレーション以外には使いません。</span>
          </li>
          <li>
            「あのとき別の道を選んでいたら」と思う場面(ターニングポイント)を選びます。進路・仕事・結婚・住む場所などから、場面を選び、そのときの思いと、実際とは違う道を決めます。
          </li>
          <li>
            そこから、別の人生が始まります。時間は一年ずつ流れ、1年ごとの出来事が記録されます。節目では選択肢が現れ、あなた自身が選びます。選ぶたびに、お金・健康・つながり・学びなどが変わります。
          </li>
          <li>
            途中で、貯金を、架空の株価で運用したり、習い事・趣味・アルバイトを始めたり、出かけて人と出会ったりできます。画面の「活動」と「資産」から選べます。
          </li>
          <li>
            最期まで進んだら、「現実のあなた」の一生と、並べて見比べます。収入・資産・寿命・結婚と子どもを、世の中の統計と比べることもできます。
          </li>
          <li>
            途中で解除した実績は、「コレクション」に集まります。気に入った人生は、SNSで共有できます。
          </li>
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
