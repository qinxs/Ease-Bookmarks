<img width="64" src="docs/bookmarks.svg" align="left" />

# Ease Bookmarks

[![Source Code](https://img.shields.io/badge/Source_Code-GitHub-blue)](https://github.com/qinxs/Ease-Bookmarks)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/poefceffmekhjoadknillcbdifahongk.svg)](https://chrome.google.com/webstore/detail/ease-bookmarks/poefceffmekhjoadknillcbdifahongk)
[![Microsoft Edge Add-on](https://img.shields.io/badge/dynamic/json?label=microsoft%20edge%20add-on&prefix=v&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Faddbgeibeffkokpabpbpmdpehfbegchl)](https://microsoftedge.microsoft.com/addons/detail/ease-bookmarks/addbgeibeffkokpabpbpmdpehfbegchl)
[![Donate](https://img.shields.io/badge/Donate-blueviolet)](https://7bxing.com/donate/ "欢迎捐赠~")

> 简单易用的书签管理器

Ease Bookmarks 是一款为了替代浏览器原有书签栏的扩展

在此基础上，尽可能满足各类 书签使用习惯 用户的需求

![2-popup.png](/screenshots/2-popup.png)

## 主要功能

修改书签的默认打开方式

对书签的各种基本操作（编辑、删除、移动等）

书签多列显示

在未使用本扩展时，不占用后台

另外，本扩展对 `JS 小书签` 进行了特别支持~

> 更新日志：[ChangeLog.md](ChangeLog.md)

## 使用快捷键

### 打开/关闭 本扩展

默认快捷键是 `Ctrl + Q`，你可以在如下管理页面进行修改：
- Chrome：`chrome://extensions/shortcuts`
- Edge：`edge://extensions/shortcuts`
<!-- - Firefox：`about:addons` -> 扩展 -> 设置图标 -> 管理扩展快捷键 -->

### 功能键

- Ctrl：在 当前标签/新标签 打开页面
- Shift：是否在后台打开页面

## 自定义

- 别名（书签栏和其他书签，其他语言可能会需要）
- 自定义样式（popup 页面，DOM 结构可在 header 区域 `右键 -> 检查` 查看）

## 特别设置

不常用选项没有展现在选项页面，需通过浏览器控制台开启

如何操作：popup 页面，在 header 区域 `右键 -> 检查` 打开开发者工具，然后点击控制台

然后通过执行 BM.set(name, value) 以改变配置，如：`BM.set('fastCreate', 2)`

### `fastCreate`

> 功能：中键点击**书签图标**，快速把当前网址添加到书签

- `0`：默认值，不启用
- `2`：启用，只对文件夹有效，书签添加到该文件夹中

## 第三方库

[dragula.js](https://github.com/bevacqua/dragula)（进行了细微调整 [改动内容](https://github.com/qinxs/dragula)）

## License

[MIT](LICENSE)
