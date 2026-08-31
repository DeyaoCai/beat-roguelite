# Architecture

Plan（已归档）: [`plans/beat-roguelite/archive/ddd-refactor.md`](../../../plans/beat-roguelite/archive/ddd-refactor.md)

```
src/
  domain/
    rhythm/          Chart · judge · osu parse
    combat/          player · beatBridge · spawn · projectiles · wave
    progression/     XP · gold · upgrades/luck · drops · loadout
    shared/          DomainEvent · AudioClockPort · KeyState
  application/
    runSession.ts    Scene FSM + rAF orchestration (boot entry)
  adapters/
    audio/           AudioClock (implements AudioClockPort)
    input/           keys (KeyState from domain ports)
    chart/           osz zip load
  figures/           主角 Figure BC（门面 `index.ts`）
    kernel/          蒙皮 / clip / 身高框 / 描边
    tka-jodi/        TKA 适配器
    skyrim-female/   老滚适配器（禁止 import TKA / wardrobe / presentation）
  wardrobe/          catalog · session · preview · ui（衣橱 BC；枢纽只认 createWardrobe）
  presentation/
    render/          threeOrtho · hubStage · highway · hud2d · hudPlay · snapshot
    ui/              tune panel
  content/           Static catalogs（characters 身份 · kits 底数 · looks 指针；衣橱表在 wardrobe/catalog）
  app/boot.ts        Re-exports application/runSession
```

`application/runSession` 启动时 `resolveActiveFigureId()`（`?figure=` > `active.json`），再交给 renderer。无 `wardrobe` 的包枢纽不列出衣橱。

### Dependency rules

```
presentation / application  →  domain / adapters / content / figures 门面
application                 →  wardrobe 仅门面（createWardrobe）
application / domain / presentation
                            ✖  figures/tka-jodi · figures/skyrim-female
figures/kernel              ✖  presentation · wardrobe · 各适配器
figures/skyrim-female       ✖  presentation · wardrobe · tka-jodi
wardrobe ui                 →  session + catalog
wardrobe preview            →  session + catalog；可暂调 presentation/gltfModel；TKA 网格走 figures/tka-jodi
adapters                    →  domain ports / chart parse
domain/*                    ✖  presentation · adapters · three · application · wardrobe · figures
```

Enforce: `pnpm check:ddd`

### Domain events (`World.domainEvents`)

`NoteJudged` · `EnemyDefeated` · `LevelUpPending` · `FeverBurst`

Drained each play frame in `application/runSession`.

### Combat split

`player` · `beatBridge` · `spawn` · `projectiles` · `wave`（`systems.ts` 为 facade）

### Run flow

`title (枢纽) → closet / options / shop / prep → play → … → result → title`

出发 `Tab` 选标准五波或无限。标准第五波清完进结算；无限清波继续，Boss 按 1–5 循环。

枢纽只导航。衣橱、商店、选项都是二级。

## Wardrobe BC

Feature Doc：[`features/wardrobe.md`](features/wardrobe.md)。

衣橱是独立限界上下文，不是 Meta 薄表。

```
tools/tka-import     C# 只解包 → tables.json + files.json + 资源
src/wardrobe/
  catalog            表语义（槽、ScreenRect、美瞳 Type）
  session            穿戴 / persist，无 Three
  preview            ScreenRect 贴花、美瞳换图、皮肤 albedo
  ui                 DOM 面板
  index.ts           createWardrobe() 门面
```

枢纽 `application/runSession` 只 import 门面。preview 可暂调 `gltfModel` 加载网格。皮肤贴图与化妆补丁走 `getSkinRoot()`，不把语义写回通用 loader。

角色表只引用 `lookId` / `kitId`。衣橱 persist 是先锋 Look（`vanguard_look`），不含 HP / 伤害。`resolveLoadout` 只读 Kit，不读 Look。

## Collision

Planar (`x`, `z`) AABB / arc. Height `y` is render-only.
