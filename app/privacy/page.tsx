import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Section } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  alternates: { canonical: "/privacy" },
  description: "「別の宇宙のあなた」における、利用者の情報の取り扱いについて。",
};

const link = "underline underline-offset-4 hover:text-warm";

export default function PrivacyPage() {
  return (
    <PageShell title="プライバシーポリシー" lead="「別の宇宙のあなた」(以下「本サービス」)が、利用者の情報をどのように取り扱うかを定めます。">
      <Section title="1. 基本的な考え方">
        <p>本サービスは、ログインをしなくても遊べるように作られています。入力していただいた情報は、本サービスの提供に必要な範囲でのみ取り扱い、ほかのサービスやほかの目的には使用しません。</p>
      </Section>

      <Section title="2. 取り扱う情報と利用目的">
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="font-bold text-mist">シミュレーションへの入力内容</strong>
            : 年齢・出生地・性別・仕事・貯金などの入力は、お使いの端末(ブラウザ)の中でのみ計算に使用します。運営者のサーバーには送信しません。
          </li>
          <li>
            <strong className="font-bold text-mist">ログイン情報</strong>
            : Google アカウントでログインした場合に限り、ログインの識別に必要な情報を取得します。パスワードは本サービスでは取り扱いません。
          </li>
          <li>
            <strong className="font-bold text-mist">保存した結果</strong>
            : ログイン中に保存した結果を、ご本人の確認と再表示のために保管します。
          </li>
          <li>
            <strong className="font-bold text-mist">公開した結果とコメント</strong>
            : 利用者が公開を選んだ場合に限り、「誰かの人生」への掲載のために使用します。
          </li>
          <li>
            <strong className="font-bold text-mist">お問い合わせの内容</strong>
            : お名前・返信先のメールアドレス・お問い合わせ内容を、確認と返信のためにのみ使用します。
          </li>
        </ul>
      </Section>

      <Section title="3. 端末への保存">
        <p>ログインをしていない場合は、結果と最後に入力した条件を、お使いのブラウザの中に保存します。条件は、トップ画面の「この端末の記憶を消す」からいつでも削除できます。ブラウザのデータを消去した場合も、同様に削除されます。</p>
        <p>ランダムで始めた人生は、履歴(最新5件)とお気に入り(5件まで)として、同じくブラウザの中に残ります。お気に入りに入れられるのは、ログインした方のみです。</p>
      </Section>

      <Section title="4. 結果の公開について">
        <p>
          ログインしたうえで、保存のときに「公開する」を選んだ場合に限り、結果が
          <Link href="/archive" className={link}>誰かの人生</Link>
          に掲載されます。公開は、ご本人の意思によるものです。
        </p>
        <ul className="list-disc space-y-3 pl-6">
          <li>公開されるのは、二つの人生の要約(年表・情景・能力値・最終的な資産)と、ターニングポイントの種類と年齢です。コメント欄に書いた文章も、そのまま掲載されます。</li>
          <li>先天性の持病・MBTI・性自認・惹かれる相手・入力した年齢や出生地は、公開されません。自由に記入した項目は「自分の言葉で選んだ」とのみ表示し、地名は伏せます。</li>
          <li>コメントには、お名前や連絡先など、ご自身や第三者を特定できる情報を書かないでください。</li>
          <li>公開した結果は、ご本人がいつでも取り下げることができます。</li>
        </ul>
      </Section>

      <Section title="5. 外部サービスの利用">
        <ul className="list-disc space-y-3 pl-6">
          <li>ログインと結果の保管には、Google の提供するサービスを利用しています。これらの取り扱いは、Google のプライバシーポリシーに従います。</li>
          <li>職業を「声で探す」機能は、お使いのブラウザの音声認識機能を利用します。本サービスは、音声を受け取らず、保存もしません。</li>
        </ul>
      </Section>

      <Section title="6. 第三者への提供">
        <p>法令に基づく場合を除き、取得した個人情報を、ご本人の同意なく第三者に提供することはありません。</p>
      </Section>

      <Section title="7. 安全管理">
        <p>取得した情報は、漏えいや不正なアクセスを防ぐため、適切に管理します。保存した結果を読み書きできるのは、ご本人のみです。</p>
      </Section>

      <Section title="8. 情報の開示・訂正・削除">
        <p>
          ご自身の情報について、開示・訂正・削除をご希望の場合は、
          <Link href="/contact" className={link}>お問い合わせ</Link>
          からご連絡ください。ご本人であることを確認したうえで、合理的な範囲で対応します。
        </p>
      </Section>

      <Section title="9. 本ポリシーの変更">
        <p>必要に応じて、本ポリシーの内容を変更することがあります。変更した場合は、このページに掲載した時点で効力を生じます。</p>
        <p className="text-sm text-haze">最終改定日: 2026年10月21日</p>
      </Section>
    </PageShell>
  );
}
