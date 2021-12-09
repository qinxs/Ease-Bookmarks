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
// 搜索框
const $seachInput = $('#search-input');
// 中文拼音输入中，但未合成汉字
var inputFlag = false;
var isSeachView = false;
// 上一个视图
var $lastListView = $bookmarkList;
var $contextMenu = null;
// 中间变量
var $fromTarget = null;

var curContextMenuID;

var layoutCols;

const dataSetting = {
  init: function() {
    layoutCols = BM.data.layoutCols;
    this.layout();
    this.switchTheme();
  },
  layout: function() {
    document.body.style.width = BM.bodyWidth[layoutCols];
    $('#customCSS').textContent = BM.data.customCSS;
  },
  switchTheme: function() {
    // 媒体查询，用户系统是否启动暗色模式
    if (BM.data.themeColor === 'light') return;
    if (BM.data.themeColor === 'dark' ||
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add("dark");
    }
  }
}

const nav = {
  init: function() {
    // console.log(BM.data.rootInfo);
    this.setNavPath(BM.startup, BM.data.rootInfo[BM.startup]);
    handleFolderEvent($$('.nav'));
  },
  setNavPath: function(id, folderName, target) {
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
      var html = `
      <span>></span> <a type="folder" data-id="${id}" data-role="path">${folderName}</a>
      `;
      $nav.header.insertAdjacentHTML('beforeend', html)
      handleFolderEvent($$('nav > [type="folder"]'))
    }
  }
}

