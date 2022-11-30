"use strict";

var settings;
const $nav = {
  header: $('nav'),
  footer: $('a.nav')
};
const $main = $('main');
const $searchList = $('#search-list');
const $contextMenu = $('#context-menu');
const $dialog = $('#dialog');
const $itemForClone = $('#template > .item');
const cachedFolderInfo = {
  length: {}, // 目录中书签个数
  hasScrollbar: {},
  links: {}, // 书签链接存在此处，不用渲染到dom中
  lists: {}, // 已加载的目录
};

// 搜索框
const $seachInput = $('#search-input');
// 中文拼音输入中，但未合成汉字
var inputFlag = false;
var isSeachView = false;
// 当前视图
var $curFolderList;
// 中间变量
var $fromTarget = null;
var pathTitle = '';
window.openFolderDelay = null;
var mainScrollTop = 0;
var cachedFolderScrollTop = 0;
// 点击的右键菜单ID，需要弹出dialog时动态改变
var curContextMenuID;

var layoutCols;
// 宽度只变大 不缩小
var curMaxCols = 1;
var minItemsPerCol;
const rootStyle = document.documentElement.style;
var itemHeight;

const isBookmarklet = url => url.trim().startsWith('javascript:');
const htmlTemplate = {
  nodata: `<div class="item nodata">${L("noBookmarksTip")}<div>`,
  noresult: `<div class="item noresult">${L("seachNoResultTip")}<div>`,
}

