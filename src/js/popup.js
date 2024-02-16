"use strict";

var settings;
const ratio = window.devicePixelRatio || 1;
const faviconPrefix = 'chrome://favicon/' + (ratio == 1 ? '' : `size/16@${ratio}x/`);
const $nav = {
  header: $('nav'),
  footer: $('a.nav')
};
const $main = $('main');
const $searchList = $('#search-list');
const $contextMenu = $('#context-menu');
const $dialog = $('#dialog');
const $mask = $('#mask');
const $itemForClone = $('#template > .item');
const cachedFolderInfo = {
  length: {}, // 目录中书签个数
  cols: {},
  links: {}, // 书签链接存在此处，不用渲染到dom中
  lists: {}, // 已加载的目录
}

// 搜索框
const $searchInput = $('#search-input');
// 中文拼音输入中，但未合成汉字
var inputFlag = true;
var isSearchView = false;
// 当前视图
var $curFolderList = $('#startup');
// 中间变量
var $fromTarget = null;
var pathTitle = '';
window.openFolderDelay = null;
var mainScrollTop = 0;
var cachedFolderScrollTop = 0;
// 点击的右键菜单ID，需要弹出dialog时动态改变
var curContextMenuID;

// 宽度只变大 不缩小
var curMaxCols = 1;
var curListCols = 1;
var itemHeight;

const isBookmarklet = url => url.trimStart().startsWith('javascript:')
const decodeBookmarklet = url => {
  try {
    url = decodeURI(url);
  } catch {
    // % 转义；比如css中的 width: 40%;
    // https://stackoverflow.com/questions/20700393/urierror-malformed-uri-sequence
    url = decodeURI(url.replace(/%(?![0-9A-F]{2})/gi, "%25"));
  }
  return url;
}

// 新标签页打开popup窗口 ESC不关闭页面
// 兼容Vivaldi 不能使用chrome.extension.getViews({ type: "popup" })
var isPopupWindow;
chrome.tabs.getCurrent( tab => isPopupWindow = tab === undefined );

const getCurrentTab = (callback) => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
    callback(tab);
  });
}

const dataSetting = {
  init() {
    this.layout();
    this.switchTheme();
    BM.openFolderEventType = settings.hoverEnter == 0 ? 'click' : 'mouseover';
  },
  layout() {
    if(settings.customCSS) {
      $('#customCSS').textContent = settings.customCSS;
      itemHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--height-item'));
    } else {
      itemHeight = '28'; // --height-item的默认值
    }
    if (settings.layoutCols == 1) {
      document.body.style.width = settings['bodyWidth_1'];
    }
  },
  switchTheme() {
    // 媒体查询，用户系统是否启动暗色模式
    if (settings.themeColor === 'light') return;
    if (settings.themeColor === 'dark' ||
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add("dark");
    }
  }
}

// 精确布局 避免意外的空白列
// 当 Math.ceil(length / cols) * (cols - 1) >= length 时
const preciseLayout = {
  nthChild: '',
  ele: $('#preciseLayout'),
  update(id) {
    // console.log(id);
    if (settings.layoutCols < 3 || settings.minItemsPerCol > 3) return; // 经计算，只有几组特殊解

    var expression,
      length = cachedFolderInfo.length[id],
      cols = cachedFolderInfo.cols[id];

    // 最后一列有元素
    if (Math.ceil(length / cols) * (cols - 1) < length) {
      expression = '';
    } else {
      var a = parseInt(length / cols),
          b = (length % cols + 1) * (a + 1) - 1;
      expression = `${a}n+${b}`;
    }

    this.setStyle(expression);
  },
  // @expression: an+b
  setStyle(expression) {
    if (expression == this.nthChild) return;

    // console.log('expression');
    if (!expression) {
      this.clearStyle();
    } else {
      this.ele.textContent = `
      .item:nth-child(${expression}) {
        margin-bottom: 1px;
      }`;
    }
    this.nthChild = expression;
  },
  clearStyle() {
    this.ele.textContent = '';
    this.nthChild = '';
  }
}

