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
        <p>年齢・出生地・性別・性自認・惹かれる相手・先天性の持病・MBTI・仕事・貯金などの入力は、あなたの端末(ブラウザ)の中でだけ計算に使われます。サーバーには送信されません。</p>
      </Section>

      <Section title="結果の保存">
        <ul className="list-disc space-y-3 pl-6">
          <li>ログインしていない場合は、結果も、最後に入力した条件も、このブラウザの中に保存されます。条件は、トップ画面の「この端末の記憶を消す」から、いつでも削除できます。</li>
          <li>Google でログインした場合は、結果をあなたのアカウントに紐づけて保存します(Firebase を利用)。パスワードはこのサイトでは扱わず、ログインの管理は Google が行います。</li>
          <li>保存した結果を読み書きできるのは、ログイン中のあなただけです。</li>
        </ul>
      </Section>

      <Section title="誰かの人生への公開">
        <p>
          ログインしたうえで、保存のときに「公開する」を選んだ場合に限り、結果が
          <Link href="/archive" className="underline underline-offset-4 hover:text-warm">誰かの人生</Link>
          に掲載されます。
        </p>
        <ul className="list-disc space-y-3 pl-6">
          <li>公開されるのは、二つの人生の要約(年表・情景・能力値・最終的な資産)と、ターニングポイントの種類と年齢です。あわせて、コメント欄に書いた文章が、そのまま載ります。</li>
          <li>先天性の持病・MBTI・性自認・惹かれる相手・入力した年齢や出生地は公開されません。自由記述は「自分の言葉で選んだ」とだけ表示し、地名は伏せます。</li>
          <li>コメントには、名前や連絡先など、ご自身を特定できる情報を書かないでください。</li>
          <li>公開した結果は、ご本人だけがあとから取り下げられます。</li>
        </ul>
      </Section>

      <Section title="音声入力">
        <p>職業を「声で探す」機能は、お使いのブラウザ(Chromeなど)の音声認識サービスを使います。ボタンを押して話したときだけ、声がブラウザの提供元のサーバーに送られて文字になります。このサイトは声を受け取らず、保存もしません。使いたくない場合は、書いて探すこともできます。</p>
      </Section>

      <Section title="お問い合わせ">
        <p>フォームに入力された内容(お名前・返信先のメールアドレス・本文)は、返信のためにだけ使います。外部のフォーム送信サービス(Web3Forms)を通じて運営者のメールに届き、取り扱いは Web3Forms のプライバシーポリシーに従います。</p>
      </Section>

      <Section title="アクセスの記録">
        <ul className="list-disc space-y-3 pl-6">
          <li>いまこのサイトを見ている人の数を知るために、ページを開いているあいだ、ランダムな識別子と時刻だけを60秒ごとに記録します。ページを閉じると消えます。個人を特定する情報は含まれません。</li>
          <li>利用状況(ページの閲覧数・閲覧された国と端末の種類・読み込みの速さなど)を知るために、Cloudflare Web Analytics を使っています。個人を特定する情報は集めません。</li>
          <li>Cookie は使いません。広告のためのトラッキングも行いません。</li>
        </ul>
        <p>本ページの内容は、予告なく変更することがあります。</p>
      </Section>
    </PageShell>
  );
}
