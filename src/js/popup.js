"use strict";
// console.log("popup");

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
window.funcDelay = null;
// 点击的右键菜单ID
var curContextMenuID;

// 宽度只变大 不缩小
var layoutCols;
var curMaxCols = 1;
var curItemslength;
var minItemsPerCol;
var itemHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--height-item'));

const dataSetting = {
  init() {
    layoutCols = BM.data.layoutCols;
    minItemsPerCol = BM.data.minItemsPerCol;
    this.layout();
    this.switchTheme();
  },
  layout() {
    $('#customCSS').textContent = BM.data.customCSS;
  },
  switchTheme() {
    // 媒体查询，用户系统是否启动暗色模式
    if (BM.data.themeColor === 'light') return;
    if (BM.data.themeColor === 'dark' ||
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add("dark");
    }
  }
}

const nav = {
  pathHtml: '',
  init() {
    // console.log(BM.data.rootInfo);
    this.setNavPath(BM.startup, BM.data.rootInfo[BM.startup]);
    handleFolderEvent($$('.nav'));
  },
  setNavPath(id, folderName, target) {
    folderName = folderName ? folderName : ' ';
    // console.log(target);
    if (id < 3) {
      $nav.header.innerHTML = `<a type="folder" data-id="${id}">${folderName}</a>`;
      // 底部其他书签（与书签栏切换使用）
      var _id = 3 - id;
      chrome.bookmarks.getChildren(_id.toString(), (results) => {
        if (!results.length) return;
        $nav.footer.dataset.id = _id;
        $nav.footer.textContent = BM.data.rootInfo[_id];
      });
    } else if (target.dataset.role === 'path') {
      while (target.nextElementSibling) {
        target.nextElementSibling.remove();
      }
    } else {
      var symbol = isSeachView ? '?' : '>';
      var html = `
      <span>${symbol}</span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>
      `;
      $nav.header.insertAdjacentHTML('beforeend', html)
      handleFolderEvent($$('nav > [type=folder]'))
    }
  },
  resetNavPath(id, itemId) {
    if (id < 3) {
      chrome.bookmarks.get(id.toString(), (item) => {
        this.pathHtml = `<a type="folder" data-id="${id}">${item[0].title}</a>` + this.pathHtml;
        $nav.header.innerHTML = this.pathHtml;
        handleFolderEvent($$('nav > [type=folder]'));
        // main区域下有两个对应item，此处用$选择第一个
        var $item = $(`[data-id="${itemId}"]`).closest('.item');
        $item.classList.add('active');
        $item.scrollIntoView();
        this.pathHtml = '';
        var _id = 3 - id;
        chrome.bookmarks.getChildren(_id.toString(), (results) => {
          if (!results.length) return;
          $nav.footer.dataset.id = _id;
          $nav.footer.textContent = BM.data.rootInfo[_id];
        });
      })
    } else {
      chrome.bookmarks.get(id.toString(), (item) => {
        this.pathHtml = `
        <span>></span> <a type="folder" data-id="${id}" data-role="path">${item[0].title}</a>` + this.pathHtml;
        this.resetNavPath(item[0].parentId, itemId);
      })
    }
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
      handleFolderEvent($$('#search-list [type=folder]'));
    })
  }
}

