import { Children, cloneElement, isValidElement } from "react";
import { soften } from "@/lib/jp";

// 本文の、読点(、)を、ほどよく減らす(文字列だけを対象に、ふくまれる要素の中も、たどる)。
function softenNode(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") return soften(node, 16);
  if (Array.isArray(node)) return Children.map(node, softenNode);
  if (isValidElement<{ children?: React.ReactNode }>(node) && node.props.children !== undefined) {
    return cloneElement(node, undefined, softenNode(node.props.children));
  }
  return node;
}

// 本文ページの共通の枠。枠線では囲まず、画面いっぱいに広げて読みやすい幅の本文を置く。
export function PageShell({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl pb-24 pt-10 sm:px-12">
      {/* スマホでは、枠の左右の余白と、本文の左右の余白を、フッターと同じ幅(画面の2.5%)にそろえる */}
      <div className="page-card rounded-sm px-[2.5vw] py-8 sm:px-10 sm:py-10">
      <h1 className="text-center text-2xl tracking-[0.2em] text-mist sm:text-3xl sm:tracking-[0.3em]">{title}</h1>
      {lead && <p className="mx-auto mt-6 max-w-2xl w-fit text-left text-sm leading-7 tracking-wide text-haze sm:text-base sm:leading-9 sm:tracking-wider">{soften(lead, 16)}</p>}
      <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-14">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-l-2 border-warm pl-3 text-base tracking-[0.15em] text-warm sm:pl-4 sm:text-xl sm:tracking-[0.2em]">{title}</h2>
      <div className="mt-4 space-y-3 text-[13px] leading-7 tracking-wide text-mist sm:mt-5 sm:space-y-4 sm:text-base sm:leading-9 sm:tracking-wider">{softenNode(children)}</div>
    </section>
  );
}
