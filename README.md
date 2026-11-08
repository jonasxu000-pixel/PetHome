# PetHome

**让远方的爱宠，在手机里陪伴你。**

上传真实猫狗照片，由 GLM 视觉模型读取外貌特征，匹配现有 3D 预设；确认或手动调整后保存，在温暖小屋里摸头、点鼻、顺背、逗尾、休息与唤醒。

这是个性化数字陪伴产品，采用预设匹配与有限定制，不是照片自动生成高精度 3D，也不监测现实动物。

## 运行

Node.js 22+，推荐 24。

```sh
npm ci
```

复制 `.env.example` 为 `.env.local`，在本机安全填写已有的 GLM 服务端密钥；默认免费 `zhipu` 路线，不自动转付费模型。

```sh
npm run dev
# 或正式构建
npm run build
npm start
```

在线体验：**https://pethome.brillianthhh.xyz**

备用临时网址：https://rated-restrict-wiring-blvd.trycloudflare.com

本机正式体验：http://localhost:3000 。当前通过独立 Cloudflare Tunnel 发布本机 Node 服务；演示期间须保持这台电脑联网且不休眠。它不是 Vercel/Workers 云托管，备用临时网址随隧道进程重建会变化。

## 已实现

- 真实照片外貌识别、未知特征标注、预设匹配和手动确认。
- 3 个模型资产、9 个外观预设；猫带原生动画，当前狗为静态外观加整体轻反馈。
- 名字、照片、外观持久保存；数字休息与夜灯偏好保存。
- 44 项单测，浏览器创建/互动/恢复/错误路径验收。

## 数据与部署

当前运行方式为常驻 Next.js Node 服务、浏览器 IndexedDB 和本机私有档案目录 `.pethome-data`。如迁移到只读/临时文件系统的平台，须先适配签名密钥和档案存储；不能把本地文件持久化直接当成 serverless 云存储。

`.env*`、私有档案、签名密钥、用户照片、识别日志及实验目录不提交。只有公开素材和许可清单位于 `public/models/pets`。

## 素材与验收

- Vuena 猫：CC0 1.0，署名与来源见 `public/models/pets/vuena-cute-pets/LICENSE.txt`。
- Sloyd 狗：CC BY 4.0，作者 Sloydinator / TopoForge，完整署名和改动见 `public/models/pets/sloyd/ATTRIBUTION.md`。
- 试用流程：`docs/黑客松用户试用流程.md`。

真实设备、多人并发和公网可用性仅在实际测试后报告；浏览器触摸仿真不等同于真机验收。
