import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Section } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "プライバシー",
  alternates: { canonical: "/privacy" },
  description: "入力した情報の扱いについて。",
};

export default function PrivacyPage() {
  return (
    <PageShell title="プライバシー" lead="入力された情報を、どこで、どのように扱うのかをまとめています。">
      <Section title="入力した内容">
        <p>年齢、出生地、性別、性自認、惹かれる相手、先天性の持病、MBTI、仕事、貯金などの入力は、あなたの端末(ブラウザ)の中でのみ計算に使われ、サーバーには送信されません。</p>
      </Section>

      <Section title="結果の保存">
        <ul className="list-disc space-y-3 pl-6">
          <li>ログインしていない場合、結果はこのブラウザの中に保存されます。</li>
          <li>最後に入力した条件(いまのあなたとターニングポイント)も、次回から入力を省略できるよう、このブラウザの中に保存します。サーバーには送信されません。トップ画面の「この端末の記憶を消す」から、いつでも削除できます。</li>
          <li>Google でログインした場合は、結果をあなたのアカウントに紐づけて保存します(Firebase を利用)。パスワードはこのサイトでは扱わず、ログインの管理は Google が行います。</li>
          <li>保存した結果を読み書きできるのは、ログイン中のあなただけです。</li>
        </ul>
      </Section>

      <Section title="みんなの人生への公開">
        <p>ログインしたうえで、結果の保存時に「公開する」を選んだ場合に限り、結果が<Link href="/archive" className="underline underline-offset-4 hover:text-warm">みんなの人生</Link>に掲載されます。</p>
        <ul className="list-disc space-y-3 pl-6">
          <li>公開されるのは、二つの人生の要約(年表、情景、能力値、最終的な資産)と、ターニングポイントの種類および年齢です。</li>
          <li>先天性の持病、MBTI、性自認、惹かれる相手、年齢や出生地などの入力内容は公開されません。自由記述の文章は「自分の言葉で選んだ」とだけ表示し、地名は伏せます。</li>
          <li>公開した結果は、ご本人だけがあとから取り下げられます。</li>
        </ul>
      </Section>

      <Section title="音声入力">
        <p>職業を「声で探す」機能は、お使いのブラウザ(Chromeなど)の音声認識サービスを使います。ボタンを押して話したときだけ、声がブラウザの提供元のサーバーに送られて、文字に直されます。このサイトは、声そのものを受け取らず、保存もしません。使いたくない場合は、ボタンを押さずに、書いて探すことができます。</p>
      </Section>

      <Section title="お問い合わせ">
        <p>お問い合わせフォームに入力された内容は、返信のためにのみ使用します。</p>
        <p>お問い合わせは、外部のフォームサービス(Tally)で受け付ける場合があります。その場合、入力した内容(お名前・返信先のメールアドレス・本文)は、Tally のサーバーに保存され、運営者だけが受け取ります。Tally での取り扱いは、Tally のプライバシーポリシーに従います。</p>
      </Section>

      <Section title="その他">
        <p>サイトの利用状況(ページの閲覧数、閲覧された国・端末の種類、読み込みの速さなど)を知るために、Cloudflare Web Analytics を使っています。Cookieは使わず、個人を特定する情報は集めません。広告のためのトラッキングは行っていません。本ページの内容は、予告なく変更することがあります。</p>
      </Section>
    </PageShell>
  );
}