const nav = {
  rootID: -1,
  lastPathID: -1,
  pathHtml: '',
  toggledHtml: '',
  init(id) {
    // console.log(settings.rootInfo);
    if (id < 3) {
      $nav.header.innerHTML = `<a type="folder" data-id="${id}" data-role="path">${settings.rootInfo[id]}</a>`;
      this.rootID = id;
      this.lastPathID = id;
      // 底部其他书签（与书签栏切换使用）
      this.setFooterNav(3 - id);
    } else {
      nav.resetNavPath(id);
    }
    $('#bookmark-manager').textContent = L('bookmarksManager');
    handleFolderEvent($nav.header);
    handleFolderEvent($nav.footer);
  },
  setNavPath(id, folderName, target) {
    folderName = this.replaceEmptyString(folderName);
    // console.log(target);
    if (target && target == $nav.footer) {
      this.togglePath(id, folderName);
    } else if (target && target.getAttribute('data-role') === 'path') {
      this.removePath(target);
    } else {
      this.addPath(id, folderName);
    }
    this.lastPathID = id;
  },
  addPath(id, folderName) {
    var symbol = isSearchView ? '?' : '>';
    var html = `
    <i>${symbol}</i> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>
    `;
    $nav.header.insertAdjacentHTML('beforeend', html);
  },
  removePath(target) {
    while (target.nextElementSibling) {
      target.nextElementSibling.remove();
    }
  },
  togglePath(id, folderName) {
    var $lastPathEle = $nav.header.lastElementChild;
    $nav.footer.setAttribute('data-id', $lastPathEle.getAttribute('data-id'));
    $nav.footer.textContent = $lastPathEle.textContent;

    if (this.toggledHtml) {
      $nav.header.innerHTML = this.toggledHtml;
      this.toggledHtml = '';
    } else {
      this.toggledHtml = $nav.header.innerHTML;
      this._resetNavPath(id);
    }
  },
  resetNavPath(id) {
    this._resetNavPath(id, this.setFooterNav);
    this.lastPathID = id;
  },
  _resetNavPath(id, callback) {
    if (id < 3) {
      this.pathHtml = `<a type="folder" data-id="${id}" data-role="path">${settings.rootInfo[id]}</a>` + this.pathHtml;
      $nav.header.innerHTML = this.pathHtml;
      this.rootID = id;
      this.pathHtml = '';
      if (typeof callback === 'function') {
        callback(3 - id);
      }
    } else {
      chrome.bookmarks.get(id.toString(), (item) => {
        var folderName = this.replaceEmptyString(item[0].title);
        this.pathHtml = `
        <i>></i> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>` + this.pathHtml;
        this._resetNavPath(item[0].parentId, callback);
      })
    }
  },
  replaceEmptyString(folderName) {
    return folderName || '&emsp;';
  },
  setFooterNav(_id) {
    chrome.bookmarks.getChildren(_id.toString(), (results) => {
      if (results.length) {
        $nav.footer.setAttribute('data-id', _id);
        $nav.footer.textContent = settings.rootInfo[_id];
      } else if ($nav.footer.getAttribute('data-id')) {
        $nav.footer.removeAttribute('data-id');
        $nav.footer.textContent = '';
      }
    });
  }
}

const search = {
  init() {
    $searchInput.placeholder = L("searchPlaceholder");
    this.handleEvent();
  },
  handleEvent() {
    var UILang = chrome.i18n.getUILanguage();

    if (UILang.startsWith('zh') || settings.compositionEvent == 1) {
      // 实时搜索 兼容中文
      $searchInput.addEventListener('compositionstart', () => {
        inputFlag = false;
      }, false);
      $searchInput.addEventListener('compositionend', () => {
        inputFlag = true;
        if (event.data) {
          this.loadSearchView($searchInput.value);
        }
      }, false);
      $searchInput.addEventListener('input', event => {
        // console.log(event);
        inputFlag && this.loadSearchView($searchInput.value);
      }, false);
    } else {
      $searchInput.addEventListener('input', event => {
        this.loadSearchView($searchInput.value);
      }, false);
    }
  },
  loadSearchView(keyword) {
    if (keyword) {
      // console.log($searchInput.value);
      this._loadSearchView($searchInput.value);
      // 防止抖动
      requestIdleCallback(() => {
        !isSearchView && toggleList(null, true);
      });
    } else {
      toggleList($curFolderList.id.slice(1));
    }
  },
  _loadSearchView(keyword) {
    chrome.bookmarks.search(keyword, (results) => {
      setListSize($searchList, results.length);
      if (results.length) {
        var frag = templateFrag(results);
        $searchList.innerHTML = '';
        $searchList.append(frag);
        $searchList.firstElementChild.classList.add('active');
      } else {
        $searchList.innerHTML = '';
      }
    })
  }
}

