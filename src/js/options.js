"use strict";

var $bookmarksBar = $('#bookmarksBar');
var $otherBookmarks = $('#otherBookmarks');
var $customCSS = $('#customCSS');
var $minItemsPerCol = $('#minItemsPerCol');

function setSyncItem(name, value) {
  if (value == BM.default[name] || !value) {
    chrome.storage.sync.remove(name);
  } else {
    chrome.storage.sync.set({[name]: value});
  }
}

function bookmarksAlias() {
  var rootInfo = {
    1: $bookmarksBar.value,
    2: $otherBookmarks.value,
  }
  chrome.storage.sync.set({rootInfo: rootInfo});
}

settingsReady(() => {
  // 读数据
  // console.log(BM.settings);
  $('#_1').textContent = BM.settings.rootInfo[1];
  $('#_2').textContent = BM.settings.rootInfo[2];
  var folderX = $('#folderX');
  folderX.title = L('folderXTitle');
  if (BM.settings.startup > 2) {
    folderX.previousElementSibling.value = BM.settings.startup;
    chrome.bookmarks.get(BM.settings.startup, (results) => {
      folderX.textContent = results[0].title;
    });
  } else {
    folderX.previousElementSibling.disabled = true;
    folderX.classList.add('disabled');
  }
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
      // if (name == 'startup') debugger
      setSyncItem(name, value);
    }, false);
  }
  // 只允许数字，范围 1-16
  $minItemsPerCol.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
  });
  $minItemsPerCol.addEventListener('change', function() {
    if (this.value < 1) this.value = 1;
    if (this.value > 16) this.value = 16;
    setSyncItem('minItemsPerCol', this.value);
  });
  $bookmarksBar.addEventListener('change', bookmarksAlias);
  $otherBookmarks.addEventListener('change', bookmarksAlias);
  $customCSS.addEventListener('change', function() {
    setSyncItem('customCSS', this.value);
  });
  $$('input[name=startup]').forEach((ele) => {
    ele.addEventListener('change', setStartupLocal);
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

chrome.bookmarks.getChildren('0', (results) => {
  // console.log(results);
  $bookmarksBar.placeholder = results[0].title;
  $otherBookmarks.placeholder = results[1].title;
});
