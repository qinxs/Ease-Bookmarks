"use strict";
console.log("eventPage");

function checkRootInfo(argument) {
  chrome.storage.sync.get(['rootInfo'], function(result) {
    if (!Object.keys(result).length) {
      chrome.bookmarks.getChildren('0', (results) => {
        // console.log(results);
        var rootInfo = {
          1: results[0].title,
          2: results[1].title,
        }
        chrome.storage.sync.set({rootInfo: rootInfo}, () => {});
      });
    }
  });
}

function updataOldData() {
  // v1.2.6 ↑
  // 从上次位置启动 改为 从任意目录启动
  chrome.storage.sync.get(null, results => {
    var startup = results.startupFromLast;
    if (startup) {
      chrome.storage.sync.set({'startup': startup}, () => {});
      chrome.storage.sync.remove('startupFromLast', () => {});
      localStorage.setItem('startupID', localStorage.LastFolderID);
      localStorage.removeItem('LastFolderID');
    }
  });
}

// 安装、更新
chrome.runtime.onInstalled.addListener(() => {
  var manifest = chrome.runtime.getManifest();
  localStorage.setItem('version', manifest.version);

  checkRootInfo();

  try {
    updataOldData();
  } catch {}
});

// chrome.runtime.onStartup.addListener(function() {
//   localStorage.setItem('time', new Date().toLocaleString());
// });