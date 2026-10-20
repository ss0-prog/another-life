"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ShareButtons } from "@/components/ShareButtons";
import { LifeCard } from "@/components/CompareResult";
import { getShared, unpublishEntry, type ArchiveEntry } from "@/lib/archive";
import { getMessages } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";

const t = getMessages().result;

function ArchiveEntry() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const [entry, setEntry] = useState<ArchiveEntry | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) {
      setEntry(null);
      return;
    }
    getShared(id).then(setEntry);
  }, [id]);

  if (entry === undefined) return <p className="py-24 text-center text-sm tracking-wider text-haze">読み込んでいます</p>;
  if (entry === null)
    return (
      <div className="py-24 text-center">
        <p className="text-base tracking-wider text-haze">この人生は見つかりませんでした。</p>
        <Link href="/archive" className="mt-6 inline-block text-sm tracking-[0.2em] text-warm underline underline-offset-8">
          誰かの人生へ戻る
        </Link>
      </div>
    );

  const mine = Boolean(user && entry.owner && entry.owner === user.uid);

  return (
    <div className="mx-auto w-full max-w-[120rem] px-6 sm:px-12 pb-24 pt-12">
      <p className="text-center text-xs tracking-[0.3em] text-haze">公開された人生</p>
      <h1 className="mt-4 text-center text-xl leading-9 tracking-[0.2em] text-mist">{entry.branchLabel}</h1>
      <p className="mt-2 text-center text-sm tracking-wider text-haze">{entry.branchAge}歳で分かれた二つの人生</p>

      <div className="mx-auto mt-14 grid max-w-7xl gap-10 md:grid-cols-2 md:gap-y-0">
        <LifeCard t={t} heading={t.realHeading} life={entry.real} delay={0.3} accent="cool" />
        <LifeCard t={t} heading={t.altHeading} life={entry.alt} delay={0.6} accent="warm" />
      </div>

      <p className="mx-auto mt-14 max-w-md w-fit text-left text-xs leading-6 tracking-wider text-dim">{t.disclaimer}</p>

      {entry.comment && (
        <section className="mx-auto mt-16 w-full max-w-2xl text-left">
          <h2 className="text-sm tracking-[0.3em] text-haze">この人生を公開した人のひとこと</h2>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-8 tracking-wider text-mist">{entry.comment}</p>
        </section>
      )}

      <div className="mt-10 flex flex-col items-center gap-5">
        <ShareButtons text={`${entry.branchLabel}(${entry.branchAge}歳)で分かれた二つの人生。`} />
        {mine && (
          <button
            type="button"
            onClick={async () => {
              if (await unpublishEntry(entry.id)) router.push("/archive");
              else setFailed(true);
            }}
            className="border border-line px-5 py-2 text-sm tracking-[0.2em] text-haze hover:border-haze hover:text-mist"
          >
            この公開を取り下げる
          </button>
        )}
        {failed && <p role="alert" className="text-sm text-haze">取り下げできませんでした。</p>}
        <Link href="/archive" className="text-sm tracking-[0.2em] text-haze underline-offset-8 hover:text-mist hover:underline">
          誰かの人生へ戻る
        </Link>
      </div>
    </div>
  );
}

export default function ArchiveEntryPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm tracking-wider text-haze">読み込んでいます</p>}>
      <ArchiveEntry />
    </Suspense>
  );
}