const dataSetting = {
  init() {
    layoutCols = settings.layoutCols;
    minItemsPerCol = settings.minItemsPerCol;
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

const nav = {
  rootID: -1,
  lastPathID: -1,
  pathHtml: '',
  $bookmarkManagerText: $('#bookmark-manager span'),
  init(id) {
    // console.log(settings.rootInfo);
    if (id < 3) {
      this.setNavPath(id, settings.rootInfo[id]);
    } else {
      nav.resetNavPath(id);
    }
    handleFolderEvent([$nav.header, $nav.footer]);
    this.$bookmarkManagerText.textContent = L('bookmarksManager');
  },
  setNavPath(id, folderName, target, curIsSearchView=false) {
    folderName = this.replaceEmptyString(folderName);
    // console.log(target);
    if (id < 3 && id != this.rootID) {
      $nav.header.innerHTML = `<a type="folder" data-id="${id}" data-role="path">${folderName}</a>`;
      this.rootID = id;
      // 底部其他书签（与书签栏切换使用）
      this.setFooterNav(id);
    } else if (target && target.getAttribute('data-role') === 'path') {
      while (target.nextElementSibling) {
        target.nextElementSibling.remove();
      }
    } else {
      var symbol = curIsSearchView ? '?' : '>';
      var html = `
      <span>${symbol}</span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>
      `;
      $nav.header.insertAdjacentHTML('beforeend', html);
    }
    this.lastPathID = id;
  },
  resetNavPath(id) {
    this._resetNavPath(id);
    this.lastPathID = id;
  },
  _resetNavPath(id) {
    if (id < 3) {
      this.pathHtml = `<a type="folder" data-id="${id}" data-role="path">${settings.rootInfo[id]}</a>` + this.pathHtml;
      $nav.header.innerHTML = this.pathHtml;
      this.rootID = id;
      this.setFooterNav(id);
      this.pathHtml = '';
    } else {
      chrome.bookmarks.get(id.toString(), (item) => {
        var folderName = this.replaceEmptyString(item[0].title);
        this.pathHtml = `
        <span>></span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>` + this.pathHtml;
        this._resetNavPath(item[0].parentId);
      })
    }
  },
  replaceEmptyString(folderName) {
    return folderName || '&ensp;';
  },
  setFooterNav(id) {
    var _id = 3 - id;
    chrome.bookmarks.getChildren(_id.toString(), (results) => {
      if (results.length) {
        $nav.footer.setAttribute('data-id', _id);
        $nav.footer.textContent = settings.rootInfo[_id];
        this.$bookmarkManagerText.hidden = true;
      } else if ($nav.footer.getAttribute('data-id')) {
        $nav.footer.removeAttribute('data-id');
        $nav.footer.textContent = '';
        this.$bookmarkManagerText.hidden = false;
      }
    });
  }
}

const search = {
  init() {
    $seachInput.placeholder = L("seachPlaceholder");
    this.handleEvent();
  },
  handleEvent() {
    // 实时搜索 兼容中文
    $seachInput.addEventListener('compositionstart', () => {
      inputFlag = true;
    }, false);
    $seachInput.addEventListener('compositionend', () => {
      inputFlag = false;
      this.loadSearchView($seachInput.value);
    }, false);
    $seachInput.addEventListener('input', event => {
      // console.log(event);
      !inputFlag && this.loadSearchView($seachInput.value);
    }, false);
  },
  loadSearchView(keyword) {
    if (keyword) {
      // console.log($seachInput.value);
      this._loadSearchView($seachInput.value);
      // 防止抖动
      requestIdleCallback(() => {
        !isSeachView && toggleList(null, true);
      });
    } else {
      toggleList($curFolderList.id.replace('_', ''));
    }
  },
  _loadSearchView(keyword) {
    chrome.bookmarks.search(keyword, (results) => {
      setListSize($searchList, results.length);
      if (results.length) {
        var frag = templateFrag(results);
        $searchList.innerHTML = '';
        $searchList.append(frag);
        handleFolderEvent($$('[type=folder]', $searchList));
      } else {
        $searchList.innerHTML = htmlTemplate.noresult;
      }
    })
  }
}

const contextMenu = {
  pos: {
    left: 0,
    top:0,
  },
  showing: false,
  init() {
    $contextMenu.insertAdjacentHTML('beforeend', this.html);
    delete this.html;
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
    $contextMenu.style.transform = `translate(${this.pos.left}px, ${this.pos.top}px)`;
    $contextMenu.classList.remove('hidden');
    this.showing = true;
    $('.item.active') && $('.item.active').classList.remove('active');
    $fromTarget.closest('.item').classList.add('active');
  },
  close() {
    if (this.showing) {
      $contextMenu.classList.add('hidden');
      this.showing = false;
      $('.item.active') && $('.item.active').classList.remove('active');
    }
  },
  handleEvent(e) {
    switch(e.type) {
      case "contextmenu":
        e.preventDefault();
        if(e.target.tagName === 'A' || e.target.classList.contains('nodata')) {
          // console.log(e);
          $fromTarget = e.target;
          $contextMenu.className = $fromTarget.type || 'nodata';
          $contextMenu.type = isSeachView ? 'search' : '';
          this.pos.left = e.clientX;
          var mainWidth = $main.clientWidth;
          var mainHeight = $main.clientHeight;
          var menuWidth = $contextMenu.offsetWidth;
          var menuHeight = $contextMenu.offsetHeight;
          // 数值4: 右键菜单的边距
          if (this.pos.left + menuWidth > mainWidth - 4) {
            this.pos.left = mainWidth - menuWidth - 4;
          }
          this.pos.top = e.clientY - $main.offsetTop;
          var overflow = this.pos.top + menuHeight - mainHeight;
          if (overflow > 0) {
            this.pos.top -= (this.pos.top > menuHeight) ? menuHeight : overflow;
          }
          this.pos.top += $main.scrollTop;
          this.show();
        }
        break;
      case "click":
        event.preventDefault();
        event.stopPropagation();
        this.handleMenuItem(e.target);
        this.close();
        break;
    }
  },
  handleMenuItem(target) {
    // console.log($fromTarget);
    // console.log(target);
    var id = $fromTarget.getAttribute('data-id');
    var url = cachedFolderInfo.links[id];
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
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          var pageUrl = tabs[0].url;
          var option = {
            url: pageUrl,
          }
          if (settings.updateBookmarkOpt == 2) {
            option.title = tabs[0].title;
          }
          chrome.bookmarks.update(id, option, () => {
            cachedFolderInfo.links[id] = pageUrl;
            $fromTarget.title = $fromTarget.textContent + '\n' + pageUrl;
            $fromTarget.previousElementSibling.src = 'chrome://favicon/' + pageUrl;
            if (option.title) {
              $fromTarget.textContent = option.title;
            }
          });
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
        var listId = $curFolderList.id.replace('_', '');
        if ($fromTarget.type === 'folder') {
          $fromTarget.closest('.item').classList.add('seleted');
          // 防止hover其他元素
          $main.style.pointerEvents = 'none';
          chrome.bookmarks.getChildren(id, results => {
            if (!results.length || confirm(`[ ${$fromTarget.textContent} - ${results.length} ]:\n${L("deleteFolderConfirm")}`)) {
              chrome.bookmarks.removeTree(id, () => {
                if ($curFolderList.childElementCount === 1) {
                  $curFolderList.innerHTML = htmlTemplate.nodata;
                } else {
                  $fromTarget.closest('.item').remove();
                  setListSize($curFolderList, --cachedFolderInfo.length[listId]);
                }
              });
            } else {
              $fromTarget.closest('.item').classList.remove('seleted');
            }
            $main.style.pointerEvents = 'auto';
          });
        } else {
          chrome.bookmarks.remove(id, () => {
            if ($curFolderList.childElementCount === 1) {
              $curFolderList.innerHTML = htmlTemplate.nodata;
            } else {
              $fromTarget.closest('.item').remove();
              setListSize($curFolderList, --cachedFolderInfo.length[listId]);
            }
          });
        }
        isSeachView && updateFolderList($fromTarget.getAttribute('data-parent-id'), 'delete', {
          id: id
        });
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
    delete this.html;
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
    <div id="edit-dialog-name" class="textbox" contenteditable="true" placeholder="${L("name")}"></div>
    <div type="url" id="edit-dialog-url" class="textbox" contenteditable="true" placeholder="${L("URL")}"></div>
    <div>
      <button id="edit-save">${L("save")}</button>
      <button id="edit-cancel">${L("cancel")}</button>
    </div>
  `,
  show() {
    if (contextMenu.showing) {
      contextMenu.close();
    }
    this.$title.textContent = this.title[curContextMenuID];
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          this.$name.textContent = tabs[0].title;
          this.$url.hidden = false;
          this.$url.textContent = tabs[0].url;
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
    this.$name.focus();
  },
  save(e) {
    e.preventDefault();
    var ele = $fromTarget;
    var id = ele.getAttribute('data-id');
    var title = this.$name.textContent;
    var url = this.$url.hidden ? null : this.$url.textContent;
    // console.log(this.$name.textContent);
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
      case "bookmark-add-folder":
        var listId = $curFolderList.id.replace('_', '');
        if ($fromTarget.classList.contains('nodata')) {
          chrome.bookmarks.create({
            'parentId': listId,
            'title': title,
            'url': url
          }, results => {
            // console.log(results);
            setListSize($curFolderList, ++cachedFolderInfo.length[listId]);
            $fromTarget.closest('.item').after(templateFragItem(results));
            handleFolderEvent($$('[type=folder]', $fromTarget.closest('.item').nextElementSibling));
            $fromTarget.remove();
          });
        } else {
          chrome.bookmarks.get(id, item => {
            chrome.bookmarks.create({
              'parentId': item[0].parentId,
              'index': item[0].index + 1,
              'title': title,
              'url': url
            }, results => {
              // console.log(results);
              setListSize($curFolderList, ++cachedFolderInfo.length[listId]);
              $fromTarget.closest('.item').after(templateFragItem(results));
              handleFolderEvent($$('[type=folder]', $fromTarget.closest('.item').nextElementSibling));
            });
          });
        }
        break;
      case "bookmark-edit":
      case "bookmark-edit-folder":
        chrome.bookmarks.update(id, {
          title: title,
          url: url
        }, () => {
          ele.textContent = title;
          if ($fromTarget.type === 'link') {
            cachedFolderInfo.links[id] = url;
            ele.title = title + '\n' + url;
            if (!isBookmarklet(url)) {
              $fromTarget.previousElementSibling.src = 'chrome://favicon/' + url;
            } else {
              $fromTarget.previousElementSibling.src = 'icons/favicon/js.png';
            }
          }
          isSeachView && updateFolderList($fromTarget.getAttribute('data-parent-id'), 'edit', {
            id: id,
            title: title,
            url: url
          });
        });
        break;
    }
    $dialog.hidden = true;
    this.showing = false;
  },
  close(e) {
    e.preventDefault();
    $dialog.hidden = true;
    this.showing = false;
  },
}

function loadChildrenView(id, isStartup = false, callback) {
  chrome.bookmarks.getChildren(id.toString(), (results) => {
    // console.log(results);
    renderListView(id, results, isStartup);
    if (isStartup) {
      $curFolderList = $(`#_${id}`);
    } else {
      toggleList(id);
    }
    if (typeof callback === 'function') {
      setTimeout(callback);
    }
  })
}