const contextMenu = {
  posX: 0,
  posY: 0,
  showing: false,
  init() {
    $contextMenu.insertAdjacentHTML('beforeend', this.html);
    $main.addEventListener('contextmenu', this, false);
    $contextMenu.addEventListener('click', this, false);
    document.addEventListener('click', () => this.close(), false);
    $('footer').addEventListener('contextmenu', (event) => {
      event.preventDefault();
    }, false);
  },
  html: `
    <li id="bookmark-open-all">${L("openAll")}</li>
    <li id="bookmark-new-tab">${L("openInNewTab")}</li>
    <li id="bookmark-new-tab-background">${L("openInBackgroundTab")}</li>
    <li id="bookmark-new-incognito-window">${L("openInIncognitoWindow")}</li>
    <hr>
    <li id="bookmark-add-bookmark">${L("addBookmark")}</li>
    <li id="bookmark-add-folder">${L("addFolder")}</li>
    <li id="bookmark-location">${L("location")}</li>
    <hr>
    <li id="bookmark-set-as-startup">${L("setAsStartupFolder")}</li>
    <li id="bookmark-update-url">${L("updateToCurrentURL")}</li>
    <li id="bookmark-edit">${L("edit")} ...</li>
    <li id="bookmark-edit-folder">${L("rename")} ...</li>
    <li id="bookmark-delete">${L("delete")}</li>
  `,
  show() {
    $contextMenu.style.transform = `translate(${this.posX}px, ${this.posY}px)`;
    $contextMenu.classList.remove('hidden');
    this.showing = true;
    $('.item.active') && $('.item.active').classList.remove('active');
    $fromTarget && $fromTarget.closest('.item').classList.add('active');
  },
  close() {
    if (this.showing) {
      $contextMenu.classList.add('hidden');
      this.showing = false;
      $('.item.active') && $('.item.active').classList.remove('active');
      $searchInput.focus();
    }
  },
  handleEvent(event) {
    switch(event.type) {
      case "contextmenu":
        event.preventDefault();
        // console.log(event.target);
        var target = event.target;
        if(target.tagName === 'A' || target.classList.contains('folder-list')) {
          if (target.tagName === 'A') {
            $fromTarget = target;
            $contextMenu.className = $fromTarget.type;
          } else {
            $fromTarget = null;
            $contextMenu.className = 'nodata';
          }
          
          $contextMenu.type = isSearchView ? 'search' : '';
          this.posX = event.clientX;
          var mainWidth = $main.clientWidth;
          var mainHeight = $main.clientHeight;
          var menuWidth = $contextMenu.offsetWidth;
          var menuHeight = $contextMenu.offsetHeight;
          // 数值4: 右键菜单的边距
          if (this.posX + menuWidth > mainWidth - 4) {
            this.posX = mainWidth - menuWidth - 4;
          }
          this.posY = event.clientY - $main.offsetTop;
          var overflow = this.posY + menuHeight - mainHeight;
          if (overflow > 0) {
            this.posY -= (this.posY > menuHeight) ? menuHeight : overflow;
          }
          this.posY += $main.scrollTop;

          this.show();
        }
        break;
      case "click":
        event.preventDefault();
        event.stopPropagation();
        this.handleMenuItem(event.target);
        this.close();
        break;
    }
  },
  handleMenuItem(target) {
    // console.log($fromTarget);
    // console.log(target);
    var id, url;
    if ($fromTarget) {
      var id = $fromTarget.getAttribute('data-id');
      var url = cachedFolderInfo.links[id];
    }
    switch(target.id) {
      case "bookmark-new-tab":
      case "bookmark-new-tab-background": 
        chrome.tabs.create({
          url: url,
          active: target.id === "bookmark-new-tab"
        });
        break;
      case "bookmark-new-incognito-window": 
        chrome.windows.create({
          url: url,
          incognito: true
        });
        break;
      case "bookmark-update-url": 
        getCurrentTab((tab) => {
          var pageUrl = tab.url;
          var option = {
            url: pageUrl,
          }
          if (settings.updateBookmarkOpt == 2) {
            option.title = tab.title;
          }
          chrome.bookmarks.update(id, option);
        });
        break;
      case "bookmark-open-all":
        chrome.bookmarks.getChildren(id, results => {
          for (let item of results) {
            item.url && chrome.tabs.create({ url: item.url, active: false });
          }
        });
        break;
      case "bookmark-add-bookmark":
      case "bookmark-add-folder":
      case "bookmark-edit":
      case "bookmark-edit-folder":
        curContextMenuID = target.id;
        dialog.show();
        break;
      case "bookmark-location":
        var parentId = $fromTarget.getAttribute('data-parent-id');
        locationFolder(parentId, id);
        nav.resetNavPath(parentId);
        break;
      case "bookmark-set-as-startup":
        setStartupID(id);
        chrome.storage.sync.set({startup: id});
        break;
      case "bookmark-delete":
        var listId = $curFolderList.id.slice(1);
        if ($fromTarget.type === 'folder') {
          $fromTarget.closest('.item').classList.add('selected');
          // 防止hover其他元素
          $main.style.pointerEvents = 'none';
          chrome.bookmarks.getChildren(id, results => {
            if (!results.length || confirm(`[ ${$fromTarget.textContent} - ${results.length} ]:\n${L("deleteFolderConfirm")}`)) {
              chrome.bookmarks.removeTree(id);
            } else {
              $fromTarget.closest('.item').classList.remove('selected');
            }
            $main.style.pointerEvents = 'auto';
          });
        } else {
          chrome.bookmarks.remove(id);
        }
        break;
      default: break;
    }
  }
}

