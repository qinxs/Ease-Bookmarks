'use strict';
// console.log('eventPage');

// default_icon 设为透明图标，但效果不好
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('customIcon', items => {
    var iconBase64 = items.customIcon;
    if (iconBase64) {
      chrome.action.setIcon({path: iconBase64});
    }
  });
});

function checkRootInfo(argument) {
  chrome.storage.sync.get(['rootInfo'], function(result) {
    if (!Object.keys(result).length) {
      chrome.bookmarks.getChildren('0', (results) => {
        // console.log(results);
        var rootInfo = {
          1: results[0].title,
          2: results[1].title,
        }
        chrome.storage.sync.set({rootInfo: rootInfo});
      });
    }
  });
}

function updataOldData() {
  // v1.7.2 ↑
  // 从上次位置启动 改为 从任意目录启动
  localStorage.removeItem('version');
  var iconBase64 = localStorage.customIcon;
  if (iconBase64) {
    // console.log(iconBase64);
    // chrome.browserAction.setIcon({path: iconBase64});
    chrome.storage.local.set({customIcon: iconBase64});
    localStorage.removeItem('customIcon');
  }
}

// 安装、更新
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install" && details.reason !== "update") return;

  checkRootInfo();
  try {
    updataOldData();
  } catch {}
});

// chrome.runtime.onStartup.addListener(function() {
//   localStorage.setItem('time', new Date().toLocaleString());
// });

chrome.contextMenus.create({
  title: chrome.i18n.getMessage('bookmarksManager'), 
  contexts: ['browser_action'],
  onclick: () => {
    chrome.tabs.create({
      url: 'chrome://bookmarks/',
    });
  }
});
