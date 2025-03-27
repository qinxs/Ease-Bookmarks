[//]: #
<div align="center">
<img width="64" src="docs/bookmarks.svg" />
<br>
<i>A Simple and Easy-to-Use Bookmarks Manager</i>
<h1>Ease Bookmarks</h1>
<a href="./README.md"><img src="https://img.shields.io/badge/🇨🇳中文简体-e9e9e9"></a>
<a href="./README_en.md"><img src="https://img.shields.io/badge/🇬🇧English-0b8cf5"></a>
<br>
<a href="https://github.com/qinxs/Ease-Bookmarks"><img src="https://img.shields.io/badge/Source_Code-GitHub-blue" alt="Source Code"></a>
<a href="https://chrome.google.com/webstore/detail/ease-bookmarks/jekbcacdnnlaajcagcmcpdjckjpjgfll"><img src="https://img.shields.io/chrome-web-store/v/jekbcacdnnlaajcagcmcpdjckjpjgfll.svg" alt="Chrome Web Store"></a>
<a href="https://chrome.google.com/webstore/detail/ease-bookmarks/poefceffmekhjoadknillcbdifahongk"><img src="https://img.shields.io/chrome-web-store/v/poefceffmekhjoadknillcbdifahongk?label=mv2" alt="mv2"></a>
<a href="https://microsoftedge.microsoft.com/addons/detail/ease-bookmarks/addbgeibeffkokpabpbpmdpehfbegchl"><img src="https://img.shields.io/badge/dynamic/json?label=microsoft%20edge%20add-on&amp;prefix=v&amp;query=%24.version&amp;url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Faddbgeibeffkokpabpbpmdpehfbegchl" alt="Microsoft Edge Add-on"></a>
<a href="https://addons.mozilla.org/firefox/addon/ease-bookmarks/"><img src="https://img.shields.io/amo/v/ease-bookmarks" alt="Firefox Add-on"></a>
<a href="https://7bxing.com/donate/" title="Donations Welcome~"><img src="https://img.shields.io/badge/Donate-blueviolet" alt="Donate"></a>
<br><br>
</div>

Ease Bookmarks is a browser extension designed to replace the native bookmarks bar.

It aims to accommodate the bookmark usage habits of various users while maintaining simplicity.

![1-popup.png](./screenshots/en/1-popup.png)

## Key Features

Modify the default opening behavior of bookmarks

Perform basic operations on bookmarks (edit, delete, move, search, etc.)

Multi-column display for bookmarks

Keyboard shortcut support

Special support for `JS bookmarklets`

> Changelog: [ChangeLog.md](ChangeLog.md)
> 
> View all screenshots: [Screenshots](./screenshots/README.md#所有截图)
>
> FAQs: [FAQ](https://github.com/qinxs/Ease-Bookmarks/wiki/常见问题（FAQ）)

## Keyboard Shortcuts

### Turn this extension on/off

The default shortcut is `Ctrl + Q`, You can modify it via:
- **Chrome**: `chrome://extensions/shortcuts`
- **Edge**: `edge://extensions/shortcuts`
- **Firefox**: `about:addons` `Settings Icon` `Manage Extension Shortcuts`

### Functional keys

- `↑`, `↓`, `←`, `→`, `Home`, `End`: select/toggle bookmarks
- `Enter`: open the selected bookmark/folder
- `Space`: cancel selection
- `F2`: edit bookmark/folder (Enter to save; Esc/F2 to cancel)
- `Tab`: go back to the previous folder
- `Ctrl + Z`: switch between "Bookmarks bar" and "Other bookmarks"
- `Ctrl + F`: activate the search box
- `Esc`: clear the search box content; close the page

### Modifier keys

- `Ctrl`: whether to open the page in the background
- `Shift`: open page in current tab/new tab

## Customize

- Aliases (bookmarks bar and other bookmarks, may be required for other languages)
- Custom style (`popup` page, DOM structure can be viewed in the header area `Right click -> Inspect`)

## Built-in Parameters

Used to switch/adjust niche features within this plugin (or the default behavior of the browser itself)

Configure at (`/options.html#configTable`)


| Parameter / Feature                                                     | Description                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodyWidth_*`         <br>Adjust popup width for multi-column layout     | Maximum effective value is 800px due to Chrome extension limits                                                                             |
| `compositionEvent`    <br>Enable composition event for search input      | - `0`: Disabled (default)               <br>- `1`: Enabled    <br>Note: Always enabled for Chinese IME                                        |
| `fastCreate`          <br>Middle-click favicon to quickly add bookmark   | - `0`: Disabled (default)               <br>- `2`: Enabled and only works for folders (add bookmarks to the folder)   <br>（more details [#15][issues-15]） |
| `faviconAPI`          <br>[ firefox only ] Favicon fetching API          | Supported placeholders: {hostname} {origin}  <br>（[ more details ][issues-firefox]）                                                       |
| `hotkeyCancelSeleted` <br>Deselect hotkey                                | - `Space`: Space key, on (default)      <br>- `-Space`: Disable    <br>Other `hotkey*` params follow same pattern (prepend - to disable key)  <br>[JavaScript Key Code][keycode]（Use the event.code value） |
| `hotkeyDelete`        <br>Delete bookmark hotkey                         | - `-Delete`: Delete key, off (default)                                                                                                       |
| `keepLastSearchValue` <br>Restore last search keywords                   | - `0`: Disabled (default)               <br>- `1`: When openning the popup window, the last search keywords and search results are restored.  |
| `keepMaxCols`         <br>Maintain maximum popup width                   | - `0`: Dynamic width                    <br>- `1`: Maintain maximum opening width (default, prevents layout jumps)                            |
| `openBookmarkAfterCurrentTab`<br>Open bookmarks after current tab        | - `0`: Disabled (default)               <br>- `1`: Enabled (only works when opened via this extension)                                        |
| `searchResultSort`    <br>Search result sorting                          | - `1`: Name ascending (default)         <br>- `0`: Native order, Same as searching in `chrome://bookmarks/`  <br>- `-1`: Name descending        |
| `updateBookmarkOpt`   <br>"Update to Current URL" menu behavior          | - `1`: Update URL only (default)        <br>- `2`: Update both URL and title                                                                  |


## Localization
*Translated in the following way, if there is any inaccuracy, please create [issue][issues-page] to point it out, thank you~*

- `chrome://bookmarks/` -> `F12`，[reference](docs/chrome_bookmarks.png)
  > Access `chrome://bookmarks/strings.m.js` for translation strings
- Chrome PAK files, path: `Chromium\94.0.4606.81\Locales`
  
  > Use `ChromePAK解包打包工具.exe` to unpack and search
- [Microsoft Translator](https://cn.bing.com/translator), and verified with other tools

## Third-Party Libraries

[dragula.js](https://github.com/bevacqua/dragula) (with minor adjustments [here](https://github.com/qinxs/dragula2))

[marked](https://github.com/markedjs/marked) (dynamic markdown rendering)

## License

[MIT](LICENSE)

[issues-page]: https://github.com/qinxs/Ease-Bookmarks/issues
[issues-15]: https://github.com/qinxs/Ease-Bookmarks/issues/15
[issues-firefox]: https://github.com/qinxs/Ease-Bookmarks/issues/42
[keycode]: https://www.toptal.com/developers/keycode