const contextMenu = {
  pos: {
    x: 0,
    y:0,
  },
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
    $contextMenu.style.left = this.pos.x + 'px';
    $contextMenu.style.top = this.pos.y + 'px';
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
          this.pos.x = e.pageX - $main.offsetLeft  + $main.scrollLeft;
          if (this.pos.x + $contextMenu.offsetWidth > $main.offsetWidth) {
            // 数值6: 右键菜单的边距
            this.pos.x = $main.offsetWidth - $contextMenu.offsetWidth - 6;
          }
          this.pos.y = e.pageY - $main.offsetTop + $main.scrollTop;
          if (this.pos.y + $contextMenu.offsetHeight > $main.offsetHeight) {
            this.pos.y -= $contextMenu.offsetHeight;
          }
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
        break;
      case "bookmark-delete":
      case "folder-delete":
        if ($fromTarget.type === 'folder') {
          confirm(L("deleteFolderConfirm")) && chrome.bookmarks.removeTree(id, () => {
            $fromTarget.closest('.item').remove();
            setListSize($lastListView, --curItemslength);
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
            handleFolderEvent($fromTarget.closest('.item').nextElementSibling.querySelectorAll('[type=folder]'));
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
              handleFolderEvent($fromTarget.closest('.item').nextElementSibling.querySelectorAll('[type=folder]'));
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
            $fromTarget.previousElementSibling.src = 'chrome://favicon/' + url;
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
  // @TODO 如何优化？
  $list.innerHTML = html;
  handleFolderEvent($$('main [type=folder]'));
}

function template(treeData) {
  var insertHtml = [];
  treeData.forEach(ele => {
    insertHtml.push(templateItem(ele));
  });
  return insertHtml.join('');
}

function templateItem(ele) {
  var favicon;
  var url = ele.url;
  var attributeStr;
  if (typeof url === 'undefined') {
    favicon = 'icons/favicon/folder.png';
    attributeStr = `type="folder"`;
  } else if (url.trim().startsWith('javascript:')) {
    favicon = 'icons/favicon/js.png';
    // @TODO 小书签可能解码失败; 太长还是特殊字符？
    try {
      url = decodeURI(ele.url).replaceAll("\"", "&quot;");
    } catch {}
    var _url = url.length > 300 ? url.substring(0, 300) + '...' : url;
    attributeStr = `type="link" data-url="${url}" title="${ele.title}&#10;${_url}"`;
  } else {
    favicon = `chrome://favicon/${url}`;
    attributeStr = `type="link" data-url="${url}" title="${ele.title}&#10;${url}"`;
  }
  if (isSeachView) attributeStr = `data-parent-id="${ele.parentId}"` + attributeStr;
  return `
    <div class="item">
    <img class="favicon" src="${favicon}"></img>
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

    if (curMaxCols < colsCount) {
      curMaxCols = colsCount;
      document.body.style.width = BM.bodyWidth[curMaxCols];
      document.documentElement.style.setProperty('--width-item', parseInt(100 / curMaxCols) + "%");
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
  var target = event.target;
  if (target.classList.contains('favicon')) {
    var a = target.nextElementSibling;
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
    pathTitle = BM.data.rootInfo[id] + pathTitle;
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
  var flag = BM.data.openIn;
  if(event.metaKey || event.ctrlKey) flag ^= 0b10; 
  if(event.shiftKey) flag ^= 0b01;
  // console.log(event);
  // return
  if (url.trim().startsWith('javascript:')) {
    // 官方页面 不能直接执行js
    var pageUrl = tabs[0].url;
    // console.log(pageUrl);
    if (/^(about|chrome|chrome-extension|moz-extension|https:\/\/chrome.google.com)/.test(pageUrl) || !pageUrl) {
      !pageUrl && chrome.tabs.remove(tabs[0].id);
      chrome.tabs.create({ url: url, active: true });
    } else {
      // @TODO 编解码问题
      // 可能不能执行（但书签栏直接点击能执行） 
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
    if (BM.data.hoverEnter == 0) {
      ele.addEventListener('click', openFolder, false);
    } else {
      ele.addEventListener('mouseover', openFolder, false);
      ele.addEventListener('mouseout', () => clearTimeout(funcDelay), false);
      ele.addEventListener('contextmenu', () => clearTimeout(funcDelay), false);
    }
  }
}

function openFolder(event) {
  if (contextMenu.showing || dialog.showing) return;
  var target = event.target;
  // 路径最末级不在打开文件夹
  if (target.dataset.role === 'path' && !target.nextElementSibling) return;
  var id = parseInt(target.dataset.id)
  var folderName = target.textContent;
  window.funcDelay = setTimeout(() => {
    // console.log(event.target);
    nav.setNavPath(id, folderName, target);
    if (id == BM.startup) {
      toggleList($bookmarkList);
      return
    }
    toggleList($subList);
    if(id !== parseInt($subList.dataset.folder_id)) {
      loadChildrenView(id, $subList);
      $subList.dataset.folder_id = id;
    }
  }, BM.data.hoverEnter);
}

function locationFolder(id) {
  // console.log(event.target);
  contextMenu.close();
  // nav.setNavPath(id, folderName, target);
  // debugger
  if (id == BM.startup) {
    toggleList($bookmarkList);
    return
  }
  toggleList($subList);
  if(id !== parseInt($subList.dataset.folder_id)) {
    loadChildrenView(id, $subList);
    $subList.dataset.folder_id = id;
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

/******************************************************/
dataReady(() => {
  // console.log(BM.data);
  dataSetting.init();
  if (BM.preItems) {
    renderListView(BM.startup, $bookmarkList, BM.preItems);
  } else {
    loadChildrenView(BM.startup, $bookmarkList);
  }
  $('footer').classList.remove('hidden');
  nav.init();
  // 优化 FCP
  setTimeout(() => {
    $main.addEventListener('click', handleMainClick, false);
    BM.data.fastCreate > 0 && $main.addEventListener('mousedown', handleMainMiddleClick, false);
    search.init();
    contextMenu.init();
    dialog.init();
    $searchList.addEventListener('mouseover', handleSearchResultsHover, false);
    loadCSS('libs/dragula.css');
    loadJS('libs/dragula.min.js', dragToMove);
  }, 40)
});
