"use strict";

const $ = css => document.querySelector(css);
const $$ = css => document.querySelectorAll(css);
const L = name => chrome.i18n.getMessage(name);

window.BM = {
  // 1 书签栏 2 其他书签（根目录为0）
  startup: 1,
  // 选项必须与input的name和value一致
  default: {
    themeColor: 'auto',
    openIn: 3, // 0b11, 0-3 详细说明参见 openUrl 方法
    hoverEnter: 500, // {0,300,500,800}
    layoutCols: 1,
  },
  bodyWidth: {
    1: '280px',
    2: '400px',
    3: '530px',
    4: '660px',
    5: '800px',
  },
  dataReady: false
}

chrome.storage.sync.get(null, function(items) {
  // console.log(items);
  BM.options = items;
  BM.data = Object.assign({}, BM.default, items);
  BM.dataReady = true;
});

// 选项数据（异步）加载完成
function dataReady(callback) {
  if (BM.dataReady) {
    callback();
  } else {
    setTimeout(() => {
      dataReady(callback);
    }, 0);
  }
}