const dialog = {
  showing: false,
  init() {
    $dialog.insertAdjacentHTML('beforeend', this.html);
    this.$title = $('#edit-dialog-text > .title');
    this.$name = $('#edit-dialog-name');
    this.$url = $('#edit-dialog-url');
    $mask.addEventListener('click', event => this.close(event), false);
    // 光标移到末尾
    this.$name.addEventListener('focus', () => {
      var range = window.getSelection();
      range.selectAllChildren(this.$name);
      range.collapseToEnd();
    }, false);
    $('#edit-cancel').addEventListener('click', () => this.close(event), false);
    $('#edit-save').addEventListener('click', () => this.save(event), false);
  },
  title: {
    'bookmark-add-bookmark': L("addBookmark"),
    'bookmark-add-folder': L("addFolder"),
    'bookmark-edit': L("editBookmark"),
    'bookmark-edit-folder': L("editFolderName"),
  },
  html: `
    <div id="edit-dialog-text"><span class="title"></span></div>
    <div id="edit-dialog-name" class="textbox" contenteditable="true" spellcheck="false" placeholder="${L("name")}"></div>
    <div type="url" id="edit-dialog-url" class="textbox" contenteditable="true" spellcheck="false" placeholder="${L("URL")}"></div>
    <div class="dialog-btns">
      <button id="edit-save" tabindex="-1">${L("save")}</button>
      <button id="edit-cancel" tabindex="-1">${L("cancel")}</button>
    </div>
  `,
  show() {
    if (contextMenu.showing) {
      contextMenu.close();
    }
    this.$title.textContent = this.title[curContextMenuID];
    $fromTarget && $fromTarget.closest('.item').classList.add('selected');
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
        getCurrentTab((tab) => {
          this.$name.textContent = tab.title;
          this.$url.hidden = false;
          this.$url.textContent = tab.url;
        });
        break;
      case "bookmark-add-folder":
        this.$name.textContent = '';
        this.$url.hidden = true;
        break;
      case "bookmark-edit":
        this.$name.textContent = $fromTarget.textContent;
        this.$url.hidden = false;
        var id = $fromTarget.getAttribute('data-id');
        this.$url.textContent = cachedFolderInfo.links[id];
        break;
      case "bookmark-edit-folder":
        this.$name.textContent = $fromTarget.textContent;
        this.$url.hidden = true;
        break;
      default: break;
    }
    $dialog.hidden = false;
    this.showing = true;
    $mask.classList.add('mask');
    this.$name.focus();
  },
  save(event) {
    event.preventDefault();
    var id = $fromTarget ? $fromTarget.getAttribute('data-id') : undefined;
    var title = this.$name.textContent;
    var url = this.$url.hidden ? null : this.$url.textContent;
    // console.log(this.$name.textContent);
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
      case "bookmark-add-folder":
        var listId = $curFolderList.id.slice(1);
        if (!$fromTarget) {
          chrome.bookmarks.create({
            'parentId': listId,
            'title': title,
            'url': url
          });
        } else {
          chrome.bookmarks.get(id, item => {
            chrome.bookmarks.create({
              'parentId': item[0].parentId,
              'index': item[0].index + 1,
              'title': title,
              'url': url
            });
          });
        }
        break;
      case "bookmark-edit":
      case "bookmark-edit-folder":
        chrome.bookmarks.update(id, {
          title: title,
          url: url
        });
        break;
    }
    this.close(event);
  },
  close(event) {
    event.preventDefault();
    $dialog.hidden = true;
    this.showing = false;
    $mask.classList.remove('mask');
    $fromTarget && $fromTarget.closest('.item').classList.remove('selected');
    $searchInput.focus();
  },
}

function loadChildrenView(id, callback) {

  var $list = $curFolderList.cloneNode(false);
  $list.id = `_${id}`;
  cachedFolderInfo.lists[id] = $list;
  $main.insertBefore($list, $searchList);

  chrome.bookmarks.getChildren(id.toString(), (results) => {
    // console.log(results);
    renderListView($list, id, results);
    toggleList(id);
    if (typeof callback === 'function') {
      setTimeout(callback);
    }
  })
}

function renderListView($list, id, items) {
  setListSize($list, items.length, id);
  
  if (items.length) {
    $list.append(templateFrag(items));
  } else {
    $list.classList.add('show-tip');
  }
}

function templateFrag(treeData) {
  const fragment = document.createDocumentFragment();
  for (let item of treeData) {
    fragment.appendChild(templateFragItem(item));
  }
  return fragment;
}

function templateFragItem(item) {
  var clone = $itemForClone.cloneNode(true);
  var itemA = clone.lastElementChild;
  var favicon;
  var { id, title, url } = item;
  if (url) {
    if (isBookmarklet(url)) {
      favicon = 'icons/favicon/js.png';
      url = decodeBookmarklet(url);
    } else {
      favicon = faviconPrefix + url;
    }
    cachedFolderInfo.links[id] = url;
    itemA.title = `${title}\n${url}`;
  } else {
    favicon = 'icons/favicon/folder.png';
    itemA.type = 'folder';
    handleFolderEvent(clone);
  }
  clone.firstElementChild.src = favicon;
  itemA.setAttribute('data-id', id);
  itemA.textContent = title;
  isSearchView && itemA.setAttribute('data-parent-id', item.parentId);
  return clone;
}

// id 仅渲染$list时 需要传入
function setListSize($list, length, id) {
  if (settings.layoutCols == 1) return;

  var rowsCount, colsCount, listHeight;

  if ($list === $searchList) {
    // 搜索时 不改变布局列数 避免popup窗口跳动
    rowsCount = Math.ceil(length / curListCols);
  } else {
    colsCount = length > settings.layoutCols * settings.minItemsPerCol ? settings.layoutCols : Math.ceil(length / settings.minItemsPerCol);
    rowsCount = Math.ceil(length / colsCount);

    if (rowsCount < settings.minItemsPerCol && length > settings.minItemsPerCol) {
      rowsCount = settings.minItemsPerCol;
    }
  }

  listHeight = rowsCount * itemHeight;
  $list.style.height = listHeight + 'px';

  if (id) {
    cachedFolderInfo.length[id] = length;
    cachedFolderInfo.cols[id] = colsCount;
  }
}

