[//]: #
<div align="center">
<img width="64" src="docs/bookmarks.svg" />
<br>
<i>简 单 易 用 的 书 签 管 理 器</i>
<h1>Ease Bookmarks</h1>
<a href="./README.md"><img src="https://img.shields.io/badge/🇨🇳中文简体-0b8cf5"></a>
<a href="./README_en.md"><img src="https://img.shields.io/badge/🇬🇧English-e9e9e9"></a>
<br>
<a href="https://github.com/qinxs/Ease-Bookmarks"><img src="https://img.shields.io/badge/Source_Code-GitHub-blue" alt="Source Code"></a>
<a href="https://chrome.google.com/webstore/detail/ease-bookmarks/jekbcacdnnlaajcagcmcpdjckjpjgfll"><img src="https://img.shields.io/chrome-web-store/v/jekbcacdnnlaajcagcmcpdjckjpjgfll.svg" alt="Chrome Web Store"></a>
<a href="https://chrome.google.com/webstore/detail/ease-bookmarks/poefceffmekhjoadknillcbdifahongk"><img src="https://img.shields.io/chrome-web-store/v/poefceffmekhjoadknillcbdifahongk?label=mv2" alt="mv2"></a>
<a href="https://microsoftedge.microsoft.com/addons/detail/ease-bookmarks/addbgeibeffkokpabpbpmdpehfbegchl"><img src="https://img.shields.io/badge/dynamic/json?label=microsoft%20edge%20add-on&amp;prefix=v&amp;query=%24.version&amp;url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Faddbgeibeffkokpabpbpmdpehfbegchl" alt="Microsoft Edge Add-on"></a>
<a href="https://addons.mozilla.org/firefox/addon/ease-bookmarks/"><img src="https://img.shields.io/amo/v/ease-bookmarks" alt="Firefox Add-on"></a>
<a href="https://7bxing.com/donate/" title="欢迎捐赠~"><img src="https://img.shields.io/badge/Donate-blueviolet" alt="Donate"></a>
<br><br>
</div>

Ease Bookmarks 是一款为了替代浏览器原有书签栏的扩展

在此基础上，尽可能适应不同用户的书签使用习惯，同时保持简单性

![1-popup.png](./screenshots/1-popup.png)

## 主要功能

修改书签的默认打开方式

对书签的各种基本操作（编辑、删除、移动、搜索等）

书签多列显示

快捷键支持

另外，本扩展对 `JS 小书签` 进行了特别支持~

> 更新日志：[ChangeLog.md](ChangeLog.md)
> 
> 查看所有截图：[Screenshots](./screenshots/README.md#所有截图)
>
> 常见问题：[FAQ](https://github.com/qinxs/Ease-Bookmarks/wiki/常见问题（FAQ）)

## 快捷键

### 打开/关闭 本扩展

默认快捷键是 `Ctrl + Q`，你可以在如下管理页面进行修改：
- **Chrome**：`chrome://extensions/shortcuts`
- **Edge**：`edge://extensions/shortcuts`
- **Firefox**：`about:addons` `设置图标` `管理扩展快捷键`

### 功能键

- `↑`、`↓`、`←`、`→`、`Home`、`End`：选择/切换 书签
- `Enter`：打开选中的 书签/目录
- `Space`：取消选中
- `F2`：编辑 书签/目录（`Enter` 保存；`Esc`、`F2` 取消）
- `Tab`：返回上一级目录
- `Ctrl + Z`：切换到 书签栏/其他书签
- `Ctrl + F`：激活搜索框
- `Esc`：清除搜索框内容；关闭页面

### 修饰键

- `Ctrl`：是否在后台打开页面
- `Shift`：在 当前标签/新标签 打开页面

## 自定义

- 别名（书签栏和其他书签，其他语言可能会需要）
- 自定义样式（popup 页面，DOM 结构可在 header 区域 `右键 -> 检查` 查看）

## 内置参数

用于 开关/修改 本插件内的小众功能（或者浏览器本身的默认行为）

在该页面（`/options.html#configTable`）修改


| 字段 / 功能                                                          | 说明                                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bodyWidth_*`         <br>修改多列布局时的popup窗口宽度                | 由于Chrome对扩展的限制，最大有效值为800px                                                                                 |
| `compositionEvent`    <br>是否开启搜索输入合成事件                     | - `0`：不启用（默认）         <br>- `1`：启用   <br>注：中文输入法强制开启                                                   |
| `fastCreate`          <br>中键点击书签favicon图标快速添加书签          | - `0`：禁用（默认）           <br>- `2`：启用且仅对文件夹有效（将书签添加到该文件夹）  <br>（详见 [#15][issues-15]）            |
| `faviconAPI`          <br>[ firefox only ] 获取 favicon 图标 API      | 支持的占位符 {hostname} {origin}  <br>（[ 详细用法 ][issues-firefox]）                                                        |
| `hotkeyCancelSeleted` <br>取消选择快捷键                              | - `Space`：空格键，开启（默认）   <br>- `-Space`：关闭   <br>其他`hotkey*`快捷键同理（键值前加`-`表示关闭）  <br>[快捷键键值查询][keycode]（使用event.code值） |
| `hotkeyDelete`        <br>删除书签快捷键                              | - `-Delete`：删除键，关闭（默认）                                                                                         |
| `keepLastSearchValue` <br>恢复上次搜索关键字                          | - `0`：不恢复（默认）          <br>- `1`：打开 popup 窗口时，恢复上次的搜索关键字和搜索结果                                    |
| `keepMaxCols`         <br>页面保持最大宽度                            | - `0`：页面宽度随内容变化      <br>- `1`：保持最大打开宽度（默认，避免切换文件夹时页面跳动）                                    |
| `openBookmarkAfterCurrentTab`<br>在当前标签页右侧打开书签              | - `0`：禁用（默认）           <br>- `1`：启用（仅通过本扩展打开时有效）                                                       |
| `searchResultSort`    <br>搜索结果排序                                | - `1`：按名称升序（默认）      <br>- `0`：不改变，与 `chrome://bookmarks/` 页面搜索一致  <br>- `-1`：按名称降序                  |
| `updateBookmarkOpt`   <br>菜单「更新为当前网址」的更新选项              | - `1`：仅更新URL（默认）      <br>- `2`：同时更新URL和标题                                                                  |


## 翻译
*通过以下方式翻译，如有不当，请提 [issue][issues-page] 指明，感谢~*

- `chrome://bookmarks/` -> `F12`，[参考](docs/chrome_bookmarks.png)
  > `chrome://bookmarks/strings.m.js` 获得翻译字符串
- Chrome 的 pak 文件，路径`Chromium\94.0.4606.81\Locales`
  
  > 使用 `ChromePAK解包打包工具.exe` 解包搜索对比
- [Microsoft Translator](https://cn.bing.com/translator)，并用其他翻译验证

## 第三方库

[dragula.js](https://github.com/bevacqua/dragula)（进行了细微调整 [改动内容](https://github.com/qinxs/dragula2)）

[marked](https://github.com/markedjs/marked)（动态渲染 markdown 文件）

## License

[MIT](LICENSE)

[issues-page]: https://github.com/qinxs/Ease-Bookmarks/issues
[issues-15]: https://github.com/qinxs/Ease-Bookmarks/issues/15
[issues-firefox]: https://github.com/qinxs/Ease-Bookmarks/issues/42
[keycode]: https://www.toptal.com/developers/keycode
