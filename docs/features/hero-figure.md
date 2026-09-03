> **feature_id**: F-hero-figure
> **status**: partial
> **last_verified**: 2026-09-01

# 主角 Figure

局内和衣橱预览共用一份 **HeroFigure** 契约。战斗循环只调 `playGait` / `tick` / `getFrame` / `setOutline`，不读 TKA 骨名或 `user2/`。

规划：[`plans/beat-roguelite/hero-figure-lsp.md`](../../../../plans/beat-roguelite/hero-figure-lsp.md)。衣橱能力仍见 [`wardrobe.md`](wardrobe.md)。

## 玩家能看到的

- 枢纽「外形」A/D 切 Vie / Lite / Iru / Folgi / Sofia（persist）；`?figure=` 仍可开 Jodi。
- 局内左上：特写 | HP/XP/HEAT | Sofia 通讯窗；右上角是天气。
- 局内 WASD 切走路 clip，站住切待机 clip。

## 资源

```
public/figures/active.json              { "id": "holysee-vie" | "holysee-lite" | "holysee-iru" | "skyrim-folgi" | "skyrim-female" | … }
public/figures/holysee-vie/
public/figures/holysee-lite/
public/figures/holysee-iru/
public/figures/skyrim-folgi/
public/figures/tka-jodi/
public/figures/skyrim-female/
```

浏览器：`/figures/tka-jodi/models/user2/user.glb`。`pnpm import:tka` 的 `--out` 对准该 `models/`。敌人 / 地形 / 音频不进 figure 包。

## 代码

```
src/figures/
  index.ts              门面（presentation 只从这里进）
  types.ts · pack.ts · createHeroFigure.ts
  kernel/               蒙皮 / clip / 身高框 / 描边
  procedural/           发版默认：程序底模（Vie/Lite/Iru/Sofia kit）
  tka-jodi/             ModularAvatar · jiggle · 走打 clip
  skyrim-female/        glb + HKX gait（工坊 / quality=high）
```

`threeOrtho` 只 `createHeroFigure`。衣橱仍只对 TKA：`capabilities.wardrobe` 为真时才有 `WardrobeApi`；枢纽不显示衣橱入口。局内另建一份 Sofia（独立 scene，不挂 `playerRoot`）blit 到通讯窗。

## 已知缺口

- ~~假盒子 figure~~ → 发版默认程序底模（`figures/procedural`）；`?backend=gltf` / `?quality=high` 走导入 glb。
- ~~Sofia 通讯强制 gltf~~ → 默认 procedural **bust**（耳机 + 裙座）；语音优先包根 `voices.ship.json`。
- 三姐妹衣橱（无 wardrobe）。
- Facegen 头：导入工坊仍可能要 bake；发版程序底模不走 facegen。
- Nyr / Ichigo 压缩包损坏，未导入。
- Sofia 不进枢纽外形循环；战斗语音走当前姐妹，闲聊 / 波次报话走通讯员。