function renderListView(id, items, isStartup = false) {
  $searchList.insertAdjacentHTML('beforebegin', `<div class="folder-list" id=_${id}></div>`);
  var $list = $(`#_${id}`);
  setListSize($list, items.length, id);
  cachedFolderInfo.lists[id] = $list;
  if (items.length) {
    if (isStartup) {
      // 启动时延后渲染 避免长任务
      setTimeout(applyFrag);
    } else {
      applyFrag();
    }
  } else {
    $list.insertAdjacentHTML('afterbegin', htmlTemplate.nodata);
  }
  function applyFrag() {
    var frag = templateFrag(items);
    $list.append(frag);
    handleFolderEvent($$('[type=folder]', $list));
  }
}

function templateFrag(treeData) {
  const fragment = document.createDocumentFragment();
  for (let item of treeData) {
    fragment.append(templateFragItem(item));
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
      favicon = `chrome://favicon/${url}`;
    }
    cachedFolderInfo.links[id] = url;
    itemA.title = `${title}\n${url}`;
  } else {
    favicon = 'icons/favicon/folder.png';
    itemA.type = 'folder';
  }
  clone.firstElementChild.src = favicon;
  itemA.setAttribute('data-id', id);
  itemA.textContent = title;
  isSeachView && itemA.setAttribute('data-parent-id', item.parentId);
  return clone;
}