// 应用setListSize计算的样式 除了$list.style.height（内链样式）
function applyListCols(id) {
  if (settings.layoutCols == 1) return;
  if (cachedFolderInfo.lists[id] != $curFolderList) return;

  var colsCount = cachedFolderInfo.cols[id];

  if (colsCount > curMaxCols || settings.keepMaxCols == 0) {
    document.body.style.width = settings[`bodyWidth_${colsCount > 5 ? 5 : colsCount}`];
    document.documentElement.style.setProperty('--list-cols', colsCount);
    curListCols = colsCount;
  }

  if (colsCount > curMaxCols) {
    curMaxCols = colsCount;
  }

  preciseLayout.update(id);
}

// 视图切换
function toggleList(id, searchMode = false) {
  // console.log($curFolderList);
  if (mainScrollTop || searchMode) {
    if (searchMode) {
      cachedFolderScrollTop = mainScrollTop;
    }
    $main.scrollTop = 0;
  }
  $curFolderList.hidden = true;
  // SearchView 会多次调用 单独处理
  if (searchMode) {
    $searchList.hidden = false;
    isSearchView = true;
  } else {
    var $list = cachedFolderInfo.lists[id];
    $list.hidden = false;
    $searchList.hidden = true;
    isSearchView = false;
    $curFolderList = $list;
    applyListCols(id);
    if (cachedFolderScrollTop) {
      $main.scrollTop = cachedFolderScrollTop;
      cachedFolderScrollTop = 0;
    }
  }
}

function handleMainClick(event) {
  var target = event.target;
  // console.log(target);
  if (target.type !== 'link') return;
  var id = target.getAttribute('data-id');
  openUrl(cachedFolderInfo.links[id], event);
}

