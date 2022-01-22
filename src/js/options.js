"use strict";

var $bookmarksBar = $('#bookmarksBar');
var $otherBookmarks = $('#otherBookmarks');
var $customCSS = $('#customCSS');
var $minItemsPerCol = $('#minItemsPerCol');

function bookmarksAlias() {
  var rootInfo = {
    1: $bookmarksBar.value,
    2: $otherBookmarks.value,
  }
  chrome.storage.sync.set({rootInfo: rootInfo}, () => {});
}

function startupFromLast(ele) {
  localStorage.setItem('startupFromLast', this.value);
  this.value > -1 && localStorage.removeItem('LastFolderID');
  this.value > -2 && localStorage.removeItem('LastScrollTop');
}

settingsReady(() => {
  // 读数据
  // console.log(BM.settings);
  for (var key in BM.default) {
    // console.log(`${key}: ${value}`);
    var value = BM.settings[key];
    var ele = $(`input[name=${key}][value="${value}"]`);
    if (ele) {
      ele.checked = true;
    } else {
      // console.log(`[未设置选项] ${key}: ${value}`)
    }
  }
  $minItemsPerCol.value = BM.settings.minItemsPerCol;
  $bookmarksBar.value = BM.settings.rootInfo[1];
  $otherBookmarks.value = BM.settings.rootInfo[2];
  $customCSS.value = BM.settings.customCSS || '';

  // 写数据
  for (var ele of $$('input[type=radio]')) {
    ele.addEventListener('change', (event) => {
      // console.log(event.target);
      var {name, value} = event.target;
      if (value == BM.default[name]) {
        chrome.storage.sync.remove(name, () => {});
      } else {
        chrome.storage.sync.set({[name]: value}, () => {});
      }
    }, false);
  }
  $minItemsPerCol.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
  });
  $minItemsPerCol.addEventListener('change', function() {
    if (this.value < 1) this.value = 1;
    if (this.value > 16) this.value = 16;
    if (this.value == BM.default['minItemsPerCol']) {
      chrome.storage.sync.remove('minItemsPerCol', () => {});
    } else {
      chrome.storage.sync.set({minItemsPerCol: $minItemsPerCol.value}, () => {});
    }
  });
  $bookmarksBar.addEventListener('change', bookmarksAlias);
  $otherBookmarks.addEventListener('change', bookmarksAlias);
  $customCSS.addEventListener('change', () => {
    // console.log($customCSS.value);
    chrome.storage.sync.set({customCSS: $customCSS.value}, () => {});
  });
  $$('input[name=startupFromLast]').forEach((ele) => {
    ele.addEventListener('change', startupFromLast);
  })
})

// 多语言
for (var ele of $$('[data-i18n]')) {
    // console.log(ele);
    switch(ele.tagName) {
      case "INPUT":
      case "TEXTAREA":
        // console.log(ele.placeholder)
        ele.placeholder = chrome.i18n.getMessage(ele.dataset.i18n) + ele.placeholder;
        break;
      default:
        ele.textContent = chrome.i18n.getMessage(ele.dataset.i18n);
    }
}
setUsageLink();

chrome.bookmarks.getChildren('0', (results) => {
  // console.log(results);
  $bookmarksBar.placeholder = results[0].title;
  $otherBookmarks.placeholder = results[1].title;
});