function decodeBookmarklet(url) {
  try {
    url = decodeURI(url);
  } catch {
    // % 转义；比如css中的 width: 40%;
    // https://stackoverflow.com/questions/20700393/urierror-malformed-uri-sequence
    url = decodeURI(url.replace(/%(?![0-9A-F]{2})/gi, "%25"));
  }
  return url;
}

// id 仅渲染$list时 需要传入
function setListSize($list, _length, id) {
  var rowsCount, colsCount;
  var length = _length || 1;
  if (layoutCols === 1) {
    rowsCount = length;
  } else {
    if ($list === $searchList) {
      rowsCount = Math.ceil(length / curMaxCols);
    } else {
      colsCount = length > layoutCols * minItemsPerCol ? layoutCols : Math.ceil(length / minItemsPerCol);
      rowsCount = Math.ceil(length / colsCount);

      if (colsCount != curMaxCols && (colsCount > curMaxCols || !settings.keepMaxCols)) {
        document.body.style.width = BM.bodyWidth[colsCount];
        rootStyle.setProperty('--width-item', parseInt(100 / colsCount) + "%");
        curMaxCols = colsCount;
      }
      if (rowsCount < minItemsPerCol && length > minItemsPerCol) {
        rowsCount = minItemsPerCol;
      }
    }
    // data-rows 供左右快捷键使用
    $list.setAttribute('data-rows', rowsCount);
  }
  var listHeight = rowsCount * itemHeight;
  $list.style.height = listHeight + 'px';
  if (id) {
    cachedFolderInfo.length[id] = _length;
    // 504 main最大高度
    cachedFolderInfo.hasScrollbar[id] = listHeight > 504;
  }
}

