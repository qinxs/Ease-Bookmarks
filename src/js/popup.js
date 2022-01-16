"use strict";
// console.log("popup");

var settings;
const $nav = {
  header: $('nav'),
  footer: $('.nav > a')
};
const $main = $('main');
const $bookmarkList = $('#bookmark-list');
const $subList = $('#sub-list');
const $searchList = $('#search-list');
const $contextMenu = $('#context-menu');
const $dialog = $('#dialog');
// 搜索框
const $seachInput = $('#search-input');
// 中文拼音输入中，但未合成汉字
var inputFlag = false;
var isSeachView = false;
// 上一个视图
var $lastListView = $bookmarkList;
// 中间变量
var $fromTarget = null;
var pathTitle = '';
window.openFolderDelay = null;
// 点击的右键菜单ID，需要弹出dialog时动态改变
var curContextMenuID;

// 宽度只变大 不缩小
var layoutCols;
var curMaxCols = 1;
var curItemslength;
var minItemsPerCol;
const rootStyle = document.documentElement.style;
const itemHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--height-item'));

const isBookmarklet = url => url.trim().startsWith('javascript:');

const dataSetting = {
  init() {
    layoutCols = settings.layoutCols;
    minItemsPerCol = settings.minItemsPerCol;
    this.layout();
    this.switchTheme();
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
    if (id < 3) {
      $nav.header.innerHTML = `<a type="folder" data-id="${id}" data-role="path">${folderName}</a>`;
      // 底部其他书签（与书签栏切换使用）
      this.rootID = id;
      this.setFooterNav(id);
    } else if (target.dataset.role === 'path') {
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
  // activeItemId 搜索结果定位目录时 激活来源id
  resetNavPath(id, activeItemId) {
    if (id < 3) {
      this.pathHtml = `<a type="folder" data-id="${id}" data-role="path">${settings.rootInfo[id]}</a>` + this.pathHtml;
      $nav.header.innerHTML = this.pathHtml;
      handleFolderEvent($$('nav > [type=folder]'));
      // main区域下有两个对应item，此处用$选择第一个
      if (activeItemId) {
        var $item = $(`[data-id="${activeItemId}"]`).closest('.item');
        $item.classList.add('active');
        $item.scrollIntoView();
      }
      this.rootID = id;
      this.setFooterNav(id);
      this.pathHtml = '';
    } else {
      chrome.bookmarks.get(id.toString(), (item) => {
        var folderName = this.replaceEmptyString(item[0].title);
        this.pathHtml = `
        <span>></span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>` + this.pathHtml;
        this.resetNavPath(item[0].parentId, activeItemId);
      })
    }
  },
  replaceEmptyString(folderName) {
    return folderName ? folderName : ' ';
  },
  setFooterNav(id) {
    var _id = 3 - id;
    chrome.bookmarks.getChildren(_id.toString(), (results) => {
      if (!results.length) return;
      $nav.footer.dataset.id = _id;
      $nav.footer.textContent = settings.rootInfo[_id];
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
    $seachInput.addEventListener("keydown", event => {
      if (event.code === 'Escape' && !$seachInput.value) window.close();
    });
  },
  loadSearchView(keyword) {
    if (keyword) {
      // console.log($seachInput.value);
      !isSeachView && toggleList($searchList);
      this._loadSearchView($seachInput.value);
    } else {
      toggleList($lastListView)
    }
  },
  _loadSearchView(keyword) {
    chrome.bookmarks.search(keyword, (results) => {
      var html = `<div class="item noresult">${L("seachNoResultTip")}<div>`;
      if (results.length) {
        html = template(results);
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
    <li id="bookmark-new-tab">${L("openInNewTab")}</li>
    <li id="bookmark-new-tab-background">${L("openInBackgroundTab")}</li>
    <li id="bookmark-new-incognito-window">${L("openInIncognitoWindow")}</li>
    <hr>
    <li id="bookmark-add-bookmark">${L("addBookmark")}</li>
    <li id="bookmark-add-folder">${L("addFolder")}</li>
    <li id="bookmark-location">${L("location")}</li>
    <hr>
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
          $contextMenu.type = $fromTarget.type || 'nodata';
          $contextMenu.className = isSeachView ? 'search' : '';
          this.pos.left = e.clientX;
          if (this.pos.left + $contextMenu.clientWidth > $main.clientWidth) {
            // 数值6: 右键菜单的边距
            this.pos.left = $main.clientWidth - $contextMenu.clientWidth - 6;
          }
          this.pos.top = e.clientY - $main.offsetTop;
          if (this.pos.top + $contextMenu.clientHeight > $main.clientHeight) {
            this.pos.top -= $contextMenu.clientHeight;
          }
          this.pos.top += $main.scrollTop
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
        locationFolder(parentId);
        nav.resetNavPath(parentId, id);
        nav.lastPathID = parentId;
        break;
      case "bookmark-delete":
        if ($fromTarget.type === 'folder') {
          $fromTarget.closest('.item').classList.add('seleted');
          // 防止hover其他元素
          $main.style.pointerEvents = 'none';
          chrome.bookmarks.getChildren(id, results => {
            if (!results.length || confirm(`[ ${$fromTarget.textContent} - ${results.length} ]:\n${L("deleteFolderConfirm")}`)) {
              chrome.bookmarks.removeTree(id, () => {
                $fromTarget.closest('.item').remove();
                setListSize($lastListView, --curItemslength);
              });
            } else {
              $fromTarget.closest('.item').classList.remove('seleted');
            }
            $main.style.pointerEvents = 'auto';
          });
        } else {
          chrome.bookmarks.remove(id, () => {
            $fromTarget.closest('.item').remove();
            setListSize($lastListView, --curItemslength);
          });
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
          $('#edit-dialog-name').value = tabs[0].title;
          $('#edit-dialog-url').hidden = false;
          $('#edit-dialog-url').value = tabs[0].url;
        });
        break;
      case "bookmark-add-folder":
        $('#edit-dialog-name').value = '';
        $('#edit-dialog-url').hidden = true;
        break;
      case "bookmark-edit":
        $('#edit-dialog-name').value = $fromTarget.textContent;
        $('#edit-dialog-url').hidden = false;
        $('#edit-dialog-url').value = $fromTarget.dataset.url;
        break;
      case "bookmark-edit-folder":
        $('#edit-dialog-name').value = $fromTarget.textContent;
        $('#edit-dialog-url').hidden = true;
        break;
      default: break;
    }
    $dialog.hidden = false;
    this.showing = true;
    $('#edit-dialog-name').focus();
  },
  save(e) {
    e.preventDefault();
    var ele = $fromTarget;
    var id = ele.dataset.id;
    var title = $('#edit-dialog-name').value;
    var url = $('#edit-dialog-url').hidden ? null : $('#edit-dialog-url').value;
    // console.log($('#edit-dialog-name').value);
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
      case "bookmark-add-folder":
        if ($fromTarget.classList.contains('nodata')) {
          chrome.bookmarks.create({
            'parentId': id,
            'title': title,
            'url': url
          }, results => {
            // console.log(results);
            setListSize($lastListView, ++curItemslength);
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
              setListSize($lastListView, ++curItemslength);
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
          delete $subList.dataset.folder_id;
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

function loadChildrenView(id, $list) {
  chrome.bookmarks.getChildren(id.toString(), (results) => {
    // console.log(results);
    renderListView(id, $list, results);
  })
}

function renderListView(id, $list, items) {
  var html = `<div class="item nodata" data-id="${id}">${L("noBookmarksTip")}<div>`;
  if (items.length) {
    html = template(items);
  }
  curItemslength = items.length;
  setListSize($list, curItemslength || 1);
  // @TODO 能优化吗？
  $list.innerHTML = html;
  if ($list == $subList) $subList.dataset.folder_id = id;
  handleFolderEvent($$('[type=folder]', $list));
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
    try {
      url = decodeURI(url).replaceAll("\"", "&quot;");
    } catch {
      // console.log(`[${ele.title}]:`, e);
      // % 转义；比如css中的 width: 40%;
      // https://stackoverflow.com/questions/20700393/urierror-malformed-uri-sequence
      url = decodeURI(url.replace(/%([^0-9A-E])/g, "%25$1")).replaceAll("\"", "&quot;");
    }
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

function setListSize($list, length) {
  if (layoutCols === 1) return;
  var rowsCount, colsCount;
  if ($list === $searchList) {
    rowsCount = Math.ceil(length / curMaxCols);
  } else {
    colsCount = length > layoutCols * minItemsPerCol ? layoutCols : Math.ceil(length / minItemsPerCol);
    rowsCount = Math.ceil(length / colsCount);

    if (colsCount > curMaxCols) {
      curMaxCols = colsCount;
      document.body.style.width = BM.bodyWidth[curMaxCols];
      rootStyle.setProperty('--width-item', parseInt(100 / curMaxCols) + "%");
    }
  }
  rowsCount = rowsCount < minItemsPerCol ? minItemsPerCol : rowsCount;
  $list.style.height = rowsCount * itemHeight + 'px';
}

// 视图切换
function toggleList($list) {
  // 防止切换时出现抖动
  setTimeout(() => {
    // console.log($lastListView);
    $main.scrollTop = 0;
    $lastListView.hidden = true;
    $list.hidden = false;
    // SeachView 会多次调用 单独处理
    if ($list === $searchList) {
      isSeachView = true
    } else {
      $searchList.hidden = true;
      isSeachView = false;
      $lastListView = $list;
    }
  }, 0)
}

function handleMainClick(event) {
  var target = event.target;
  // console.log(target);
  if (typeof target.dataset.url === `undefined`) return;
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    openUrl(target.dataset.url, event, tabs)
  })
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
          a.dataset.id === $subList.dataset.folder_id && delete $subList.dataset.folder_id;
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
  @flag [0b]00-11
  高位1 在新标签打开; 0当前标签打开
  低位1 在前台打开; 0在后台
 */
function openUrl(url, event, tabs) {
  var flag = settings.openIn;
  if(event.metaKey || event.ctrlKey) flag ^= 0b10; 
  if(event.shiftKey) flag ^= 0b01;
  // console.log(event);
  // return
  if (isBookmarklet(url)) {
    // 官方页面 不能直接执行js
    var pageUrl = tabs[0].url;
    // console.log(pageUrl);
    // @TODO 空白页点击 在新页面后不能执行
    if (/^(about|chrome|chrome-extension|edge|extension|https:\/\/chrome\.google\.com)/.test(pageUrl) || !pageUrl) {
      !pageUrl && chrome.tabs.remove(tabs[0].id);
      chrome.tabs.create({ url: url, active: true });
    } else { 
      chrome.tabs.executeScript({ code: url });
    }
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
      ele.addEventListener('click', openFolder, false);
    } else {
      ele.addEventListener('mouseover', openFolder, false);
      ele.addEventListener('mouseout', clearOpenFolderDelay, false);
    }
  }
}

function clearOpenFolderDelay() {
  clearTimeout(openFolderDelay);
}

function openFolder(event) {
  if (contextMenu.showing || dialog.showing) return;
  var target = event.target;
  // 路径最末级不在打开文件夹
  var id = parseInt(target.dataset.id);
  if (id == nav.lastPathID) return;
  window.openFolderDelay = setTimeout(() => {
    var folderName = target.textContent;
    // console.log(event.target);
    var curRootID = nav.rootID;
    nav.setNavPath(id, folderName, target);
    nav.lastPathID = id;
    toggleList(id < 3 ? $bookmarkList : $subList);
    // 切换书签栏/其他书签，或者从上次位置启动
    // debugger
    if (id < 3 && (id != curRootID || !$bookmarkList.childNodes.length)) {
      loadChildrenView(id, $bookmarkList);
      return
    }
    if(id > 3 && id != parseInt($subList.dataset.folder_id)) {
      loadChildrenView(id, $subList);
    }
  }, settings.hoverEnter);
}

function locationFolder(id) {
  // console.log(event.target);
  contextMenu.close();
  // debugger
  if (id == $('nav a:first-child').dataset.id) {
    toggleList($bookmarkList);
  } else {
    toggleList($subList);
    if(id != parseInt($subList.dataset.folder_id)) {
      loadChildrenView(id, $subList);
      $subList.dataset.folder_id = id;
    }
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
  document.head.appendChild(script);
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
  var drake = dragula([$bookmarkList, $subList], {
    // spilling will put the element back where it was dragged from, if this is true
    revertOnSpill: true,
  }).on('drop', (el, target, source, sibling, isHover) => {
    // console.log(el, target, source, sibling, isHover);
    // return
    var lastFlag = 0;
    var id = el.lastElementChild.dataset.id;
    if (sibling === null) {
      lastFlag = 1;
      // 此时，lastElementChild 为拖动元素本身
      sibling = source.lastElementChild.previousElementSibling;
    }
    var id_sibling = sibling.lastElementChild.dataset.id;
    if (isHover) {
      chrome.bookmarks.move(id, {parentId: id_sibling});
      delete $subList.dataset.folder_id;
    } else {
      chrome.bookmarks.get(id_sibling.toString(), item => {
        chrome.bookmarks.move(id, {index: item[0].index + lastFlag});
      })
    }
  });
}

function setLastData(event) {
  // Cancel the event as stated by the standard.
  event.preventDefault();
  // Chrome requires returnValue to be set.
  event.returnValue = '';
  // startupFromLast 取最新的设置
  // 否则，打开popup页面时，去修改此设置，数据会出错
  var curStartupFromLast = localStorage.getItem('startupFromLast');
  if (curStartupFromLast < -1) {
    localStorage.setItem('LastScrollTop', $main.scrollTop);
  }
  if (curStartupFromLast < 0) {
    localStorage.setItem('LastFolderID', $('nav a:last-child').dataset.id);
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
    renderListView(startupReal, startupReal < 3 ? $bookmarkList : $subList, BM.preItems);
    BM.preItems = 'done';
  } else {
    loadChildrenView(startupReal, startupReal < 3 ? $bookmarkList : $subList);
    BM.preItems = 'nowait';
  }
  if (startupReal < 3) {
    nav.init(startupReal);
  } else {
    nav.resetNavPath(startupReal);
    // resetNavPath 未改变footer的DOM结构
    handleFolderEvent($$('.nav > [type=folder]'));
    $lastListView = $subList;
  }
  nav.lastPathID = startupReal;
  $('footer').classList.remove('hidden');
  var LastScrollTop = localStorage.getItem('LastScrollTop') || 0;
  if (LastScrollTop) $main.scrollTop = LastScrollTop;
  // 优化 FCP
  setTimeout(() => {
    search.init();
    contextMenu.init();
    dialog.init();
    $searchList.addEventListener('mouseover', handleSearchResultsHover, false);
    loadCSS('libs/dragula.css');
    loadJS('libs/dragula.min.js', dragToMove);
    window.addEventListener('unload', setLastData);
    setUsageLink();
  }, 60)
});
