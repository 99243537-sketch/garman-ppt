# iPhone 用户「Claude 接入 GitHub」攻略

整理于 2026-10-19。全程用手机完成，约 10 分钟。目的：让 Claude 能直接往你的 GitHub 仓库提交代码、发布版本。

## 一、先在 GitHub 建一个空仓库

1. 手机浏览器打开 github.com，点头像菜单 → **Create new repository**。
2. Repository name 填仓库名（如 `garman-ppt`）；可见性先选 **Private**。
3. **Add README、.gitignore、License 都不要选**，保持空仓库。
4. 点 **Create repository**。

## 二、认准 Claude 用的是哪个账号

1. Claude App → 设置 → **账户**，看登录邮箱。用 Apple 登录的，显示的是 `…@privaterelay.appleid.com` 隐藏地址。
2. iPhone **设置 → 最上面的名字 → 通过 Apple 登录 → Claude**，看「隐藏邮件地址」。和第 1 步对得上的，就是 Claude 用的 Apple 账号。
3. 注意：
   - 「媒体与购买项目」用另一个 Apple 账号没关系，「通过 Apple 登录」只看最上面的主账号。
   - 这一页**不要点「删除」**，会断开 Claude 的登录。

## 三、用浏览器登录 Claude

手机 App 的设置里**没有**连接 GitHub 的入口，要用浏览器。

1. Safari 打开 **claude.ai**，点 **「使用 Apple 继续」**，用上一步确认的 Apple 账号登录。
2. 底部弹出的「使用 Google 账号登录」点 × 关掉，否则会进到另一个账号。
3. 登录后能看到自己以前的对话，就说明账号对了。

## 四、在 Claude 里连接 GitHub

1. 浏览器打开 **claude.ai/customize/connectors**。
2. 切到 **「我的」**，点 **GitHub 集成** → **连接**。
3. 跳到 GitHub 页面（「Claude by Anthropic wants access…」），确认账号无误，点 **Authorize**。
4. 回到连接器页，GitHub 集成的状态打勾，就是连上了。

## 五、授权具体的仓库

1. 浏览器打开 **github.com/apps/claude**，点 **Install**（或 **Configure**）。
2. 选 **Only select repositories**，在下拉框里勾上要用的仓库。不要选 All repositories。
3. 点 **Install & Authorize**。
4. GitHub 会要求再确认一次身份（sudo mode），二选一：
   - **Use GitHub Mobile**：打开手机 GitHub App，选和网页上一样的数字；
   - **Send a code via email**：收邮件验证码，填回网页。

## 六、回到对话

告诉 Claude 仓库的「用户名/仓库名」，例如 `99243537-sketch/garman-ppt`。Claude 接入成功后就能提交和发布。

## 常见问题

- **App 里找不到入口**：正常，改用浏览器打开 claude.ai。
- **Claude 说找不到仓库**：要么仓库没建成（打开 github.com/用户名/仓库名 看看），要么第五步还没勾选这个仓库。
- **要求再验证身份**：正常的安全确认，按第五步第 4 条做。
- **安全提醒**：GitHub 密码和访问令牌（token）不要发在对话里，授权都在 GitHub 自己的页面上完成。

## 参考

- [GitHub integration（Claude 官方文档）](https://claude.com/docs/connectors/github/index)
- [Using the GitHub integration（Claude 帮助中心）](https://support.claude.com/en/articles/10167454-using-the-github-integration)
