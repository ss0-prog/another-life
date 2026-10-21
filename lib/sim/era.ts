// 時代に合わない要素(昭和にスマートフォンやマッチングアプリがある、など)を出さないための、年の表。
// 年は、その人が生きている西暦(生まれた年 + 年齢)。登場した年は、ひろく使われはじめた目安(設計上の仮定)。

export const yearOf = (p: { birthYear?: number; age: number }): number => (p.birthYear ?? new Date().getFullYear() - p.age) + p.age;

export const SINCE = {
  pc: 1990, // 家庭や職場の、パソコン
  internet: 1996, // インターネットが、家庭に広がる
  mobile: 1996, // 携帯電話
  smartphone: 2008, // スマートフォン
  sns: 2008, // SNS
  matching: 2012, // マッチングアプリ
  crypto: 2014, // 暗号資産
  nisa: 2014, // NISA
  kidsNisa: 2016, // 子どものための、積立(ジュニアNISA)
  reit: 2001, // 不動産の投資信託
  streaming: 2008, // 動画配信
  netCafe: 1995, // ネットカフェ
} as const;

// 職種ごとに、できた年(これより前の年には、その職種には就けない)。
export const JOB_SINCE: Record<string, number> = {
  streamer: 2008,
  esports: 2012,
  data_sci: 2012,
  web_designer: 1996,
  ec_shop: 1998,
  drone_pilot: 2015,
  it_infra: 1995,
  it_support: 1995,
  game_creator: 1983,
};
export const jobAvailable = (id: string, year: number) => (JOB_SINCE[id] ?? 0) <= year;

export const LESSON_SINCE: Record<string, number> = { programming: 1995 };
export const lessonAvailable = (id: string, year: number) => (LESSON_SINCE[id] ?? 0) <= year;

export const PARTTIME_SINCE: Record<string, number> = { side_remote: 2008 };
export const partTimeAvailable = (id: string, year: number) => (PARTTIME_SINCE[id] ?? 0) <= year;

// 運用できる資産ごとに、できた年。
export const ASSET_SINCE: Record<string, number> = { crypto: SINCE.crypto, reit: SINCE.reit };
export const assetAvailable = (id: string, year: number) => (ASSET_SINCE[id] ?? 0) <= year;

// 1文を、その年に合う形に直す。合わなければ null(その文は、出さない)。
export function eraSentence(text: string, year: number): string | null {
  let t = text;
  if (/スマートフォン一つで/.test(t) && year < 2012) return null;
  if (/スマートフォン|スマホ/.test(t)) {
    if (year >= SINCE.smartphone) {
      /* そのまま */
    } else if (year >= SINCE.mobile) t = t.replace(/スマートフォン|スマホ/g, "携帯電話");
    else return null;
  }
  if (/ノートPC|パソコン/.test(t) && year < SINCE.pc) return null;
  if (/SNS/.test(t) && year < SINCE.sns) return null;
  if (/ネットカフェ/.test(t) && year < SINCE.netCafe) t = t.replace(/ネットカフェや路上/, "駅や公園");
  if (/オンライン講座/.test(t) && year < SINCE.internet) t = t.replace(/オンライン講座/g, "通信講座");
  return t;
}
