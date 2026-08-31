# tka-import

把致命解药模组转成网页衣橱用的 **glb + png**。不必开 FModel。

## 流程

默认读取 **Vortex** 下载目录（若存在）：

`%AppData%\Roaming\Vortex\downloads\thekillingantidote`

否则用 `repos/beat-roguelite/inbox/`。可用环境变量 `TKA_INBOX` 或 `--in` 覆盖。

```bash
pnpm import:tka
```

已导入过的包（同文件名、体积、修改时间）会跳过。Vortex 里新下的才会再导。仓内 `inbox/` 整包重导：

```bash
pnpm import:tka:force
pnpm import:tka:poses
```

`import:tka:poses` 先删 `Achates_Poses` / `Achates_Sprint` 输出，再扫 AES → `Female_Skeleton` → 姿势 glb。不要手删 `user2/`。

超过 150MB 的包（地图等）会跳过；要全导入加 `--all`。

```bash
dotnet run --project tools/tka-import -- --out public/figures/tka-jodi/models --all
```

3. 刷新标题页衣橱

实际三步：解压压缩包 → CUE4Parse 挂载 pak（UE4.27）→ 导出 SkeletalMesh / AnimSequence 为 glTF、Texture2D 为 PNG。  
**不用 `repak` 解出 uasset**；转换器直接读 pak。

## 输出

`public/figures/tka-jodi/models/<ModId>/`（例如 `TKA_RoomGirl/BreCross/brecross.glb`）  
以及 `public/figures/tka-jodi/models/wardrobe-index.json`、各模组 `tables.json`（原始 DataTable）和 `files.json`（资源清单）。**不再写**语义 `catalog.json`；槽位在网页 catalog 读表。

旧目录里若还留着 `catalog.json`，网页会当兼容层读。整包重导用 `pnpm import:tka:force`（忽略缓存、写出新表，并删掉该模组过期 `catalog.json`）。不必删 `user2/` 身体网格。刷新衣橱后若穿戴错乱，清浏览器 localStorage 键 `beat-roguelite.wardrobe.v1`。

## Oodle

工坊 pak 多用 Oodle。工具会找：

- `inbox/oo2core_9_win64.dll`
- FModel 目录里的 `oodle-data-shared.dll` / `oo2core_*.dll`

没有的话把 FModel 那份 DLL 拷进 `inbox` 并改名为 `oo2core_9_win64.dll`。

## 正包

官方 `pakchunk0` 有 AES。工坊衣服包一般不加密。导入器会：

1. `--aes 0x…` 或环境变量 `TKA_AES`
2. 否则按 [AESDumpster 1.3](https://github.com/GHFear/AESDumpster) 的 C7 特征扫本机 `TheKillingAntidote-Win64-Shipping.exe`

扫到后用来挂正包里的 `Female_Skeleton`（姿势轨道的骨索引）。钥匙不写进 git。
