# Beat Roguelite

弹幕肉鸽为主，音游为辅。架构见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。衣橱见 [`docs/features/wardrobe.md`](docs/features/wardrobe.md)。

## 操作

- **枢纽**：`↑↓` 选择，`← →` 换主页风格（镜厅 / 魔法深林 / 霜月湖 / 熔金圣堂 / 星港残响），Enter 确认；外形行 A/D 换人
- **图鉴**：人物（Vie / Lite / Iru / Sofia / 先锋）与怪物（小兵 / 精英 / 五关 Boss）；右侧 3/4 全身模型（慢转台，可拖）；A/D 切栏，W/S 条目，Esc 回枢纽
- **衣橱**：换装 / 化妆 / 姿势；启动即 hydrate，**局内同一角色穿 Look**；Esc 回枢纽（详见衣橱文档）
- **选项**：`← →` 调音量或换主页风格（局外循环当前曲，便于听高低）；Esc 回枢纽
- **商店**：永久人物属性（叠买至 3）· 自动拾取 · 开局融合（叠买至 4）；↑↓ 选中、Enter 购买，Esc 回枢纽
- **出发**：`Tab` 标准五波 / 无限，`1–5` 选初始武器，`A/D` 祝福，买了开局融合则下一行选要融哪几门（`Q` `E` 也可），`6–9` / `T` / `Y` 勾契约，`[ ]` 切歌，Enter 开局，Esc 回枢纽
- `WASD`：移动
- 自动开火（风息短锥 / 火球 / 霜环 / 雷链 / 落岩）；升级给人物属性（含**施法距离 / 施法范围**）。HUD 槽位有冷却环
- **磁铁**：出门就有吸金/经验半径；升级「磁铁」加远；遗物也会被吸但更近
- 击杀掉经验珠（青晶）与金币；踩/吸入后入账。**杀 Boss 全场收一次**（经验、金、遗物）
- 小怪按种类动：追击突进 / 射手风筝 / 重装冲锋 / 吸血侧扑 / 射手绕圈；垃圾偏快脆，重装/精英偏慢高血高防；**小兵弹小、擦几下才掉一心**；清场后加速补刷维持场上密度
- 怪物生命 / 移速 / 攻击 / 护甲随波次增长（无限继续涨）；Boss 表倍率为波 5 终值，早关略软
- **天气**：一波内按曲进度循环 3～6 段（约 50s 一段）；含磁暴（风带 1 · 雷−）；热浪火+ 冰−
- **融合**：**关末三选**立刻嫁接进主手。商店买了开局融合则**出发就先融**（最多 4 门）。例：火球出发融雷链 → 仍是火球，打中会电弧串人
- **宝箱**：每波 1 只，**曲中段（约 1/2～2/3）在远处出现**，一口碎；打碎开遗物三选一（池 6 抽 3，软顶 3；满件后改人物属性）。曲终未找开会自动碎并入队
- **专精**：精英 / Boss 掉落加厚**当前主手**传打轴（击退 / 分裂 / 弹射 / 缓速 / 多发），**可叠**；融进来的门不再出那门专精
- **Boss / 精英**：击杀立刻三选，专精 / 满层 / 节拍**每组最多一张**；不满三张随机补人物属性（不是把某组剩下的抽满）。满层只学一次。Boss 才出节奏专项（宽判/热槽…）；精英节拍组只出拍点加码。Boss 特技有前摇提示（底栏 + 血条闪黄 + 地面读谱环/十字/冲锋扇）；号手清增援、合唱读窗、暴君半血变相
- **精英**：曲中段黄环预告 + 底栏提示；Boss 出场前保证至少一只
- **关末**：三选融合（立刻嫁接）；融满后改属性
- `J` / `K` / `L`：打谱（低 / 中 / 高；右手食指默认 `J`）
- `F`：Fever 槽满后手动释放
- `Shift`：位移闪避（耗热度；热度不够放不出）
- 局内 `Esc`：暂停并打开 DOM 调试属性面板

## 资源仓

开发时 Vite 把 sibling `../co_der-resource` 挂到 `/res/*`：

- 音频：`music-resource/**/music.json` + mp3
- 节奏点：`music-rhythm-points/{songId}.json`（低/中/高三轨）
- **高模 / 衣橱 / 语音**：`beat-roguelite/figures/<pack-id>/`
- **osz 练习谱 / 发版禁用的曲目包**：`beat-roguelite/osz/`（仅本地 dev）

**底模（发版默认）**由程序绘制，不依赖 glb。**音游层（曲目 / 公路 / JKL 打谱）**仅本地 dev；发版为纯弹幕素打（`VITE_RHYTHM_ENABLED=false`）。本地开：`pnpm dev` 或 `?rhythm=on`。

游戏仓 `public/figures/` 只保留 `active.json`（默认外形 id）。已有本地包可一次性迁移：

```bash
pnpm migrate:figures   # 一次性：figure 包 → co_der-resource
pnpm migrate:audio     # 一次性：public/osz → co_der-resource
```

## 开发

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm import:tka
```

默认曲：《太阳之子》等，见 `src/content/tracks.ts`。

工坊 pak/zip 丢到导入器 inbox 后跑 `pnpm import:tka`（写出 `../co_der-resource/beat-roguelite/figures/tka-jodi/models`）。需本地 sibling `universe/repos/co_der-resource`。

## GitHub Pages 发版

仓：[`github.com/DeyaoCai/beat-roguelite`](https://github.com/DeyaoCai/beat-roguelite) → 站点路径 **`/beat-roguelite/`**。

```bash
pnpm build:ship          # 程序底模 + 弹幕素打（约 1 MB）
pnpm deploy:pages        # 手动推 gh-pages（可选）
```

**推荐**：push `main` 后由 [GitHub Actions](.github/workflows/pages.yml) 自动部署。仓库 **Settings → Pages → Build and deployment → GitHub Actions**。

访问：`https://deyaocai.github.io/beat-roguelite/`

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_BASE` | `/beat-roguelite/` | 子路径；用户页根域改为 `/` |
| `VITE_RHYTHM_ENABLED` | dev 开 / ship `false` | 音游层（曲目·公路·打谱） |
| `VITE_FIGURE_BACKEND` | `procedural`（ship 构建固定） | 本地高模：`?quality=high` |
| `PAGES_REMOTE` | `origin` | 手动 deploy 脚本用的 remote |

发版包：**程序底模 + 弹幕素打**（无曲目、无公路、无打谱）。音游与 `co_der-resource` 音频仅本地 dev（`/res/*`）。

### 首次推送到 GitHub

```bash
git remote add github https://github.com/DeyaoCai/beat-roguelite.git
# 或改 origin：git remote set-url origin https://github.com/DeyaoCai/beat-roguelite.git
git push -u github main
```