// 视图切换
function toggleList(id, searchMode = false) {
  // console.log($curFolderList);
  if (mainScrollTop && (cachedFolderInfo.hasScrollbar[id] || searchMode)) {
    if (searchMode) {
      cachedFolderScrollTop = mainScrollTop;
    }
    $main.scrollTop = 0;
  }
  $curFolderList.hidden = true;
  // SeachView 会多次调用 单独处理
  if (searchMode) {
    $searchList.hidden = false;
    isSeachView = true;
  } else {
    var $list = cachedFolderInfo.lists[id];
    $list.hidden = false;
    $searchList.hidden = true;
    isSeachView = false;
    $curFolderList = $list;
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
  } else if (settings.fastCreate === 2 && $fromTarget.classList.contains('favicon')) {
    var a = $fromTarget.nextElementSibling;
    if (a.type === 'folder') {
      // console.log(target);
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.bookmarks.create({
          'parentId': a.getAttribute('data-id'),
          'title': tabs[0].title,
          'url': tabs[0].url
        }, results => {
          updateFolderList(a.getAttribute('data-id'), 'add');
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
  if(event.metaKey || event.ctrlKey) flag ^= 0b10; 
  if(event.shiftKey) flag ^= 0b01;
  // console.log(event);
  // return
  if (isBookmarklet(url)) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      var pageUrl = tabs[0].url;
      // console.log(pageUrl);
      // 官方页面 不能直接执行js
      if (/^(about|chrome|chrome-extension|https:\/\/chrome\.google\.com|edge|extension|https:\/\/microsoftedge\.microsoft\.com)/.test(pageUrl) || !pageUrl) {
        !pageUrl && chrome.tabs.remove(tabs[0].id);
        chrome.tabs.create({ url: url, active: true });
      } else { 
        chrome.tabs.executeScript({ code: url });
      }
    });
  } else if(flag >> 1 == 0) {
    chrome.tabs.update({ url: url });
    window.close();
  } else {
    var active = Boolean(flag & 1);
    chrome.tabs.create({ url: url, active });
  }
}

function handleFolderEvent(nodelist) {
  for (var ele of nodelist) {
    if (settings.hoverEnter == 0) {
      ele.addEventListener('click', openFolderEvent, false);
    } else {
      ele.addEventListener('mouseover', openFolderEvent, false);
      ele.addEventListener('mouseout', clearOpenFolderDelay, false);
    }
  }
}

function clearOpenFolderDelay() {
  clearTimeout(openFolderDelay);
}

function openFolderEvent(event) {
  if (contextMenu.showing || dialog.showing) return;
  var target = event.target;
  // 路径最末级不在打开文件夹
  var id = parseInt(target.getAttribute('data-id'));
  if (id == nav.lastPathID) return;
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
  var curIsSearchView = isSeachView;
  var $list = cachedFolderInfo.lists[id];
  if(!$list) {
    loadChildrenView(id);
  } else {
    !settings.keepMaxCols && setListSize($list, $list.childElementCount);
    toggleList(id);
  }
  nav.setNavPath(id, folderName, target, curIsSearchView);
}

/**
 * 清除已存在的list，保持数据一致
 * @param  {[type]} id   folder-list ID
 * @param  {[type]} type 书签操作类型：add、edit、delete
 * @param  {Object} data edit 数据
 */
function updateFolderList(id, type, data = {}) {
  var $list = cachedFolderInfo.lists[id];
  if (!$list) return;

  if (type === 'add') {
    $list.remove();
    delete cachedFolderInfo.lists[id];
  } else if (type === 'delete') {
    if ($list.childElementCount === 1) {
      $list.innerHTML = htmlTemplate.nodata;
    } else {
      $(`[data-id="${data.id}"]`, $list).closest('.item').remove();
    }
  } else {
    var a = $(`[data-id="${data.id}"]`, $list);
    if (data.url) {
      var url = data.url;
      var favicon = `chrome://favicon/${url}`;
      if (isBookmarklet(url)) {
        favicon = 'icons/favicon/js.png';
        url = decodeBookmarklet(url);
      }
      a.textContent = data.title;
      cachedFolderInfo.links[id] = url;
      a.previousElementSibling.src = favicon;
    } else if (data.title) {
      a.textContent = data.title;
    }
  }
}

function locationFolder(parentId, id) {
  // console.log(event.target);
  contextMenu.close();
  if(!cachedFolderInfo.lists[parentId]) {
    loadChildrenView(parentId, false, () => locationToItem(id));
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

function openBookmarkManagerUrl(event) {
  const {bookmarksManagerUrl} = chrome.extension.getBackgroundPage();
  openUrl(bookmarksManagerUrl, event);
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
    var id_sibling = sibling.lastElementChild.getAttribute('data-id');
    if (isHover) {
      chrome.bookmarks.move(id, {parentId: id_sibling});
      updateFolderList(id_sibling, 'add');
    } else {
      chrome.bookmarks.get(id_sibling.toString(), item => {
        chrome.bookmarks.move(id, {index: item[0].index + lastFlag});
      })
    }
  });
}

function hotskeyEvents(event) {
  var keyCode = event.code;

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

  var $list = isSeachView ? $searchList : $curFolderList;
  var $item = $('.item.active', $list);

  switch (keyCode) {
    case "Escape":
      if (!$seachInput.value) {
        event.preventDefault();
        window.close()
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
      $fromTarget = $('.item.active > a', $list);
      if (!$fromTarget) return;
      curContextMenuID = $fromTarget.type == 'folder' ? 'bookmark-edit-folder' : 'bookmark-edit';
      dialog.show();
      break;
    case "KeyF":
      if (!event.ctrlKey || dialog.showing) return;
      event.preventDefault();
      contextMenu.showing && contextMenu.close();
      $seachInput.focus();
      break;
    case "KeyZ":
      if (!event.ctrlKey || dialog.showing) return;
      clearTimeout(openFolderDelay);
      event.preventDefault();
      $nav.footer.getAttribute('data-id') && $nav.footer.dispatchEvent(new Event(BM.openFolderEventType));
      break;
    case "ArrowLeft":
    case "ArrowRight":
      if (layoutCols === 1) break;
    case "Home":
    case "End":
    case "ArrowUp":
    case "ArrowDown":
      event.preventDefault();
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
    var rows = $list.getAttribute('data-rows');
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
        var $prev = $item;
        while (rows-- && $prev) {
          $prev = $prev.previousElementSibling;
        }
        return $prev;
      case "ArrowRight":
        var $next = $item;
        while (rows-- && $next) {
          $next = $next.nextElementSibling;
        }
        return $next;
      default:
        return null;
    }
  }
}

function setLastData(event) {
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
$main.addEventListener('mousedown', handleMainMiddleClick, false);
$('#bookmark-manager').addEventListener('click', openBookmarkManagerUrl, false);

Promise.all([
  loadSettings,
  loadPreItems,
  ]).then(() => {
  // console.log(BM.settings);
  settings = BM.settings;
  dataSetting.init();

  var startupReal = BM.startupReal;
  renderListView(startupReal, BM.preItems, true);
  BM.preItems = 'done';
  $curFolderList = $(`#_${startupReal}`);
  
  nav.init(startupReal);
  
  setTimeout(() => {
    $main.addEventListener('scroll', function() {
      mainScrollTop = this.scrollTop;
    }, false);
    var LastScrollTop = localStorage.getItem('LastScrollTop') || 0;
    if (LastScrollTop) $main.scrollTop = LastScrollTop;
  }, 17);

  // 优化 FCP
  setTimeout(() => {
    search.init();
    contextMenu.init();
    dialog.init();
    window.addEventListener('keydown', hotskeyEvents);
    BM.settings.startup < 0 && window.addEventListener('unload', setLastData);
    $searchList.addEventListener('mouseover', handleSearchResultsHover, false);
    loadCSS('libs/dragula.css');
    loadJS('libs/dragula.min.js', dragToMove);
  }, 60)
});
