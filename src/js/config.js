"use strict";

window.BM = {
  // 选项必须与input的name和value一致
  default: {
    themeColor: 'light',
    openIn: 3, // 0b11, 0-3 详细说明参见 openUrl 方法
    hoverEnter: 500, // {0,300,500,800}
    layoutCols: 1,
    minItemsPerCol: 10, // 1-16；避免滚动条
    // 1 书签栏 2 其他书签（根目录为0）
    // -1 目录，-2 目录和滚动条（从上次位置启动）
    startup: 1,
  },
  defaultSys: {
    bodyWidth_1: '280px',
    bodyWidth_2: '400px',
    bodyWidth_3: '530px',
    bodyWidth_4: '660px',
    bodyWidth_5: '800px',
    compositionEvent: 0,
    fastCreate: 0, // 0-2
    hotkeyCancelSeleted: 'Space',
    hotkeyDelete: '-Delete',
    keepMaxCols: 1, // 0-1 保持最大宽度
    // 1-2
    // 1：仅url 
    // 2：url和title
    openBookmarkAfterCurrentTab: 0, // 当前标签页右边打开书签
    updateBookmarkOpt: 1,
  },
  set: function(name, value) {
    if (this.defaultSys.hasOwnProperty(name)) {
      if (value == BM.defaultSys[name]) {
        chrome.storage.sync.remove(name);
      } else {
        chrome.storage.sync.set({[name]: value});
      }
    } else {
      console.log(L('setInvalidTips'), Object.keys(BM.defaultSys).join());
    }
  }
}

// @TODO 改为 localStorage？
// option页面自动同步到 storage，实现有点麻烦
var loadSettings = new Promise(function(resolve, reject) {
  chrome.storage.sync.get(null, function(items) {
    // console.log(items);
    BM.settings = Object.assign({}, BM.default, BM.defaultSys, items);
    resolve();
  });
});

BM.startupReal = localStorage.getItem('startupID') || BM.default.startup;

var loadPreItems;

// 提前读取bookmarks数据，优化启动速度
if (location.pathname === '/popup.html') {
  loadPreItems = new Promise(function(resolve, reject) {
    chrome.bookmarks.getChildren(BM.startupReal.toString(), (results) => {
      // console.log(results);
      // 启动文件件被删除了
      if (typeof results === 'undefined') {
        localStorage.setItem('startupID', BM.default.startup);
        chrome.storage.sync.set({startup: BM.default.startup}, () => {
          location.reload();
        });
      }
      BM.preItems = results;
      resolve();
    });
  });
}

const $ = (css, d = document) => d.querySelector(css);
const $$ = (css, d = document) => d.querySelectorAll(css);
const L = chrome.i18n.getMessage;

var lang = chrome.i18n.getUILanguage();
if (['ar', 'he', 'fa', 'ur', 'ku', 'ba', 'dv', 'hy'].includes(lang)) {
  document.dir = 'rtl';
}

function setStartupID(folderID) {
  folderID < 0 && localStorage.setItem('startupFromLast', folderID);
  folderID > 0 && localStorage.setItem('startupID', folderID);
  folderID > -1 && localStorage.removeItem('startupFromLast');
  folderID > -2 && localStorage.removeItem('LastScrollTop');
}
