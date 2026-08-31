> **last_verified**: 2026-08-30

# beat-roguelite 文档索引

vanilla TS + Three.js 弹幕肉鸽。UI **不是** Vue Controller。

## Agent 阅读

| 任务 | 先读 | 勿读 |
|------|------|------|
| 衣橱 / 导入 / 化妆预览 | [`features/wardrobe.md`](features/wardrobe.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) | 把 hydrate 模式抄到新仓 |
| 老滚换装 | [`features/skyrim-wardrobe.md`](features/skyrim-wardrobe.md) · 宇宙 `plans/beat-roguelite/skyrim-wardrobe.md` | 把 TKA `ClothesTypeName` 套到 nif |
| 主角 3D / 换包 | [`features/hero-figure.md`](features/hero-figure.md) | 把 Skyrim clip 重定向到 Jodi 骨名 |
| 玩法循环 | 仓 `README.md` · 宇宙 `plans/beat-roguelite/design.md` | `plans/.../archive/` 当任务队列 |
| 架构 / DDD | [`ARCHITECTURE.md`](ARCHITECTURE.md) | — |

产品规划正文在宇宙 [`plans/beat-roguelite/`](../../../plans/beat-roguelite/)。

## 能力

| 能力 | 文档 | 状态 |
|------|------|------|
| 衣橱 BC | [`features/wardrobe.md`](features/wardrobe.md) | partial |
| 老滚衣橱 | [`features/skyrim-wardrobe.md`](features/skyrim-wardrobe.md) | planned |
| 主角 Figure | [`features/hero-figure.md`](features/hero-figure.md) | partial |

## 工程规范

- 分层：[`ARCHITECTURE.md`](ARCHITECTURE.md)
- 依赖守卫：`pnpm check:ddd`
- 导入工坊包：`pnpm import:tka`（写出 `public/figures/tka-jodi/models`）
