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
    <div className="mx-auto w-full max-w-5xl px-[2.5vw] pb-24 pt-10 sm:px-12">
      <div className="page-card rounded-sm px-4 py-8 sm:px-10 sm:py-10">
      <h1 className="text-center text-3xl tracking-[0.3em] text-mist">{title}</h1>
      {lead && <p className="mx-auto mt-6 max-w-2xl w-fit text-left text-base leading-9 tracking-wider text-haze">{soften(lead, 16)}</p>}
      <div className="mt-14 space-y-14">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-l-2 border-warm pl-4 text-xl tracking-[0.2em] text-warm">{title}</h2>
      <div className="mt-5 space-y-4 text-base leading-9 tracking-wider text-mist">{softenNode(children)}</div>
    </section>
  );
}
