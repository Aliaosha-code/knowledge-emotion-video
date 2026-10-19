# 让画面咬住音乐的冲击

> 一条片子"有没有劲"，八成不在画面本身，在于画面有没有跟着音乐的重击走。
> 这份文档给的是可复现的三步法，配套素材：`assets/ref-yubo-164s.m4a` + `assets/impacts-yubo.json`。

## 一、先纠正一个错误直觉

用 2 秒窗口量参考片，会得出"动态范围只有 4 dB、是一条恒定声墙"的结论——然后误以为它没有起伏。

**把窗口缩到 10 毫秒，低频（<130 Hz）的动态范围是 11.8 dB，全曲有 47 个可辨识的重击点。**
起伏一直在，只是被长窗口平均掉了。判断"有没有冲击"必须用 10 ms 粒度。

## 二、三步法

### 第 1 步：提取冲击点

```python
import subprocess, numpy as np
out = subprocess.run(['ffmpeg','-v','error','-i',audio,'-vn','-ac','1','-ar','48000','-f','f32le','-'],
                     capture_output=True).stdout
a = np.frombuffer(out, dtype=np.float32); sr = 48000

# 只留低频：底鼓是"冲击"的来源，人声和镲片会把检测带偏
X = np.fft.rfft(a); f = np.fft.rfftfreq(len(a), 1/sr)
mask = 1 / (1 + np.exp(np.clip((f - 130) / (130 * 0.4 + 1), -60, 60)))
low = np.fft.irfft(X * mask, len(a))

hop, win = 480, 1440                      # 10ms hop / 30ms 窗
n = (len(a)-win)//hop
e = np.array([np.sqrt((low[i*hop:i*hop+win]**2).mean()) for i in range(n)])
edb = 20*np.log10(e+1e-9)

# 上升沿：当前值减去前 60ms 的最小值
rise = np.zeros_like(edb)
for i in range(3, len(edb)):
    rise[i] = edb[i] - edb[max(0,i-6):i].min()

# 峰值 + 最小间隔 180ms，防止一个鼓点被拆成两个
cand, minsep = [], int(0.18*sr/hop)
for i in range(2, len(rise)-2):
    if rise[i] > 6 and rise[i] >= rise[i-1] and rise[i] >= rise[i+1]:
        if cand and i-cand[-1][0] < minsep:
            if rise[i] > cand[-1][1]: cand[-1] = (i, rise[i])
            continue
        cand.append((i, rise[i]))
impacts = [(idx*hop/sr, min(1.0, r/20)) for idx, r in cand]   # 强度归一到 0–1
```

输出格式：`[[秒, 强度], ...]`，强度 0–1。

### 第 2 步：分级（关键——不要每个都做特效）

| 强度 | 占比（实测 47 点） | 画面响应 |
|---|---|---|
| < 0.55 | 约 45% | **只抖网格**（±10–17 px，0.15 秒衰减）。观众感知为"底噪的律动" |
| 0.55–0.75 | 约 40% | 网格抖 + **镜头顿挫**（瞬间推近 2–4%，0.3 秒弹回） |
| > 0.75 | 约 15% | 再加 **全屏环** + 极淡闪白（alpha 0.05–0.10，2 帧） |

全片最重的几处（参考片）：`0.06s`（开场第一击，上升沿 80.9 dB）、`17.10s`（19.0）、`84.60s`（15.1）、`93.61s`（15.1）、`155.86s`（14.1）。

### 第 3 步：接到画面里

四层响应，从弱到强：

```js
// 1) 整张网抖一下 —— 不受地平线衰减影响，所以低频一定能看见
let jitter = 0;
for (const im of impulses) {
  if (im.dt > .5) continue;
  jitter += im.k * 17 * Math.exp(-im.dt * 13) * Math.sin(im.dt * 46);
}

// 2) 径向环状位移 —— 让网格"荡开一圈"
const R = 40 + im.dt * 820;
const amp = im.k * 158 * Math.exp(-im.dt * 1.9);
d += amp * Math.exp(-((rr - R) / 170) ** 2);

// 3) 镜头顿挫
if (im.dt < .34) s += im.k * .040 * Math.exp(-im.dt * 10.5);

// 4) 强冲击的全屏环 + 闪白
if (im.k > .62 && im.dt < 2.2) {
  alpha = Math.pow(1 - im.dt/2.0, 2.1) * .30 * im.k;   // 环
  if (im.dt < .05) flash(.05 + .05 * im.k);            // 闪白只有 2 帧
}
```

再加一个全局 `SHOCK` 给场景用（让主体在重击时短暂变大/变亮）：

```js
SHOCK = 0;
for (const im of activeImpacts(t)) if (im.dt < .5) SHOCK = Math.max(SHOCK, im.k * Math.exp(-im.dt * 8));
// 场景里：dot(cx, cy, 10 * (1 + SHOCK * 2.6), { glow: 30 + 40 * SHOCK })
```

## 三、实测参数（可直接抄）

| 项 | 值 |
|---|---|
| 检测窗口 | hop 10ms / win 30ms |
| 频段 | < 130 Hz |
| 上升沿阈值 | 6 dB |
| 最小间隔 | 180 ms |
| 强度归一 | rise / 20 |
| 冲击密度 | 47 点 / 164 秒 ≈ **每 3.5 秒一下** |
| 网格抖动 | 峰值 17 px，τ ≈ 77 ms |
| 镜头顿挫 | 峰值 4%，τ ≈ 95 ms |
| 全屏环 | r 60 → 1300，alpha 上限 .30 |

## 四、三个坑

1. **首帧的瞬态是假的**。0.06 秒那个 80.9 dB 是音频从静音跳到满电平造成的数字瞬态，不是真的重击——如果照它做特效，片头会莫名其妙炸一下。做法：第一个检测点单独用耳朵确认，或直接跳过 `t < 0.2s`。
2. **不要在长窗口上看动态**。2 秒窗口会把 11.8 dB 压成 4 dB，结论完全相反。
3. **特效密度比强度重要**。47 个点如果每个都放环 + 闪白，第 3 个之后观众就麻木了。分级是必须的，不是优化。

## 五、和"留白"的关系

如果用的是自己合成的配乐，冲击点应该**自己排**，而不是从音频里反推——先在时间表里写 `IMPACTS`，再让 `music.py` 在这些点上下重音。这样声画是同一个源头，不会出现"画面炸了但音乐没动"。

反过来，用别人的成品音轨时，只能反推（本文档的方法），而且要接受它的节奏。

> **素材说明**：`assets/ref-yubo-164s.m4a` 是他人作品，仅作节奏参考与学习用途，不要随你自己的作品公开分发或用于商业发布。
