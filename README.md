# 数码图鉴

| 路径 | 用途 |
| --- | --- |
| [site/](site/) | 静态游戏发布目录。首页、精灵图、背景和样式都在这里。 |
| [docs/digimon-prd/](docs/digimon-prd/) | 数码宝贝版产品需求，当前为待细化的草稿。 |
| [docs/research/](docs/research/) | Poke’Catch 架构与素材调研。 |
| [netlify.toml](netlify.toml) | 从 Git 部署时将发布目录设为 `site`。 |

双击 [site/index.html](site/index.html) 可本地试玩。移动入口后，直接打开文件时浏览器可能将其视为新的存档位置。

Netlify 手动部署时选 `site/` 文件夹。通过 Git 部署时以工作区根目录为基础目录，发布目录为 `site`，构建命令留空。具体操作见 [Netlify 官方说明](https://docs.netlify.com/resources/troubleshooting/error-reference/#drag-and-drop-deploy-stuck-uploading-or-in-progress)。

目前的精灵图、背景和样式用于本地换皮验证。对外发布前应确认这些资源的再分发许可，或换用原创与获授权的素材。
