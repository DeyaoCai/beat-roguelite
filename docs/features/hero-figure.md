> **feature_id**: F-hero-figure
> **status**: partial
> **last_verified**: 2026-08-30

# 主角 Figure

局内和衣橱预览共用一份 **HeroFigure** 契约。战斗循环只调 `playGait` / `tick` / `getFrame` / `setOutline`，不读 TKA 骨名或 `user2/`。

规划：[`plans/beat-roguelite/hero-figure-lsp.md`](../../../../plans/beat-roguelite/hero-figure-lsp.md)。衣橱能力仍见 [`wardrobe.md`](wardrobe.md)。

## 玩家能看到的

- 枢纽 / 衣橱 / 局内是同一套主角网格。
- 局内 WASD 切走路 clip，站住切待机 clip；路径写在 `public/figures/tka-jodi/figure.json`。
- 当前包由 `public/figures/active.json` / `?figure=` 选择（老滚或 Jodi）。

## 资源

```
public/figures/active.json              { "id": "skyrim-female" | "tka-jodi" }
public/figures/tka-jodi/figure.json
public/figures/tka-jodi/models/
public/figures/skyrim-female/figure.json
public/figures/skyrim-female/models/body.glb
```

浏览器：`/figures/tka-jodi/models/user2/user.glb`。`pnpm import:tka` 的 `--out` 对准该 `models/`。敌人 / 地形 / 音频不进 figure 包。

## 代码

```
src/figures/
  index.ts              门面（presentation 只从这里进）
  types.ts · pack.ts · createHeroFigure.ts
  kernel/               蒙皮 / clip / 身高框 / 描边
  tka-jodi/             ModularAvatar · jiggle · 走打 clip
  skyrim-female/        glb + HKX gait（Skyrim 骨名）
```

`threeOrtho` 只 `createHeroFigure`。衣橱仍只对 TKA：`capabilities.wardrobe` 为真时才有 `WardrobeApi`；枢纽不显示衣橱入口。

## 已知缺口

- 假盒子 figure。
