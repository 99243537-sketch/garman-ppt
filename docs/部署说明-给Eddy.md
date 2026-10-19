# 部署说明：天然矿物色 PPT 讲稿制作（网页版）

Eddy，请按下面的步骤部署。结构和文章生成服务一样：静态页面 + 本机小服务 + Nginx 反代。新服务**只用 Python 标准库**，不需要 pip 安装任何依赖。

## 包里有什么

| 目录 | 放到 | 说明 |
|---|---|---|
| `ppt/` | `/www/www.zhaodun.work/ppt/` | 静态页面：index.html、app.js、doc2ppt.browser.js |
| `ppt-planner/` | `/opt/ppt-planner/` | 分页方案服务 app.py、系统提示词 prompt.md、配置样例、systemd 文件 |

## 步骤

1. **放静态页面**
   ```
   mkdir -p /www/www.zhaodun.work/ppt && cp ppt/* /www/www.zhaodun.work/ppt/
   ```
   如果 /ppt/ 已被别的 location 占用，告诉我改路径。

2. **放服务、写配置**
   ```
   sudo mkdir -p /opt/ppt-planner && sudo cp ppt-planner/* ppt-planner/.env.example /opt/ppt-planner/
   cd /opt/ppt-planner && sudo cp .env.example .env
   ```
   编辑 `.env`：`MINIMAX_API_KEY` 填文章生成服务（/opt/article-generator/.env）里同一个 Key；`MINIMAX_MODEL` 与那边保持一致（现在是 MiniMax-M2.7）。
   ```
   sudo chown -R admin:admin /opt/ppt-planner && chmod 600 /opt/ppt-planner/.env
   ```

3. **启动服务**
   ```
   sudo cp /opt/ppt-planner/ppt-planner.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now ppt-planner
   curl -s http://127.0.0.1:8790/api/health
   ```
   应返回 `{"ok": true, "model": "MiniMax-M2.7", "daily_limit": 5, "key": true}`。端口 8790 如已被占用，改 `.env` 里的 PORT 和下面 Nginx 的端口。

4. **Nginx 反代**：在 `/etc/nginx/conf.d/zhaodun.conf` 的 server 块里，仿照 `/ai-api/` 加一段：
   ```
   location /ppt-api/ {
       proxy_pass http://127.0.0.1:8790/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_read_timeout 300s;
       client_max_body_size 4m;
   }
   ```
   然后 `sudo nginx -t && sudo systemctl reload nginx`。

5. **验证**
   - 打开 https://www.zhaodun.work/ppt/ ，上传一份短文档（几百字），选普通效果，生成并下载。
   - 再用一份几千字的 docx 试一次毛玻璃效果。大模型分页大约 1–2 分钟。
   - `journalctl -u ppt-planner -n 50` 查看日志（服务不记录文档内容）。

## 说明

- **隐私**：文档在访客浏览器里读取和生成 PPT，服务器只收到段落文字，用完即丢；`usage.db` 只记录日期、访客哈希（不存原始 IP）、字数、成功与否、耗时、token 数。
- **限流**：同一访客（IP + 浏览器 ID）每天 5 次；方案校验不通过时，页面会带着错误自动请模型修正，最多 2 次，不另外计次。
- **费用**：每次调用的 token 数记在 `usage.db` 的 note 字段，可以和文章生成服务一起统计。
- **更新**：以后代码在 GitHub 仓库 99243537-sketch/mineral-ppt 的 `web/`、`server/` 目录，更新时覆盖这两个位置的文件，然后 `sudo systemctl restart ppt-planner`。

部署完成后请告诉我：health 返回什么、实际生成是否成功、耗时多少；失败的话把页面上的错误提示和 `journalctl` 最后几行发我。
