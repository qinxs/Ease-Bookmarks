'use strict';
// console.log('eventPage');

const bookmarkNode = {
  root: '0',
  main: '1',
  other: '2', // updateTopIDs 中获取真实ID
  updateTopIDs(rootTree) {
    if (!rootTree) return;

    const otherNode = rootTree.find(n => n.folderType === "other") || rootTree[1];
    if (otherNode) {
      this.other = otherNode.id;
    }
  },
}

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
    chrome.bookmarks.getChildren(bookmarkNode.root, resolve)
  }).then(results => {
    const rootInfo = {};
    bookmarkNode.updateTopIDs(results);
    results.forEach(item => {
      if ([bookmarkNode.main, bookmarkNode.other].includes(item.id)) {
        rootInfo[item.id] = item.title;
      }
    });

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
