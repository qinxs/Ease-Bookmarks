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

function setRootInfo() {
  return new Promise(resolve => {
    chrome.bookmarks.getChildren('0', resolve)
  }).then(results => {
    const rootInfo = { 
      1: results[0].title,
      2: results[1].title,
    }

    return new Promise(resolve => 
      chrome.storage.sync.set({ rootInfo }, resolve)
    );
  })
}

function updataOldData() {
  // v1.7.2 ↑
  // 从上次位置启动 改为 从任意目录启动
  localStorage.removeItem('version');
  var iconBase64 = localStorage.customIcon;
  if (iconBase64) {
    // console.log(iconBase64);
    chrome.storage.local.set({customIcon: iconBase64});
    localStorage.removeItem('customIcon');
  }
}

// 安装、更新
chrome.runtime.onInstalled.addListener((details) => {
  if (!['install', 'update'].includes(details.reason)) return;

  if (details.reason === 'install') {
    setRootInfo();
  } else {
    try {
      updataOldData();
    } catch {}
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-bookmarks-manager',
    title: chrome.i18n.getMessage('bookmarksManager'), 
    contexts: ['action'],
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log(message, sender);
  let task = message.task;
  if (task === 'reset') {
    setRootInfo().then(() => {
      sendResponse(); // chrome 必须显式发送响应？
    });
    return true; // 异步返回true
  } else {
    console.log('[invalid task: ]', message);
  }

  return false;
});


chrome.contextMenus.onClicked.addListener((data) => {
  switch(data.menuItemId) {
    case 'open-bookmarks-manager':
      chrome.tabs.create({
        url: 'chrome://bookmarks/',
      });
  }
});