const search = {
  init: function() {
    $seachInput.placeholder = L("seachPlaceholder");
    this.handleEvent();
  },
  handleEvent: function() {
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
  loadSearchView: function(keyword) {
    if (keyword) {
      // console.log($seachInput.value);
      !isSeachView && toggleList($searchList);
      this._loadSearchView($seachInput.value);
    } else {
      toggleList($lastListView)
    }
  },
  _loadSearchView: function(keyword) {
    chrome.bookmarks.search(keyword, (results) => {
      var html = `<div class="item noresult">${L("seachNoResultTip")}<div>`;
      if (results.length) {
        html = template(results);
      }
      $searchList.innerHTML = html;
      handleFolderEvent($$('#search-list [type="folder"]'));
    })
  }
}

const contextMenu = {
  pos: {
    x: 0,
    y:0,
  },
  init: function() {
    $main.insertAdjacentHTML('beforeend', this.html);
    $contextMenu = $('#context-menu');
    $main.addEventListener('contextmenu', this, false);
    $contextMenu.addEventListener('click', this, false);
    document.addEventListener('click', this.close, false);
    $('footer').addEventListener('contextmenu', (event) => {
      event.preventDefault();
    }, false);
  },
  html: `
  <ul id="context-menu" style="opacity: 0; left:-999px; top:0">
    <li id="bookmark-new-tab">${L("openInNewTab")}</li>
    <li id="bookmark-new-tab-background">${L("openInBackgroundTab")}</li>
    <li id="bookmark-new-incognito-window">${L("openInIncognitoWindow")}</li>
    <hr>
    <li id="bookmark-add-bookmark">${L("addBookmark")}</li>
    <li id="bookmark-add-folder">${L("addFolder")}</li>
    <hr>
    <li id="bookmark-update-url">${L("updateToCurrentURL")}</li>
    <li id="bookmark-edit">${L("edit")} ...</li>
    <li id="bookmark-edit-folder">${L("rename")} ...</li>
    <li id="bookmark-delete">${L("delete")}</li>
  </ul>
  `,
  show: function () {
    $contextMenu.style.opacity = 1;
    $contextMenu.style.left = this.pos.x + 'px';
    $contextMenu.style.top = this.pos.y + 'px';
    $('.item.active') && $('.item.active').classList.remove('active');
    $fromTarget.closest('.item').classList.add('active');
  },
  close: function () {
    if ($contextMenu && !$contextMenu.hidden) {
      $contextMenu.style.opacity = 0;
      $contextMenu.style.left = -999 + 'px';
      $contextMenu.style.top = 0;
      $('.item.active') && $('.item.active').classList.remove('active');
    }
  },
  handleEvent: function(e) {
    switch(e.type) {
      case "contextmenu":
        e.preventDefault();
        this.close();
        if(e.target.nodeName === 'A' || e.target.classList.contains('nodata')) {
          // console.log(e);
          // console.log(this);
          $fromTarget = e.target;
          $contextMenu.type = $fromTarget.type || 'nodata';
          $contextMenu.className = isSeachView ? 'search' : '';
          this.pos.x = e.pageX - $main.offsetLeft  + $main.scrollLeft;
          if (this.pos.x + $contextMenu.offsetWidth > $main.offsetWidth) {
            // 6: 右键菜单的边距
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
  handleMenuItem: function (target) {
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
      case "bookmark-delete":
      case "folder-delete":
        if ($fromTarget.type === 'folder') {
          confirm(L("deleteFolderConfirm")) && chrome.bookmarks.removeTree(id, () => {
            $fromTarget.closest('.item').remove();
          });
        } else {
          chrome.bookmarks.remove(id, () => {
            $fromTarget.closest('.item').remove();
          });
        } 
        break;
      default: break;
    }
  }
}

const dialog = {
  init: function() {
    $main.insertAdjacentHTML('beforeend', this.html);
    $('#edit-cancel').addEventListener('click', this.close, false);
    $('#edit-save').addEventListener('click', this.save, false);
  },
  title: {
    'bookmark-add-bookmark': L("addBookmark"),
    'bookmark-add-folder': L("addFolder"),
    'bookmark-edit': L("editBookmark"),
    'bookmark-edit-folder': L("editFolderName"),
  },
  html: `
  <form id="dialog" hidden>
    <div id="edit-dialog-text" class="title"></div>
    <input id="edit-dialog-name" placeholder="${L("name")}">
    <textarea type="url" id="edit-dialog-url" placeholder="${L("URL")}"></textarea>
    <div>
      <button id="edit-save">${L("save")}</button>
      <button id="edit-cancel">${L("cancel")}</button>
    </div>
  </form>
  `,
  show: function() {
    $('#edit-dialog-text').textContent = dialog.title[curContextMenuID];
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
    $('#dialog').hidden = false;
    $('#edit-dialog-name').focus();
  },
  save: function(e) {
    e.preventDefault();
    var ele = $fromTarget;
    var id = ele.dataset.id;
    var title = $('#edit-dialog-name').value;
    var url = $('#edit-dialog-url').hidden ? null : $('#edit-dialog-url').value;
    // console.log($('#edit-dialog-name').value);
    switch(curContextMenuID) {
      case "bookmark-add-bookmark":
      case "bookmark-add-folder":
        // @TODO
        if ($fromTarget.classList.contains('nodata')) {
          chrome.bookmarks.create({
            'parentId': id,
            'title': title,
            'url': url
          }, results => {
            // console.log(results);
            $fromTarget.closest('.item').insertAdjacentHTML('afterend', templateItem(results));
            handleFolderEvent($fromTarget.closest('.item').nextElementSibling.querySelectorAll('[type="folder"]'));
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
              $fromTarget.closest('.item').insertAdjacentHTML('afterend', templateItem(results));
              handleFolderEvent($fromTarget.closest('.item').nextElementSibling.querySelectorAll('[type="folder"]'));
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
        });
        break;
    }
    $('#dialog').hidden = true;
  },
  close: function(e) {
    e.preventDefault();
    $('#dialog').hidden = true;
  },
}

function loadChildrenView(id, $list) {
  chrome.bookmarks.getChildren(id.toString(), (results) => {
    // console.log(results);
    var html = `<div class="item nodata" data-id="${id}">${L("noBookmarksTip")}<div>`;
    if (results.length) {
      html = template(results);
    }
    // @TODO 优化它
    $list.innerHTML = html;
    handleFolderEvent($$('main [type="folder"]'));
  })
}

function template(treeData) {
  var insertHtml = '';
  treeData.forEach(ele => {
    insertHtml += templateItem(ele);
  });
  return insertHtml;
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
  return `
    <div class="item cols-${layoutCols}">
    <img class="favicon" src="${favicon}"></img>
    <a data-id="${ele.id}" ${attributeStr}>${ele.title}</a>
    </div>
  `;
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
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    var target = event.target;
    if (typeof target.dataset.url === `undefined`) return;
    // console.log(target);
    
    openUrl(target.dataset.url, event, tabs)
  })
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
  var target = event.target;
  var id = parseInt(target.dataset.id)
  // 路径最末级不在打开文件夹
  if (target.dataset.role === 'path' && !target.nextElementSibling) return;
  if ($contextMenu && $contextMenu.style.opacity == 1) return;
  if ($('#edit-dialog') && !$('#edit-dialog').hidden) return;
  var folderName = event.target.textContent;
  window.funcDelay = setTimeout(() => {
    // console.log(event.target);
    contextMenu.close();
    nav.setNavPath(id, folderName, target);
    if (id === BM.startup) {
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

function dragToMove() {
  if (typeof dragula !== 'function') {
    setTimeout(dragToMove);
    return
  }
  // @TODO 优化移动到文件夹中
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
  loadChildrenView(BM.startup, $bookmarkList);
  nav.init();
  $main.addEventListener('click', handleMainClick, false);
  search.init();
  contextMenu.init();
  dialog.init();
  dragToMove();
});
