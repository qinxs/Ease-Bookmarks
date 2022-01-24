"use strict";

window.BM = {
  preItems: null,
  // 选项必须与input的name和value一致
  default: {
    themeColor: 'auto',
    openIn: 3, // 0b11, 0-3 详细说明参见 openUrl 方法
    hoverEnter: 500, // {0,300,500,800}
    layoutCols: 1,
    minItemsPerCol: 1, // 1-16；避免滚动条
    // 1 书签栏 2 其他书签（根目录为0）
    // -1 目录，-2 目录和滚动条（从上次位置启动）
    startup: 1,
  },
  defaultSys: {
    fastCreate: 0, // 0-2
    itemHeight: 28, // 与css变量 --height-item一致
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
        chrome.storage.sync.remove(name, () => {});
      } else {
        chrome.storage.sync.set({[name]: value}, () => {});
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
chrome.storage.sync.get(null, function(items) {
  // console.log(items);
  BM.userOptions = items;
  BM.settings = Object.assign({}, BM.default, BM.defaultSys, items);
  BM.settingsReady = true;
});

BM.startupReal = localStorage.getItem('startupID') || BM.default.startup;

if (location.pathname === '/popup.html') {
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
  });
}

const $ = (css, d = document) => d.querySelector(css);
const $$ = (css, d = document) => d.querySelectorAll(css);
const L = chrome.i18n.getMessage;

function setUsageLink() {
  var UsageLang = chrome.i18n.getUILanguage();
  if (!UsageLang.startsWith('zh')) {
    $('#usage').href = `usage/en.html`;
  }
}

function setStartupLocal(ele, folderID) {
  var id = folderID || this.value;
  id < 0 && localStorage.setItem('startupFromLast', id);
  id > 0 && localStorage.setItem('startupID', id);
  id > -1 && localStorage.removeItem('startupFromLast');
  id > -2 && localStorage.removeItem('LastScrollTop');
}

// 选项数据（异步）加载完成
function settingsReady(callback) {
  if (BM.settingsReady) {
    callback();
  } else {
    setTimeout(() => {
      settingsReady(callback);
    }, 0);
  }
}