function handleMainMiddleClick(event) {
  if (event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  var $fromTarget = event.target;
  // console.log($fromTarget)
  if ($fromTarget.type === 'link') {
    var id = $fromTarget.getAttribute('data-id');
    chrome.tabs.create({
      url: cachedFolderInfo.links[id],
      active: false
    });
  } else if (settings.fastCreate == 2 && $fromTarget.classList.contains('favicon')) {
    var a = $fromTarget.nextElementSibling;
    if (a.type === 'folder') {
      // console.log(target);
      getCurrentTab((tab) => {
        chrome.bookmarks.create({
          'parentId': a.getAttribute('data-id'),
          'title': tab.title,
          'url': tab.url
        });
      });
    }
  }
}

function handleSearchResultsHover(event) {
  var target = event.target;
  if (target.tagName === 'A' && target.getAttribute('data-path') !== 'done') {
    // console.log(target);
    addPathTitle(target.getAttribute('data-parent-id'), target);
  }
}

function addPathTitle(id, target) {
  if (typeof id === 'undefined') return;
  if (id < 3) {
    pathTitle = settings.rootInfo[id] + pathTitle;
    target.title += '\n\n' + '[ ' + pathTitle + ' ]';
    target.setAttribute('data-path', 'done');
    pathTitle = '';
  } else {
    chrome.bookmarks.get(id.toString(), (item) => {
      pathTitle = ' > '+ item[0].title + pathTitle;
      addPathTitle(item[0].parentId, target);
    });
  }
}

/**
 * @flag [0b]00-11
 * 高位1 在新标签打开; 0当前标签打开
 * 低位1 在前台打开; 0在后台
 */
function openUrl(url, event) {
  var flag = settings.openIn;
  if(event.ctrlKey || event.metaKey) flag ^= 0b10; 
  if(event.shiftKey) flag ^= 0b01;
  // console.log(event);
  // return
  if (isBookmarklet(url)) {
    getCurrentTab((tab) => {
      // alert(JSON.stringify(tab));
      if (!tab) {
        chrome.tabs.create({ url: url, active: true });
        return;
      }
      var pageUrl = tab.url;
      // console.log(pageUrl);
      if (!pageUrl) {
        if (pageUrl == '') {
          isPopupWindow && tab.status === 'complete' && chrome.tabs.remove(tab.id);
        }
        chrome.tabs.create({ url: url, active: true });
      } else if (/^(about|chrome|chrome-extension|https:\/\/chrome\.google\.com|edge|extension|https:\/\/microsoftedge\.microsoft\.com)/.test(pageUrl)) {
        // 官方页面 不能直接执行js
        chrome.tabs.create({ url: url, active: true });
      } else {
        chrome.tabs.executeScript({ code: url });
        isPopupWindow && window.close();
      }
    });
  } else if(flag >> 1 == 0) {
    chrome.tabs.update({ url: url });
    isPopupWindow && window.close();
  } else {
    var active = Boolean(flag & 1);
    chrome.tabs.create({ url: url, active });
    isPopupWindow && active && window.close();
  }
}

function handleFolderEvent(node) {
  if (settings.hoverEnter == 0) {
    handleFolderEvent = (node) => {
      node.addEventListener('click', openFolderEvent, false);
    }
  } else {
    handleFolderEvent = (node) => {
      node.addEventListener('mouseover', openFolderEvent, false);
      node.addEventListener('mouseout', clearOpenFolderDelay, false);
    }
  }
  handleFolderEvent(node);
}

function clearOpenFolderDelay() {
  clearTimeout(openFolderDelay);
}

function openFolderEvent(event) {
  if (contextMenu.showing || dialog.showing) return;
  var target = event.target;
  // 路径最末级不在打开文件夹
  var id = target.getAttribute('data-id');
  if (!id || id == nav.lastPathID) return;
  var folderName = target.textContent;
  // 使用快捷键时 直接打开
  var delay = event.isTrusted ? settings.hoverEnter : 0;
  window.openFolderDelay = setTimeout(openFolder, delay, id, folderName, target);
}

function openFolder(id, folderName, target) {
  // 防止在文件夹上右键时 setTimeout生效打开文件夹
  if (contextMenu.showing || dialog.showing) return;
  // 防止搜索到当前文件夹 通过Enter打开
  if (id == nav.lastPathID) return;
  // console.log(target);

  var $list = cachedFolderInfo.lists[id];

  // 从搜索结果打开目录 返回时 保持搜索视图
  var backSearchView = Boolean(target && target.nextElementSibling
    && target.nextElementSibling.textContent == '?'
    && $searchInput.value);
  
  nav.setNavPath(id, folderName, target);

  if(!$list) {
    loadChildrenView(id);
  } else {
    settings.keepMaxCols == 0 && setListSize($list, $list.childElementCount);
    if (backSearchView) {
      toggleList(null, true);
      $curFolderList = $list;
    } else {
      toggleList(id);
    }
  }
}

// 根据chrome.bookmarks.onXXX事件 来更新DOM视图
function onBookmarkEvents() {
  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      // console.log(id, bookmark);
      // @TODO chrome.bookmarks.onCreated 有BUG
      // 地址栏图标增加书签 bookmark的parentId 返回的是上次添加书签的目录
      // chrome.bookmarks.get 重新查询 问题依旧
      var { parentId, index} = bookmark;
      var $list = cachedFolderInfo.lists[parentId];

      if ($list) {
        if (index > 0) {
          var indexEle = $(`.item:nth-of-type(${index})`, $list);
          indexEle.after(templateFragItem(bookmark));
        } else {
          $list.appendChild(templateFragItem(bookmark));
        }
        
        setListSize($list, cachedFolderInfo.length[parentId] + 1, parentId);
        applyListCols(parentId);
      }
    }
  );

  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      // console.log(id, changeInfo);
      updateItem($(`.folder-list [data-id="${id}"]`), id, changeInfo);
      updateItem($(`#search-list [data-id="${id}"]`), id, changeInfo);
    }
  );

  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      // console.log(id, removeInfo);
      var parentId = removeInfo.parentId;
      var $list = cachedFolderInfo.lists[parentId];

      if ($list) {
        $(`[data-id="${id}"]`, $list).closest('.item').remove();
        setListSize($list, cachedFolderInfo.length[parentId] - 1, parentId);
        applyListCols(parentId);

        if (!$list.hasChildNodes()) {
          $list.classList.add('show-tip');
        }
      };

      if (isSearchView) {
        $(`[data-id="${id}"]`, $searchList).closest('.item').remove();
      }
    }
  );

  // dragula中处理了item移动
  // 注：如果通过书签管理器移动书签，（已打开的popup窗口）dom视图并不会更新
  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
      // console.log(id, moveInfo);
      var { oldParentId, parentId } = moveInfo;

      // debugger
      if (parentId != oldParentId) {
        var $list = cachedFolderInfo.lists[oldParentId];

        if ($list) {
          setListSize($list, cachedFolderInfo.length[oldParentId] - 1, oldParentId);
          applyListCols(oldParentId);
        }

        $list = cachedFolderInfo.lists[parentId];
        if ($list) {
          setListSize($list, cachedFolderInfo.length[parentId] + 1, parentId);
          applyListCols(parentId);
        }
      }
    }
  );

  function updateItem(itemA, id, changeInfo) {
    if (!itemA) return;

    var {title, url} = changeInfo;

    if (title) {
      itemA.textContent = title;
    }
    if (url) {
      var favicon = faviconPrefix + url;
      if (isBookmarklet(url)) {
        favicon = 'icons/favicon/js.png';
        url = decodeBookmarklet(url);
      }
      
      itemA.previousElementSibling.src = favicon;
      cachedFolderInfo.links[id] = url;
    }
    
    if (itemA.type === 'link') {
      itemA.title = title + (url ? ('\n' + url) : '');
    }
    
    isSearchView && itemA.removeAttribute('data-path');
  }
}

