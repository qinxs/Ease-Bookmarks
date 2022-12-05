"use strict";

window.BM = {
  preItems: null,
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
    fastCreate: 0, // 0-2
    keepMaxCols: 1, // 0-1 保持最大宽度
     // 1-2
     // 1：仅url 
     // 2：url和title
    updateBookmarkOpt: 1,
  },
  bodyWidth: {
    1: '280px',
    2: '400px',
    3: '530px',
    4: '660px',
    5: '800px',
  },
  set(name, value) {
    if (this.defaultSys.hasOwnProperty(name)) {
      if (value == BM.defaultSys[name]) {
        chrome.storage.sync.remove(name);
      } else {
        chrome.storage.sync.set({[name]: value});
      }
      location.reload();
    } else {
      console.log(L('setInvalidTips'), Object.keys(BM.defaultSys).join());
    }
  },
  settingsReady: false
}

// @TODO 改为 localStorage？
// option页面自动同步到 storage，实现有点麻烦
var loadSettings = new Promise(function(resolve, reject) {
  chrome.storage.sync.get(null, function(items) {
    // console.log(items);
    BM.userOptions = items;
    BM.settings = Object.assign({}, BM.default, BM.defaultSys, items);
    resolve();
  });
});

BM.startupReal = localStorage.getItem('startupID') || BM.default.startup;

var loadPreItems;

if (location.pathname === '/popup.html') {
  loadPreItems = new Promise(function(resolve, reject) {
    chrome.bookmarks.getChildren(BM.startupReal.toString(), (results) => {
      // console.log(results);
      // 文件夹不存在了
      if (typeof results === 'undefined') {
        localStorage.setItem('startupID', BM.default.startup);
        chrome.storage.sync.set({startup: BM.default.startup}, () => {
          location.reload();
        });
      }
      if (!BM.preItems) BM.preItems = results;
      resolve();
    });
  });
}

const $ = (css, d = document) => d.querySelector(css);
const $$ = (css, d = document) => d.querySelectorAll(css);
const L = chrome.i18n.getMessage;

function setStartupID(folderID) {
  folderID < 0 && localStorage.setItem('startupFromLast', folderID);
  folderID > 0 && localStorage.setItem('startupID', folderID);
  folderID > -1 && localStorage.removeItem('startupFromLast');
  folderID > -2 && localStorage.removeItem('LastScrollTop');
}
