"use strict";

var settings;
const $nav = {
  header: $('nav'),
  footer: $('.nav > a')
};
const $main = $('main');
const $searchList = $('#search-list');
const $contextMenu = $('#context-menu');
const $dialog = $('#dialog');
const folderListLength = {};
const containers = [];
Array.prototype.remove = function(val) {  
  var index = this.indexOf(val);  
  if (index > -1) {  
    this.splice(index, 1);  
  }  
};

// 搜索框
const $seachInput = $('#search-input');
// 中文拼音输入中，但未合成汉字
var inputFlag = false;
var isSeachView = false;
// 上一个视图
var $lastListView;
// 中间变量
var $fromTarget = null;
var pathTitle = '';
window.openFolderDelay = null;
// 点击的右键菜单ID，需要弹出dialog时动态改变
var curContextMenuID;

var layoutCols;
// 宽度只变大 不缩小
var curMaxCols = 1;
var minItemsPerCol;
const rootStyle = document.documentElement.style;

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
    if(settings.customCSS) $('#customCSS').textContent = settings.customCSS;
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
  init(id) {
    // console.log(settings.rootInfo);
    this.setNavPath(id, settings.rootInfo[id]);
    handleFolderEvent($$('.nav > [type=folder]'));
  },
  setNavPath(id, folderName, target) {
    folderName = this.replaceEmptyString(folderName);
    // console.log(target);
    if (id < 3 && id != this.rootID) {
      $nav.header.innerHTML = `<a type="folder" data-id="${id}" data-role="path">${folderName}</a>`;
      this.rootID = id;
      // 底部其他书签（与书签栏切换使用）
      this.setFooterNav(id);
    } else if (target && target.dataset.role === 'path') {
      while (target.nextElementSibling) {
        target.nextElementSibling.remove();
      }
    } else {
      var symbol = isSeachView ? '?' : '>';
      var html = `
      <span>${symbol}</span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>
      `;
      $nav.header.insertAdjacentHTML('beforeend', html);
      handleFolderEvent($$('nav > [type=folder]'));
    }
  },
  resetNavPath(id) {
    if (id < 3) {
      this.pathHtml = `<a type="folder" data-id="${id}" data-role="path">${settings.rootInfo[id]}</a>` + this.pathHtml;
      $nav.header.innerHTML = this.pathHtml;
      handleFolderEvent($$('nav > [type=folder]'));
      this.rootID = id;
      this.setFooterNav(id);
      this.pathHtml = '';
    } else {
      chrome.bookmarks.get(id.toString(), (item) => {
        var folderName = this.replaceEmptyString(item[0].title);
        this.pathHtml = `
        <span>></span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>` + this.pathHtml;
        this.resetNavPath(item[0].parentId);
      })
    }
  },
  replaceEmptyString(folderName) {
    return folderName ? folderName : ' ';
  },
  setFooterNav(id) {
    var _id = 3 - id;
    chrome.bookmarks.getChildren(_id.toString(), (results) => {
      if (results.length) {
        $nav.footer.dataset.id = _id;
        $nav.footer.textContent = settings.rootInfo[_id];
      } else if ($nav.footer.dataset.id) {
        delete $nav.footer.dataset.id;
        $nav.footer.textContent = '';
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
      toggleList($lastListView.id.replace('_', ''));
    }
  },
  _loadSearchView(keyword) {
    chrome.bookmarks.search(keyword, (results) => {
      var html;
      if (results.length) {
        html = template(results);
      } else {
        html = htmlTemplate.noresult;
      }
      setListSize($searchList, results.length);
      $searchList.innerHTML = html;
      handleFolderEvent($$('[type=folder]', $searchList));
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
    $contextMenu.style.left = this.pos.left + 'px';
    $contextMenu.style.top = this.pos.top + 'px';
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
        if(e.target.nodeName === 'A' || e.target.classList.contains('nodata')) {
          // console.log(e);
          // console.log(this);
          $fromTarget = e.target;
          $contextMenu.className = $fromTarget.type || 'nodata';
          $contextMenu.type = isSeachView ? 'search' : '';
          this.pos.left = e.clientX;
          // 数值6: 右键菜单的边距
          if (this.pos.left + $contextMenu.clientWidth > $main.clientWidth - 6) {
            this.pos.left = $main.clientWidth - $contextMenu.clientWidth - 6;
          }
          this.pos.top = e.clientY - $main.offsetTop;
          if (this.pos.top + $contextMenu.clientHeight > $main.clientHeight) {
            this.pos.top -= $contextMenu.clientHeight;
          }
          this.pos.top += $main.scrollTop;
          this.show();
        }
        break;
      case "click":
        this.handleMenuItem(e.target)
        break;
    }
  },
  handleMenuItem(target) {
    // console.log($fromTarget);
    // console.log(target);
    var id = $fromTarget.dataset.id;
    var url = $fromTarget.dataset.url;
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
          chrome.bookmarks.update(id, {url: pageUrl}, () => {
            $fromTarget.dataset.url = pageUrl;
            $fromTarget.title = $fromTarget.textContent + '\n' + pageUrl;
            $fromTarget.previousElementSibling.src = 'chrome://favicon/' + pageUrl;
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
        // console.log($fromTarget);
        var parentId = $fromTarget.dataset.parentId;
        locationFolder(parentId, id);
        nav.resetNavPath(parentId);
        break;
      case "bookmark-set-as-startup":
        // console.log($fromTarget);
        setStartupLocal(null, id);
        chrome.storage.sync.set({startup: id}, () => {});
        break;
      case "bookmark-delete":
        var listId = $lastListView.id.replace('_', '');
        if ($fromTarget.type === 'folder') {
          $fromTarget.closest('.item').classList.add('seleted');
          // 防止hover其他元素
          $main.style.pointerEvents = 'none';
          chrome.bookmarks.getChildren(id, results => {
            if (!results.length || confirm(`[ ${$fromTarget.textContent} - ${results.length} ]:\n${L("deleteFolderConfirm")}`)) {
              chrome.bookmarks.removeTree(id, () => {
                if ($lastListView.childElementCount === 1) {
                  $lastListView.innerHTML = htmlTemplate.nodata;
                } else {
                  $fromTarget.closest('.item').remove();
                  setListSize($lastListView, --folderListLength[listId]);
                }
              });
            } else {
              $fromTarget.closest('.item').classList.remove('seleted');
            }
            $main.style.pointerEvents = 'auto';
          });
        } else {
          chrome.bookmarks.remove(id, () => {
            if ($lastListView.childElementCount === 1) {
              $lastListView.innerHTML = htmlTemplate.nodata;
            } else {
              $fromTarget.closest('.item').remove();
              setListSize($lastListView, --folderListLength[listId]);
            }
          });
        }
        isSeachView && updateFolderList($fromTarget.dataset.parentId, 'delete', {
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
    this.$name = $('#edit-dialog-name');
    this.$url = $('#edit-dialog-url');
    delete this.html;
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
    <div id="edit-dialog-text" class="title"></div>
    <input id="edit-dialog-name" placeholder="${L("name")}">
    <textarea type="url" id="edit-dialog-url" placeholder="${L("URL")}"></textarea>
    <div>
      <button id="edit-save">${L("save")}</button>
      <button id="edit-cancel">${L("cancel")}</button>
    </div>
  `,
  show() {
    $('#edit-dialog-text').textContent = this.title[curContextMenuID];
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          this.$name.value = tabs[0].title;
          this.$url.hidden = false;
          this.$url.value = tabs[0].url;
        });
        break;
      case "bookmark-add-folder":
        this.$name.value = '';
        this.$url.hidden = true;
        break;
      case "bookmark-edit":
        this.$name.value = $fromTarget.textContent;
        this.$url.hidden = false;
        this.$url.value = $fromTarget.dataset.url;
        break;
      case "bookmark-edit-folder":
        this.$name.value = $fromTarget.textContent;
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
    var id = ele.dataset.id;
    var title = this.$name.value;
    var url = this.$url.hidden ? null : this.$url.value;
    // console.log(this.$name.value);
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
      case "bookmark-add-folder":
        var listId = $lastListView.id.replace('_', '');
        if ($fromTarget.classList.contains('nodata')) {
          chrome.bookmarks.create({
            'parentId': listId,
            'title': title,
            'url': url
          }, results => {
            // console.log(results);
            setListSize($lastListView, ++folderListLength[listId]);
            $fromTarget.closest('.item').insertAdjacentHTML('afterend', templateItem(results));
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
              setListSize($lastListView, ++folderListLength[listId]);
              $fromTarget.closest('.item').insertAdjacentHTML('afterend', templateItem(results));
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
            ele.dataset.url = url;
            ele.title = title + '\n' + url;
            if (!isBookmarklet(url)) {
              $fromTarget.previousElementSibling.src = 'chrome://favicon/' + url;
            } else {
              $fromTarget.previousElementSibling.src = 'icons/favicon/js.png';
            }
          }
          isSeachView && updateFolderList($fromTarget.dataset.parentId, 'edit', {
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
    renderListView(id, results);
    if (isStartup) {
      $lastListView = $(`#_${id}`);
    } else {
      toggleList(id);
    }
    if (typeof callback === 'function') {
      setTimeout(callback);
    }
  })
}

function renderListView(id, items) {
  $searchList.insertAdjacentHTML('beforebegin', `<div class="folder-list" id=_${id}></div>`);
  var $list = $(`#_${id}`);
  setListSize($list, items.length, id);
  containers.push($list);
  // 避免长任务
  setTimeout(() => {
    var html;
    if (items.length) {
      html = template(items);
    } else {
      html = htmlTemplate.nodata;
    }
    $list.insertAdjacentHTML('afterbegin', html);
    handleFolderEvent($$('[type=folder]', $list));
  });
}

function template(treeData) {
  var insertHtml = '';
  for (let ele of treeData) {
    insertHtml += templateItem(ele);
  };
  return insertHtml;
}

function templateItem(ele) {
  var favicon;
  var url = ele.url;
  var attributeStr;
  if (typeof url === 'undefined') {
    favicon = 'icons/favicon/folder.png';
    attributeStr = `type="folder"`;
  } else if (isBookmarklet(url)) {
    favicon = 'icons/favicon/js.png';
    url = decodeBookmarklet(url);
    attributeStr = `type="link" data-url="${url}" title="${ele.title}&#10;${url}"`;
  } else {
    favicon = `chrome://favicon/${url}`;
    attributeStr = `type="link" data-url="${url}" title="${ele.title}&#10;${url}"`;
  }
  if (isSeachView) attributeStr = `data-parent-id="${ele.parentId}"` + attributeStr;
  return `
    <div class="item">
    <img class="favicon" src="${favicon}" alt=""></img>
    <a data-id="${ele.id}" ${attributeStr}>${ele.title}</a>
    </div>
  `;
}

function decodeBookmarklet(url) {
  try {
    url = decodeURI(url);
  } catch {
    // % 转义；比如css中的 width: 40%;
    // https://stackoverflow.com/questions/20700393/urierror-malformed-uri-sequence
    url = decodeURI(url.replace(/%(?![0-9A-F]{2})/gi, "%25"));
  }
  return url.replaceAll("\"", "&quot;");
}

function setListSize($list, length, id) {
  var rowsCount, colsCount;
  if (id) folderListLength[id] = length;
  length = length || 1;
  if (layoutCols === 1) {
    rowsCount = length;
  } else {
    if ($list === $searchList) {
      rowsCount = Math.ceil(length / curMaxCols);
    } else {
      colsCount = length > layoutCols * minItemsPerCol ? layoutCols : Math.ceil(length / minItemsPerCol);
      rowsCount = Math.ceil(length / colsCount);

      if (colsCount > curMaxCols || !settings.keepMaxCols) {
        curMaxCols = colsCount;
        document.body.style.width = BM.bodyWidth[curMaxCols];
        rootStyle.setProperty('--width-item', parseInt(100 / curMaxCols) + "%");
      }
    }
    rowsCount = rowsCount < minItemsPerCol ? minItemsPerCol : rowsCount;
    $list.dataset.rows = rowsCount;
  }
  $list.style.height = rowsCount * settings.itemHeight + 'px';
}

// 视图切换
function toggleList(id, searchMode = false) {
  // console.log($lastListView);
  $main.scrollTop = 0;
  $lastListView.hidden = true;
  // SeachView 会多次调用 单独处理
  if (searchMode) {
    $searchList.hidden = false;
    isSeachView = true;
  } else {
    var $list = $(`#_${id}`);
    $list.hidden = false;
    $searchList.hidden = true;
    isSeachView = false;
    $lastListView = $list;
  }
}

function handleMainClick(event) {
  var target = event.target;
  // console.log(target);
  if (typeof target.dataset.url !== `undefined`) {
    openUrl(target.dataset.url, event);
  }
}

function handleMainMiddleClick(event) {
  if (event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  var $fromTarget = event.target;
  // console.log($fromTarget)
  if ($fromTarget.type === 'link') {
    chrome.tabs.create({
      url: $fromTarget.dataset.url,
      active: false
    });
  } else if (settings.fastCreate === 2 && $fromTarget.classList.contains('favicon')) {
    var a = $fromTarget.nextElementSibling;
    if (a.type === 'folder') {
      // console.log(target);
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.bookmarks.create({
          'parentId': a.dataset.id,
          'title': tabs[0].title,
          'url': tabs[0].url
        }, results => {
          updateFolderList(a.dataset.id, 'add');
        });
      });
    }
  }
}

function handleSearchResultsHover(event) {
  var target = event.target;
  if (target.tagName === 'A' && target.dataset.path !== 'done') {
    // console.log(target);
    addPathTitle(target.dataset.parentId, target);
  }
}

function addPathTitle(id, target) {
  if (typeof id === 'undefined') return;
  if (id < 3) {
    pathTitle = settings.rootInfo[id] + pathTitle;
    target.title += '\n\n' + '[ ' + pathTitle + ' ]';
    target.dataset.path = 'done';
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
  var id = parseInt(target.dataset.id);
  if (id == nav.lastPathID) return;
  var folderName = target.textContent;
  var delay = event.isTrusted ? settings.hoverEnter : 0;
  window.openFolderDelay = setTimeout(() => {
    openFolder(id, folderName, target);
  }, delay);
}

function openFolder(id, folderName, target) {
  if (contextMenu.showing || dialog.showing) return;
  // console.log(target);
  nav.setNavPath(id, folderName, target);
  nav.lastPathID = id;
  // debugger
  var $list = $(`#_${id}`);
  if(!$list) {
    loadChildrenView(id);
  } else {
    !settings.keepMaxCols && setListSize($list, $list.childElementCount);
    toggleList(id);
  }
}

/**
 * 清除已存在的list，保持数据一致
 * @param  {[type]} id   folder-list ID
 * @param  {[type]} type 书签操作类型：add、edit、delete
 * @param  {Object} data edit 数据
 */
function updateFolderList(id, type, data = {}) {
  var $list = $(`#_${id}`);
  if (!$list) return;

  if (type === 'add') {
    $list.remove();
    containers.remove($list);
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
      a.dataset.url = url;
      a.previousElementSibling.src = favicon;
    } else if (data.title) {
      a.textContent = data.title;
    }
  }
}

function locationFolder(parentId, id) {
  // console.log(event.target);
  contextMenu.close();
  if(!$(`#_${parentId}`)) {
    loadChildrenView(parentId, false, () => locationToItem(id));
  } else {
    toggleList(parentId);
    locationToItem(id);
  }
  nav.lastPathID = parentId;
  // 搜索结果定位目录时 激活来源id
  // main区域下有两个对应item，此处用$选择第一个
  function locationToItem(id) {
    var $item = $(`[data-id="${id}"]`).closest('.item');
    $item.classList.add('active');
    $item.scrollIntoView(false);
  }
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
  window.drake = dragula(containers, {
    // spilling will put the element back where it was dragged from, if this is true
    revertOnSpill: true,
  }).on('drop', (el, target, source, sibling, isHover) => {
    // console.log(el, target, source, sibling, isHover);
    // return
    var lastFlag = 0;
    // debugger
    var id = el.lastElementChild.dataset.id;
    if (sibling === null) {
      lastFlag = 1;
      // 此时，lastElementChild 为拖动元素本身
      sibling = source.lastElementChild.previousElementSibling;
    }
    var id_sibling = sibling.lastElementChild.dataset.id;
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
  if (dialog.showing && keyCode !== 'Escape') return;
  var $list = isSeachView ? $searchList : $lastListView;
  var $item = $('.item.active', $list);
  switch (keyCode) {
    case "Escape":
      if (dialog.showing) {
        dialog.close(event);
        return false;
      }
      !$seachInput.value && window.close();
      break;
    case "Tab":
      event.preventDefault();
      contextMenu.showing && contextMenu.close();
      $item && $item.classList.remove('active');
      var $back = $('a:nth-last-of-type(2)', $nav.header);
      $back && $back.dispatchEvent(new Event(BM.openFolderEventType));
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
      if ($itemA.type === 'link') {
        openUrl($itemA.dataset.url, event);
      } else {
        $itemA.closest('.item').classList.remove('active');
        openFolder($itemA.dataset.id, $itemA.textContent);
      }
      break;
    case "KeyF":
      if (!event.ctrlKey || dialog.showing) return;
      event.preventDefault();
      contextMenu.showing && contextMenu.close();
      $seachInput.focus();
      break;
    case "KeyZ":
      event.preventDefault();
      $nav.footer.dataset.id && $nav.footer.dispatchEvent(new Event(BM.openFolderEventType));
      break;
    case "Home":
    case "End":
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight":
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
      // 滚动条靠顶或者靠底时 才滚动
      $goalItem.scrollIntoView(keyCode == 'ArrowUp');
    }
  }

  function getGoalItem($item, keyCode, $list) {
    var rows = $list.dataset.rows;
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

settingsReady(() => {
  // console.log(BM.settings);
  settings = BM.settings;
  dataSetting.init();
  var startupReal = BM.startupReal;
  if (BM.preItems) {
    renderListView(startupReal, BM.preItems);
    BM.preItems = 'done';
    $lastListView = $(`#_${startupReal}`);
  } else {
    loadChildrenView(startupReal, true);
    BM.preItems = 'nowait';
  }
  if (startupReal < 3) {
    nav.init(startupReal);
  } else {
    nav.resetNavPath(startupReal);
    // resetNavPath 未改变footer的DOM结构
    handleFolderEvent($$('.nav > [type=folder]'));
  }
  nav.lastPathID = startupReal;
  setTimeout(() => {
    var LastScrollTop = localStorage.getItem('LastScrollTop') || 0;
    if (LastScrollTop) $main.scrollTop = LastScrollTop;
  }, 5);

  // 优化 FCP
  setTimeout(() => {
    search.init();
    contextMenu.init();
    dialog.init();
    document.addEventListener('keydown', hotskeyEvents);
    window.addEventListener('unload', setLastData);
    setUsageLink();
    $searchList.addEventListener('mouseover', handleSearchResultsHover, false);
    loadCSS('libs/dragula.css');
    loadJS('libs/dragula.min.js', dragToMove);
  }, 60)
});
