> **feature_id**: F-wardrobe-bc
> **status**: partial
> **last_verified**: 2026-08-30

# 衣橱

枢纽 `2` 打开的换装预览。vanilla TS + Three.js，不是 Vue Controller。

主循环只认门面 `createWardrobe()`。衣服网格、皮肤贴图、化妆贴花、美瞳、姿势都在 `src/wardrobe/`，`domain/combat` 不得引用。

规划（切片 0–5）：[`plans/beat-roguelite/wardrobe-bc.md`](../../../../plans/beat-roguelite/wardrobe-bc.md)。美瞳语义对照 [`tka-eyes-makeup.md`](../../../../plans/beat-roguelite/tka-eyes-makeup.md)；姿势对照 [`tka-anim-pose.md`](../../../../plans/beat-roguelite/tka-anim-pose.md)。

## 玩家能做什么

- 衣服 / 化妆 / 姿势 三页；左侧按模组分组（catalog 的 `group`，不手写包名）。
- 衣服：每槽一件。皮肤只换身体 albedo，不换 `user2/user.glb`。
- 化妆：美瞳、睫毛换底模已有材质（`MainTex` / `EmissiveTex` / `Color` RGB 乘色、A=发光强度）；眉/眼影/眼线等按表里的 `ScreenRect`（或缺省 `UVRect`）**叠在**皮肤 UV 上（透明 overlay，不替换 albedo）。没有矩形的 PNG 不会铺满全身。
- 点美瞳/睫毛/眼周化妆会切镜头（表 `CameraPosition` RFHH → face/bust/full，无则默认 face）；换皮肤或卸皮肤后，当前化妆和美瞳会重画（加法，不是互替）。
- 刷新后穿戴、化妆、姿势、染色仍在（`localStorage` 键 `beat-roguelite.wardrobe.v1`，带 `lookId: vanguard_look`）。化妆 id 不写进衣服 `loadout`。这坨 persist **就是**先锋的 Look，不含战斗数值。

## 导入

```bash
pnpm import:tka
pnpm import:tka -- --only Lips
pnpm import:tka:force
pnpm import:tka:poses
```

`import:tka:force` 读仓内 `inbox/`，忽略缓存整包重导。`import:tka:poses` 会先删 `public/figures/tka-jodi/models/Achates_Poses` 和 `Achates_Sprint`（不动 `user2`），再扫 AES、重导姿势。

C#（`tools/tka-import`）只解包。每个 `public/figures/tka-jodi/models/<ModId>/`：

| 文件 | 含义 |
|------|------|
| `*.glb` / `*.png` | 资源 |
| `tables.json` | DataTable 原样（表名 + 行 + GUID 后缀字段） |
| `files.json` | 相对路径清单，不是衣服目录 |
| 不再写 | 带 `typeName` / `makeup[]` / `eyes[]` 的语义 `catalog.json` |

`wardrobe-index.json` 只列有资源的 `modId`。槽位、`Type`→Lips、剥 GUID 全在 TS catalog。

无任何 DataTable 时才按文件名 `scan`。有表则禁止把化妆 PNG 猜成皮肤。旧 `catalog.json` 仍双读一层，避免全库 `--force`。

官方 RoomGirl 内置表与导入包走同一套 `ClothesTypeName` / `MakeupTypeName`。

## 代码边界

```
src/wardrobe/
  catalog/    读表 → 衣服 / 化妆 / 美瞳行
  session/    穿戴状态 + persist（无 Three）
  preview/    把 session 画到角色（ScreenRect、美瞳、皮肤贴图）
  ui/         DOM 面板
  index.ts    createWardrobe(host, api)
```

`application/runSession` 只 import `createWardrobe`。`pnpm check:ddd`：`src/domain/**` 不得 import `src/wardrobe/`；`src/application/**` 不得 import `wardrobe/catalog|session|preview|ui`。

preview 仍调用 `presentation/render/gltfModel` 加载网格。`ModularAvatar` 只提供槽位和 `getSkinRoot()`。

旧路径 `src/content/wardrobe.ts`、`wardrobeStore.ts`、`presentation/.../wardrobeApi.ts` 只留 re-export。

## 已知缺口

- 未复刻 UE 化妆 shader（SSS、多 Pass）。
- `createWardrobe` 仍吃预览 API，不是独立 `avatarPorts`；Three 预览由 renderer 创建。
- 姿势：catalog 读 `Mod_AnimationTable`（Montage 一行一条，不并列 Sequence）；播放只套旋转到 Jodi 骨骼，不用 clip 里的位移/缩放。Jiggle 包 inbox 里还没有。

## As-Built：局内 Look

枢纽与局内共用 TKA `HeroFigure`（`createHeroFigure`）。renderer 启动即 `wardrobe.hydrate()` 拉 persist；衣橱页再 hydrate 一次无妨。进局 `playGait('walk'|'idle')`；hydrate 若中途完成会强制重绑战斗 clip，避免姿势盖住走打。

主角 glb 在 `public/figures/tka-jodi/`，见 [`hero-figure.md`](hero-figure.md)。

## As-Built：美瞳不进衣服槽

`CLOTHES_TYPE_NAMES` 已去掉 `Eyes`。美瞳/睫毛只在化妆页（`Eye` / `Eyelashes`，`Mod_EyesTable`）。旧 persist 的 `loadout.Eyes` 读写时丢弃；无表扫包时虹膜/睫毛 PNG 进 `makeup`，不再绑全身 mesh。
