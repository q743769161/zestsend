# ZestSend

ZestSend 是一个基于 WebRTC 的点对点(P2P)文件传输网站，支持安全、私密地传输文件和消息，无需通过服务器中转或存储。

![site show](https://github.com/user-attachments/assets/cf244397-1087-44a3-bfe1-0e05f397c9ca)


## 功能特点

- 🔒 点对点(P2P)加密传输，保证数据安全与隐私
- 📁 支持传输任何类型的文件，包括照片、视频、文档等
- 💬 内置实时文本消息功能和音视频通话
- 🌐 显示连接双方的IP地址、归属地和地图定位
- 🔄 支持屏幕共享功能
- 🌙 支持暗色和亮色模式
- 📱 响应式设计，对移动端友好

## 技术栈

- Next.js - React 框架
- WebRTC/PeerJS - P2P 数据传输
- Cloudflare Durable Objects - 临时存储房间与信令数据
- Tailwind CSS - 前端样式
- Framer Motion - 动画效果
- OpenStreetMap & Leaflet - 开源地图解决方案

## 本地开发

1. 克隆仓库：

```bash
git clone https://github.com/ravelloh/zestsend.git
cd zestsend
```

2. 安装依赖：

```bash
npm install
```

3. 创建本地 Cloudflare 变量文件：

```bash
cp .dev.vars.example .dev.vars
```

4. 运行开发服务器：

```bash
npm run dev
```

5. 打开浏览器访问 http://localhost:3000

## 部署到 Cloudflare Workers

项目使用 OpenNext 运行 Next.js，并用 SQLite-backed Durable Objects 代替外部 Redis。`wrangler.jsonc` 已包含 `ROOM_STATE` 绑定和首次迁移，无需另外创建数据库。

```bash
npm install
npm test
npm run preview
```

本地预览通过后，登录并部署：

```bash
npx wrangler login
npm run deploy
```

首次部署会自动创建 `RoomState` Durable Object 命名空间，并发布到当前账户的 `workers.dev` 子域。

### 可选：Cloudflare TURN

不配置 TURN 时，网站仍会使用 STUN 和项目内置的备用连接方案。若要使用自己的 Cloudflare Realtime TURN 密钥，请在 Worker 设置中添加两个加密变量：

- `TURN_ID`: Cloudflare TURN Key ID
- `TURN_TOKEN`: Cloudflare TURN API Token

不要把真实密钥写进 `.dev.vars`、`.env` 或 Git 仓库。

## 使用方法

1. 访问首页，输入一个四位数字
2. 如果该四位数字未被使用，你将成为发送方
3. 告知接收方输入相同的四位数字
4. 当双方成功连接后，你们可以互相传输文件和消息，以及进行音视频通话

## 许可证

MIT

## 联系方式

如有任何问题或建议，请提交 [Issues](https://github.com/ravelloh/zestsend/issues)
