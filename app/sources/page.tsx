import type { Metadata } from "next";
import { PageShell, Section } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "データについて",
  alternates: { canonical: "/sources" },
  description: "このサイトが参考にしている公的統計の出典。",
};

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-warm">
      {children}
    </a>
  );
}

export default function SourcesPage() {
  return (
    <PageShell title="データについて" lead="このサイトが参考にしている、公的統計の出典です。">
      <Section title="出典">
        <ul className="list-disc space-y-4 pl-6">
          <li>
            <A href="https://www.mhlw.go.jp/toukei/saikin/hw/life/life23/index.html">厚生労働省「令和5年簡易生命表」</A>
            : 寿命(平均余命に合う死亡率)と、結果画面の寿命の図。
          </li>
          <li>
            <A href="https://www.mhlw.go.jp/content/10700000/000513179.pdf">厚生労働省「賃金構造基本統計調査の新職種区分案 職種一覧」</A>
            : 職業の分類。
          </li>
          <li>
            <A href="https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2024/index.html">厚生労働省「令和6年賃金構造基本統計調査」</A>
            : 給料の水準と、都道府県・職種による差。
          </li>
          <li>
            <A href="https://www.mhlw.go.jp/toukei/itiran/roudou/koyou/doukou/index.html">厚生労働省「令和6年 雇用動向調査」</A>
            : 転職したときの賃金の変化の割合。
          </li>
          <li>内閣府「長期経済統計」: 景気(実質GDP)・物価・失業率。統計のある年だけ使っています。</li>
          <li>厚生労働省「人口動態統計」: 結婚と子どもの図、死因の割合。</li>
          <li>国税庁「民間給与実態統計調査」: 年収の図。</li>
          <li>総務省統計局「家計調査(貯蓄・負債編)」: 貯蓄・資産の図。</li>
          <li>国立社会保障・人口問題研究所「出生動向基本調査」: 結婚までの交際期間。</li>
          <li>厚生労働省「雇用均等基本調査」: 育児休業の取得割合。</li>
          <li>気象庁・内閣府・日本銀行などの公表資料: 年表に入る、実際に起きた出来事。</li>
          <li>宝くじ公式サイト「年末ジャンボ宝くじ(第984回)」: 宝くじの当せん金。</li>
          <li>公職選挙法: 出馬の供託金。</li>
          <li>
            国税庁・日本年金機構・厚生労働省の公式ページ: 税と社会保険料の制度(
            <A href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm">所得税</A>・
            <A href="https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/index.html">厚生年金</A>・
            <A href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000158500.html">育児休業給付</A>
            など)。
          </li>
        </ul>
        <p className="text-sm leading-8 text-haze">政府の統計は、政府標準利用規約にもとづき、出典を明記して利用しています。</p>
      </Section>

      <Section title="ご注意">
        <p>上の資料を手がかりにした概算や、このサイトの設計上の仮定が含まれます。数値は、資料の転記ではありません。株価・投資の値動きは、乱数でつくった架空のものです。</p>
      </Section>
    </PageShell>
  );
}
