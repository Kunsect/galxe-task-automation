# Galxe Task Automation

后面已完成如下功能，后续会加入更多交互：

- EVM 地址登录
- 创建 GalxeID 账号
- 绑定邮箱：1secmail
- 绑定 Taproot 地址
- 完成任务
- 章节奖励领取
- Geetest 自动验证：capsolver

### 支持任务

- 校验任务
- 提交答案任务

### 支持奖励

- 积分

### 感谢关注: [@Kunsect](https://x.com/kunsect7)

## 运行

复制 `.env.example` 改名为 `.env`，填写相关配置参数，运行过程会遍历助记词对应的派生地址，然后逐步完成任务。
切换任务只需要修改 `index.ts` 对应的 `startCampaigns - body id` 即可。

```bash
npm i
npm run start
```
