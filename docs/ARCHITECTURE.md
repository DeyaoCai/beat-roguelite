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
    runSession.ts    boot + rAF 接线（唯一入口 `boot`）
    session/         prepInput · playFrame · fade · persist · snapshot
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
    render/          threeOrtho · hubStage · highway · hud2d（按 scene 拆到 hudHub/Prep/…） · hudPlay · snapshot
    ui/              tune panel
  content/           Static catalogs（characters · kits · looks · weapons · weather）
                     + rules/ 玩法数字与三选配额（domain 只读表）
  app/boot.ts        Re-exports application/runSession
```

`application/runSession` 启动时 `resolveActiveFigureId()`（`?figure=` > persist 枢纽 id > `active.json`），再交给 renderer。无 `wardrobe` 的包枢纽不列出衣橱。Sofia 固定为局内通讯员（独立 scene + 独立 voice bank）。

### 玩法规则 vs 引擎

| 放哪 | 什么 |
|------|------|
| `content/rules/` | 玩法数字总表（三选、波次、刷怪、卡池、Boss **含招式数字**、热度/Fever、元素…） |
| `content/weapons` · `kits` · `weather` · `meta` | 武器/Kit/天气/货架文案（本就是表，不并入 rules） |
| `content/fusions.ts` | 融合门槛与门 id 映射 |
| Runtime 实例 | `Enemy` / `UpgradeOffer` / `OwnedUpgrade` / `Bullet` / `GroundPickup` / `Slash` / `Crater` / `ChainBolt` 的 `.meta` 挂表指针；局内态在实例上 |
| `domain/*` | 读表执行 + 实例关联 |
| `plans/.../design.md` | 规则散文 SSOT |

规则层大体抽完；Boss **招式数字**已进 `content/rules/bosses`（`skills`），domain 只保留行为顺序。再往下才是弹道微逻辑本身。

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

Enforce: `pnpm check:ddd` · 规则纯函数：`pnpm test`

### Domain events (`World.domainEvents`)

`NoteJudged` · `EnemyDefeated` · `LevelUpPending` · `FeverBurst`

Drained each play frame in `application/session/playFrame`.

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
