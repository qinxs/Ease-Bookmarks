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

// 安装、更新
chrome.runtime.onInstalled.addListener(() => {
  var manifest = chrome.runtime.getManifest();
  localStorage.setItem('version', manifest.version);

  checkRootInfo();
});

// chrome.runtime.onStartup.addListener(function() {
//   localStorage.setItem('time', new Date().toLocaleString());
// });