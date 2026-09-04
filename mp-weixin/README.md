# Beat Roguelite · 微信小程序壳（M4）

用 **web-view** 打开已部署的 H5（GitHub Pages），复用触控壳（M1–M3），**不**在小程序里重跑 Three。

## 打开方式

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本目录 `mp-weixin/`（测试号 / 正式 AppID 均可）
3. 把 `project.config.json` 里的 `appid` 换成你的
4. **公众平台 → 开发管理 → 开发设置 → 业务域名** 添加：
   - `deyaocai.github.io`（或你的 Pages 域名）
5. 真机预览；开发者工具里 web-view 能力有限，以真机为准

默认打开：

`https://deyaocai.github.io/beat-roguelite/?ui=touch&mp=1`

可在启动参数里覆盖：`?h5=` + URL 编码后的地址。

## 非目标（本期）

- 原生小游戏 Canvas / 主包塞 Three
- 衣橱 / 高模
- 微信支付 / 登录

分享、从 H5 `wx.miniProgram.postMessage` 回壳：接口已预留 `onMessage`，以后再接。
