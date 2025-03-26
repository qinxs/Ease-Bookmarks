'use strict';
// console.log('eventPage');

const chrome = browser;
const bookmarkNode = {
  root: 'root________',
  main: 'toolbar_____',
  other: 'unfiled_____',
}

// default_icon 设为透明图标，但效果不好
var iconBase64 = localStorage.customIcon;
if (iconBase64) {
  chrome.browserAction.setIcon({path: iconBase64});
}

function setRootInfo() {
  return new Promise(resolve => {
    chrome.bookmarks.getChildren(bookmarkNode.root, resolve)
  }).then(results => {
    const rootInfo = { 
      [bookmarkNode.main]: results[1].title,
      [bookmarkNode.other]: results[2].title,
    }

    return new Promise(resolve => 
      chrome.storage.sync.set({ rootInfo }, resolve)
    );
  })
}

function updataOldData() {
  // v1.2.6 ↑
  // 从上次位置启动 改为 从任意目录启动
  chrome.storage.sync.get(null, results => {
    var startup = results.startupFromLast;
    if (startup) {
      chrome.storage.sync.set({'startup': startup});
      chrome.storage.sync.remove('startupFromLast');
      localStorage.setItem('startupID', localStorage.LastFolderID);
      localStorage.removeItem('LastFolderID');
    }
  });
}

// 安装、更新
chrome.runtime.onInstalled.addListener((details) => {
  if (!['install', 'update'].includes(details.reason)) return;

  var manifest = chrome.runtime.getManifest();
  localStorage.setItem('version', manifest.version);

  if (details.reason === 'install') {
    setRootInfo();
  } else {
    try {
      updataOldData();
    } catch {}
  }
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

// chrome.runtime.onStartup.addListener(function() {
//   localStorage.setItem('time', new Date().toLocaleString());
// });

chrome.contextMenus.create({
  title: chrome.i18n.getMessage('options'), 
  contexts: ['browser_action'],
  onclick: () => {
    chrome.tabs.create({
      url: 'options.html',
    });
  }
});
