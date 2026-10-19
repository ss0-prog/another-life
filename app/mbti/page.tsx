import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Section } from "@/components/PageShell";
import { IDEAL, MBTI_NAME, MBTI_TYPES } from "@/lib/sim/mbti";

export const metadata: Metadata = {
  title: "MBTIについて",
  alternates: { canonical: "/mbti" },
  description: "16のタイプの特徴と、このサイトでMBTIがどう使われているか。",
};

// 4つの軸。
const AXES = [
  { a: "E", an: "外向(Extraversion)", b: "I", bn: "内向(Introversion)", q: "エネルギーの向き", ad: "人と会うことや、外での活動で、元気になりやすい。", bd: "ひとりの時間や、静かな場で、元気を取りもどしやすい。" },
  { a: "S", an: "感覚(Sensing)", b: "N", bn: "直観(iNtuition)", q: "物の見方", ad: "目の前の事実や経験を、大切にする。現実的。", bd: "可能性や全体像、意味を考えるのが好き。発想的。" },
  { a: "T", an: "思考(Thinking)", b: "F", bn: "感情(Feeling)", q: "判断のしかた", ad: "筋道や、客観的なルールで、物事を決めやすい。", bd: "人の気持ちや、価値観で、物事を決めやすい。" },
  { a: "J", an: "判断(Judging)", b: "P", bn: "知覚(Perceiving)", q: "暮らし方", ad: "計画を立て、決めたとおりに進めるのが落ち着く。", bd: "状況を見ながら、柔軟に、その場で決めるのが得意。" },
] as const;

// 16タイプの、ひとことの特徴(傾向の説明で、断定ではありません)。
const TYPES: Record<string, { group: string; text: string }> = {
  INTJ: { group: "分析家", text: "先を見通して、計画を立てるのが得意。ひとりで深く考え、高い目標に向かって、ぶれずに進む。" },
  INTP: { group: "分析家", text: "仕組みや理屈を、とことん考えるのが好き。好奇心が強く、自由な発想で、ものごとを解きほぐす。" },
  ENTJ: { group: "分析家", text: "目標を決めて、人を巻きこみながら進める、リーダー気質。決断が早く、効率を大切にする。" },
  ENTP: { group: "分析家", text: "新しい考えを、議論しながら、広げていくのが好き。いろいろなことに興味を持ち、挑戦をおそれない。" },
  INFJ: { group: "外交官", text: "人の気持ちに敏感で、理想を静かに持ちつづける。深い関わりを大切にし、人を支えることに、やりがいを感じる。" },
  INFP: { group: "外交官", text: "自分の価値観や、心の中の世界を、大切にする。やさしく、想像力が豊か。好きなことに、まっすぐ向き合う。" },
  ENFJ: { group: "外交官", text: "人の成長を、助けるのが得意。まわりの気持ちをくみ取り、みんなをまとめて、前に進める。" },
  ENFP: { group: "外交官", text: "明るく、好奇心が旺盛で、人との出会いを楽しむ。新しいアイデアを、人と分かち合って、動き出す。" },
  ISTJ: { group: "番人", text: "責任感が強く、決めたことを、きちんとやりとげる。事実や手順を、大切にする、堅実なタイプ。" },
  ISFJ: { group: "番人", text: "身近な人を、こまやかに気づかい、支える。落ち着いていて、約束や伝統を、大切にする。" },
  ESTJ: { group: "番人", text: "ルールや段取りを重んじ、組織を、まとめるのが得意。現実的で、率先して、決めて動く。" },
  ESFJ: { group: "番人", text: "人とのつながりを大切にし、まわりを、世話するのが好き。みんなが気持ちよく過ごせる場を、つくる。" },
  ISTP: { group: "探検家", text: "冷静で、手を動かしながら、仕組みを理解する。無駄が少なく、いざというときに、頼りになる。" },
  ISFP: { group: "探検家", text: "おだやかで、感性がゆたか。自分のペースで、好きなものを、じっくり味わい、さりげなく、人にやさしい。" },
  ESTP: { group: "探検家", text: "行動力があり、その場の状況に、すばやく対応する。スリルや、新しい体験を楽しみ、現実的に動く。" },
  ESFP: { group: "探検家", text: "明るく、場を楽しませるのが得意。いまこの瞬間を、思いきり楽しみ、人を笑顔にする。" },
};