function locationFolder(parentId, id) {
  // console.log(event.target);
  contextMenu.close();
  if(!cachedFolderInfo.lists[parentId]) {
    loadChildrenView(parentId, () => locationToItem(id));
  } else {
    toggleList(parentId);
    locationToItem(id);
  }
  // 搜索结果定位目录时 激活来源id
  // main区域下有两个对应item，此处用$选择第一个
  function locationToItem(id) {
    var $item = $(`[data-id="${id}"]`).closest('.item');
    $item.classList.add('active');
    $item.scrollIntoView(false);
  }
}

function openStarUrl(event) {
  var starUrl = localStorage.getItem('starUrl');
  if (!starUrl) {
    starUrl = 'chrome://bookmarks/';
  }
  openUrl(starUrl, event);
}

function loadJS(url, callback) {
  var script = document.createElement('script');
  script.src = url;
  if(typeof(callback) === 'function'){
    script.onload = script.onreadystatechange = function () {
      if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete"){
        callback();
        script.onload = script.onreadystatechange = null;
      }
    };
  }
  document.body.appendChild(script);
}

function loadCSS(url) {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

function dragToMove() {
  if (typeof dragula !== 'function') {
    setTimeout(dragToMove);
    return
  }
  window.drake = dragula({
    // spilling will put the element back where it was dragged from, if this is true
    revertOnSpill: true,
    os: 'pc',
    isContainer: function (el) {
      return el.classList.contains('folder-list');
    },
    moves: function (el, container, handle) {
      return handle.classList.contains('favicon');
    }
  }).on('drop', (el, target, source, sibling, isHover) => {
    // console.log(el, target, source, sibling, isHover);
    // return
    var lastFlag = 0;
    // debugger
    var id = el.lastElementChild.getAttribute('data-id');
    if (sibling === null) {
      lastFlag = 1;
      // 此时，lastElementChild 为拖动元素本身
      sibling = source.lastElementChild.previousElementSibling;
    }
    var parentId = sibling.lastElementChild.getAttribute('data-id');
    if (isHover) {
      chrome.bookmarks.move(id, {parentId});

      var $list = cachedFolderInfo.lists[parentId];
      if ($list) {
        var item = el.cloneNode(true);
        item.classList.remove('gu-transit');
        $list.appendChild(item);
      }
    } else {
      chrome.bookmarks.get(parentId.toString(), item => {
        chrome.bookmarks.move(id, {index: item[0].index + lastFlag});
      })
    }
  });
}

function hotskeyEvents(event) {
  if (event.isComposing) return;
  
  var keyCode = event.code;
  // console.log(keyCode);

  // 优先处理dialog
  if (dialog.showing) {
    switch (keyCode) {
      case "Escape":
      case "F2":
        dialog.close(event);
        break;
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        dialog.save(event);
        break;
    }
    return;
  }

  var $list = isSearchView ? $searchList : $curFolderList;
  var $item = $('.item.active', $list);

  switch (keyCode) {
    case "Escape":
      if (!$searchInput.value) {
        event.preventDefault();
        isPopupWindow && window.close();
      }
      break;
    case "Tab":
      event.preventDefault();
      contextMenu.showing && contextMenu.close();
      $item && $item.classList.remove('active');
      var $back = $('a:nth-last-of-type(2)', $nav.header);
      $back && $back.dispatchEvent(new Event(BM.openFolderEventType, {"bubbles": true}));
      break;
    case "Space":
      if ($item) {
        event.preventDefault();
        $item.classList.remove('active');
      }
      break;
    case "Enter":
      var $itemA = $('.item.active > a', $list);
      if (!$itemA) return;
      var id = $itemA.getAttribute('data-id');
      if ($itemA.type === 'link') {
        openUrl(cachedFolderInfo.links[id], event);
      } else {
        openFolder(id, $itemA.textContent);
      }
      break;
    case "F2":
      event.preventDefault();
      $fromTarget = $('.item.active > a', $list);
      if (!$fromTarget) return;
      curContextMenuID = $fromTarget.type == 'folder' ? 'bookmark-edit-folder' : 'bookmark-edit';
      dialog.show();
      break;
    case "KeyF":
      if (!(event.ctrlKey || event.metaKey) || dialog.showing) return;
      event.preventDefault();
      contextMenu.showing && contextMenu.close();
      $searchInput.focus();
      break;
    case "KeyZ":
      if (!(event.ctrlKey || event.metaKey) || dialog.showing) return;
      clearTimeout(openFolderDelay);
      event.preventDefault();
      $nav.footer.getAttribute('data-id') && $nav.footer.dispatchEvent(new Event(BM.openFolderEventType));
      break;
    case "ArrowLeft":
    case "ArrowRight":
      if (curListCols == 1) break;
    case "Home":
    case "End":
    case "ArrowUp":
    case "ArrowDown":
      // 不阻止#search-input中的左右键
      if ($item) {
        event.preventDefault();
      }
      setActiveItem(keyCode);
      break;
    default:
      break;
  }

  function setActiveItem(keyCode) {
    var $goalItem = getGoalItem($item, keyCode, $list);
    if ($goalItem) {
      $item && $item.classList.remove('active');
      $goalItem.classList.add('active');
      $goalItem.scrollIntoViewIfNeeded();
      // firefox polyfill
      // https://stackoverflow.com/questions/11039885/scrollintoview-causing-the-whole-page-to-move
      // $goalItem.scrollIntoView({block: 'nearest', inline: 'start' });
    }
  }

  function getGoalItem($item, keyCode, $list) {
    switch (keyCode) {
      case "Home":
        return $list.firstElementChild;
      case "End":
        return $list.lastElementChild;
      case "ArrowUp":
        if ($item) {
          return $item.previousElementSibling || $list.lastElementChild;
        } else {
          return $list.lastElementChild;
        }
      case "ArrowDown":
        if ($item) {
          return $item.nextElementSibling || $list.firstElementChild;
        } else {
          return $list.firstElementChild;
        }
      case "ArrowLeft":
        if ($item) {
          var rect = $item.getBoundingClientRect();
          var $left = document.elementFromPoint(rect.x - rect.width / 2, rect.y + rect.height / 2);
          return $left ? $left.closest('.item') : null;
        } else {
          return null;
        }
      case "ArrowRight":
        if ($item) {
          var rect = $item.getBoundingClientRect();
          var $right, findHeight = rect.y + rect.height / 2;
          while (1) {
            $right = document.elementFromPoint(rect.x + rect.width / 2 * 3, findHeight);
            if ($right && $right.closest('.item')) {
              return $right.closest('.item');
            } else if ($right == $curFolderList || $right == $searchList) {
              findHeight = findHeight - rect.height;
              continue;
            } else {
              return null;
            }
          }
        } else {
          return null;
        }
      default:
        return null;
    }
  }
}

// 模拟事件 简单实现
// @keyCodeStr: 如'Ctrl + Z'，不支持多字母键（Ctrl + A + B）
function simulateKeyboardEvent(ele, type, options = {}, keyCodeStr) {
  if (!ele) return;

  var keyCode = {};

  if (keyCodeStr) {
    keyCode.ctrlKey = keyCode.metaKey = /Ctrl/i.test(keyCodeStr);
    keyCode.shiftKey = /Shift/i.test(keyCodeStr);
    keyCode.altKey = /Alt/i.test(keyCodeStr);

    var code = keyCodeStr.split('+').pop().trim();
    keyCode.code = code.length === 1 ? 'Key' + code.toUpperCase() : code;
  }

  const event = new KeyboardEvent(type, Object.assign(options, keyCode));

  ele.dispatchEvent(event);
}

function saveLastData(event) {
  // Cancel the event as stated by the standard.
  event.preventDefault();
  // Chrome requires returnValue to be set.
  event.returnValue = '';
  // startupFromLast 取最新的设置
  var curStartupFromLast = localStorage.getItem('startupFromLast');
  if (curStartupFromLast < 0) {
    localStorage.setItem('startupID', nav.lastPathID);
    if (curStartupFromLast < -1) {
      localStorage.setItem('LastScrollTop', $main.scrollTop);
    }
  }
}
/******************************************************/
$main.addEventListener('click', handleMainClick, false);
$nav.header.addEventListener('dblclick', () => {
  simulateKeyboardEvent(document, 'keydown', {}, 'Tab');
  $searchInput.focus();
}, false);
$main.addEventListener('mousedown', handleMainMiddleClick, false);
$('#star-url').addEventListener('click', openStarUrl, false);
$$('a.btn').forEach(function(a) { 
  if (!a.href) return;
  a.addEventListener('click', function(event) {
    event.preventDefault();
    openUrl(a.href, event);
  });
});


Promise.all([
    loadSettings,
    loadPreItems,
  ]).then(() => {
  // console.log(BM.settings);
  settings = BM.settings;
  dataSetting.init();

  $curFolderList.id = `_${BM.startupReal}`;
  cachedFolderInfo.lists[BM.startupReal] = $curFolderList;
  
  renderListView($curFolderList, BM.startupReal, BM.preItems);
  applyListCols(BM.startupReal);
  
  nav.init(BM.startupReal);
  
  var LastScrollTop = localStorage.getItem('LastScrollTop') || 0;
  if (LastScrollTop) $main.scrollTop = LastScrollTop;
  $main.addEventListener('scroll', function() {
    mainScrollTop = this.scrollTop;
  }, false);

  // 优化 FCP
  setTimeout(() => {
    search.init();
    contextMenu.init();
    dialog.init();
    document.addEventListener('keydown', hotskeyEvents);
    onBookmarkEvents();
    BM.settings.startup < 0 && window.addEventListener('unload', saveLastData);
    $searchList.addEventListener('mouseover', handleSearchResultsHover, false);
    $searchList.addEventListener('mouseenter', () => {
      var $activeItem = $('.item.active', $searchList);
      if ($activeItem) {
        setTimeout(() => {
          $activeItem.classList.remove('active');
        }, 200);
      }
    }, false);
    loadCSS('libs/dragula.css');
    loadJS('libs/dragula.min.js', dragToMove);
  }, 17);
});
