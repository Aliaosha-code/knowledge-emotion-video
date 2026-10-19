// timeline.skeleton.js —— 知识情感短片的时间表骨架
// 用法：复制到 src/<proj>/timeline.js，只改 T / CAPTIONS / SFX_CUES 三处。
// 铁律：所有秒数只在这里出现，render() 里不许写死时间。

export const LOOK = {
  bg: '#0A0C10',
  bgLift: '#101030',
  text: '#E4E4E5',
  gold: '#C9A227',
  cold: '#537FAA',
  vignette: 0.55,
  grain: 0.035,
  subtitle: { y: 0.935, size: 46, weight: 300, tracking: 0.04 },
};

// ── 六幕时间轴（总长 164s）
export const T = {
  total: 164,

  // ① 悖论开场 0–15
  hookStart: 0,
  hookEnd: 15,

  // ② 实验/史料 15–55
  evidence: 15,
  evidenceEnd: 55,

  // ③ 命名 55–85（概念名必须在 85 前出现）
  naming: 72,          // 名字落下的那一秒
  namingEnd: 85,

  // ④ 私人化 85–115（三件具象小事）
  personal: 86,
  personalEnd: 115,

  // ⑤ 反转 115–145
  turn: 118,
  turnEnd: 145,

  // ⑥ 落款 145–164
  closing: 150,
  warmFrom: 142,       // 冷→暖的转场起点
  end: 164,
};

// ── 字幕：每句只有一个染色词（gold: [起, 止] 为该句内的字符区间）
export const CAPTIONS = [
  { t: 0.0,  text: '领奖台上，第二名笑不出来。',           gold: null },
  { t: 4.2,  text: '第三名，却笑得像赢了。',               gold: [7, 11] },
  { t: 18.0, text: '1992 年，心理学家关掉声音、遮住名次——', gold: [5, 9] },
  { t: 72.0, text: '大脑里，有一台停不下来的「如果机器」。', gold: [11, 15] },
  { t: 118.0, text: '但先别急着同情银牌。',                gold: null },
  { t: 152.0, text: '把那 0.01 秒追回来。',                gold: [2, 8] },
];

// ── 音效只打三处：命名 / 反转 / 落款
export const SFX_CUES = [
  { t: T.naming, kind: 'naming',  gain: -8,  desc: '干净落定音' },
  { t: T.turn,   kind: 'reverse', gain: -10, desc: '反向扫频' },
  { t: T.closing, kind: 'tail',   gain: -12, desc: '长尾混响' },
];

// ── 镜头：平均 ≥16 秒，每镜内部必须持续运动
export const SHOTS = [
  { from: 0,   to: 15,  move: 'slow-push',  subject: '领奖台 2/1/3，金色聚光' },
  { from: 15,  to: 34,  move: 'orbit',      subject: '1992 实验室，量表 1–10' },
  { from: 34,  to: 55,  move: 'drift',      subject: '大脑内的「如果机器」' },
  { from: 55,  to: 85,  move: 'slow-pull',  subject: '两根分叉的路径：上行/下行' },
  { from: 86,  to: 115, move: 'still+particle', subject: '三件具象物：地铁门/分数线/删除键' },
  { from: 115, to: 142, move: 'reveal',     subject: '疼痛的机器＝变强的机器' },
  { from: 142, to: 164, move: 'warm-bloom', subject: '暖光升起，落款' },
];

// ── 渲染入口：必须暴露 window.render(t) 与 window.READY
// render() 内禁止 Math.random / Date / CSS transition / requestAnimationFrame
// 随机值一律用确定性哈希：rand(i) => fract(sin(i * 12.9898) * 43758.5453)

export function activeCaption(t) {
  let cur = null;
  for (const c of CAPTIONS) {
    if (t >= c.t) cur = c;
    else break;
  }
  return cur;
}

export function activeShot(t) {
  return SHOTS.find((s) => t >= s.from && t < s.to) || SHOTS[SHOTS.length - 1];
}

// 拉入期/高潮/落款的整体亮度包络（0–1），用来做画面强度曲线
export function intensity(t) {
  const { naming, turn, closing, total } = T;
  if (t < naming) return 0.55 + 0.15 * (t / naming);
  if (t < turn) return 0.85;
  if (t < closing) return 0.7;
  return 0.6 + 0.3 * ((t - closing) / (total - closing));
}