export default function MbtiPage() {
  return (
    <PageShell title="MBTIについて" lead="MBTIは、性格の傾向を、4つの軸の組み合わせ(16タイプ)で表す、自己理解のための診断です。このサイトでは、ゲームの味つけとして、少しだけ使っています。">
      <Section title="はじめに(大切な注意)">
        <ul className="list-disc space-y-3 pl-6">
          <li>MBTIは、人を決めつけるものでも、人生の成功や相性を、科学的に予測するものでもありません。同じ人でも、時期や状況で、結果が変わることがあります。</li>
          <li>このページの説明は、MBTIの解説書やウェブサイトで、広く紹介されている内容をもとにした、ごく短いまとめです。公式の説明の転記ではありません。</li>
          <li>「相性がよいとされるタイプ」も、広く紹介されている組み合わせで、俗説・目安です。恋愛や人間関係がうまくいくかどうかを、保証するものではありません。</li>
          <li>自分のタイプがわからなければ、答えなくてもかまいません。答えない場合は、ゲームの中での影響は、ありません。</li>
        </ul>
      </Section>

      <Section title="4つの軸">
        <p>MBTIは、次の4つの軸で、「どちら寄りか」を見ます。それぞれの頭文字を並べて、4文字のタイプになります(例: INFP)。</p>
        <div className="grid gap-4 md:grid-cols-2">
          {AXES.map((x) => (
            <div key={x.q} className="rounded-sm border border-line bg-panel/70 p-5">
              <p className="font-gothic text-xs tracking-[0.3em] text-warm">{x.q}</p>
              <p className="font-gothic mt-3 text-sm leading-7 tracking-wider text-mist">
                <strong className="text-warm">{x.a}</strong> {x.an}
                <span className="block text-haze">{x.ad}</span>
              </p>
              <p className="font-gothic mt-3 text-sm leading-7 tracking-wider text-mist">
                <strong className="text-cool">{x.b}</strong> {x.bn}
                <span className="block text-haze">{x.bd}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="16のタイプ">
        <p>呼び名(「仲介者」など)は、日本語の解説で、よく使われているものです。</p>
        <div className="grid gap-4 md:grid-cols-2">
          {MBTI_TYPES.map((t) => (
            <article key={t} id={t} className="rounded-sm border border-line bg-panel/70 p-5">
              <h3 className="flex items-baseline justify-between gap-3">
                <span className="text-lg tracking-[0.2em] text-mist">{MBTI_NAME[t]}</span>
                <span className="font-gothic shrink-0 whitespace-nowrap text-base font-bold tracking-[0.2em] text-warm">{t}</span>
              </h3>
              <p className="font-gothic mt-1 text-[11px] tracking-[0.2em] text-dim">{TYPES[t].group}</p>
              <p className="font-gothic mt-3 text-sm leading-7 tracking-wider text-haze">{TYPES[t].text}</p>
              <p className="font-gothic mt-3 text-xs leading-6 tracking-wider text-dim">
                相性がよいとされるタイプ(俗説・目安):{" "}
                {IDEAL[t].map((x, i) => (
                  <span key={x}>
                    {i > 0 && "・"}
                    <a href={`#${x}`} className="underline-offset-4 hover:text-mist hover:underline">
                      {MBTI_NAME[x]}({x})
                    </a>
                  </span>
                ))}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="このサイトでの使われ方">
        <p>MBTIを答えると、次のような点で、ほんの少しだけ、結果に影響します。大きく左右するものではなく、答えなくても遊べます。</p>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="text-warm">人づきあいの広がりやすさ:</strong>外向(E)の人は、人との出会いが少し広がりやすく、内向(I)の人は、少し控えめになります。
          </li>
          <li>
            <strong className="text-warm">仕事を変えやすさ・家での過ごし方:</strong>判断(J)の人は、仕事を変えにくく、家庭を大切にしやすい傾向に。知覚(P)の人は、その反対になります。
          </li>
          <li>
            <strong className="text-warm">習い事・趣味との相性:</strong>タイプによって、向いている活動(人前に立つ、ひとりで取り組む、創造的、コツコツなど)の効果が、少し大きく、または小さくなります。
          </li>
          <li>
            <strong className="text-warm">恋人との出会い:</strong>「相性がよいとされるタイプ」の人が、恋人として現れやすくなります。出会う確率や、相性のパーセントは、設計上の数字です。
          </li>
        </ul>
        <p>
          数字の仮定について、くわしくは、<Link href="/sources" className="text-warm underline underline-offset-4">データについて・ヒント</Link>のページに書いています。
        </p>
      </Section>
    </PageShell>
  );
}
