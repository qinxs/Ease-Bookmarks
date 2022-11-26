"use strict";

var $bookmarksBar = $('#bookmarksBar');
var $otherBookmarks = $('#otherBookmarks');
var $customCSS = $('#customCSS');
var $minItemsPerCol = $('#minItemsPerCol');

var $iconPreview = $('.icon_preview');

var lang = chrome.i18n.getUILanguage();
if (lang.startsWith('zh')) {
  document.documentElement.lang = 'zh';
}

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

loadSettings.then(() => {
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

  $('#_1').textContent = BM.settings.rootInfo[1];
  $('#_2').textContent = BM.settings.rootInfo[2];
  var folderX = $('#folderX');
  // folderX.title = L('folderXTitle');
  if (BM.settings.startup > 2) {
    folderX.previousElementSibling.value = BM.settings.startup;
    chrome.bookmarks.get(BM.settings.startup, (results) => {
      folderX.textContent = results[0].title;
    });
  } else {
    folderX.previousElementSibling.disabled = true;
    folderX.classList.add('disabled');
  }

  $minItemsPerCol.value = BM.settings.minItemsPerCol;

  $bookmarksBar.value = BM.settings.rootInfo[1];
  $otherBookmarks.value = BM.settings.rootInfo[2];
  chrome.bookmarks.getChildren('0', (results) => {
    // console.log(results);
    $bookmarksBar.placeholder = results[0].title;
    $otherBookmarks.placeholder = results[1].title;
  });

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

  $$('input[name=startup]').forEach((ele) => {
    ele.addEventListener('change', function() {
      setStartupID(this.value);
    });
  });
  
  // 只允许数字
  $minItemsPerCol.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
  });
  $minItemsPerCol.addEventListener('change', function() {
    if (this.value < 1) this.value = 1;
    setSyncItem('minItemsPerCol', this.value);
  });

  $bookmarksBar.addEventListener('change', bookmarksAlias);
  $otherBookmarks.addEventListener('change', bookmarksAlias);
  
  $customCSS.addEventListener('change', function() {
    setSyncItem('customCSS', this.value);
  });

  // 预览自定义头像
  var iconBase64 = localStorage.customIcon;
  if (iconBase64) {
    $iconPreview.style.backgroundImage = `url(${iconBase64})`;
    $iconPreview.style.backgroundSize = `19px`;
  }

  // 压缩图片需要的一些元素和对象
  var reader = new FileReader(), img = new Image(), file = null;

  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d");

  $('#uploadIcon').addEventListener('change', function() {
    file = event.target.files[0];
    // 选择的文件是图片
    if (file.type.indexOf("image") == 0) {
      reader.readAsDataURL(file);    
    }
  });

  reader.onload = function (event) {
    // base64码
    img.src = event.target.result;
  }

  img.onload = function() {
    var imgBase64 = image2Base64(img);
    $iconPreview.style.backgroundImage = `url(${imgBase64})`;
    $iconPreview.style.backgroundSize = `19px`;
    localStorage.customIcon = imgBase64;

    var imageData = context.getImageData(0, 0, 19, 19);
    chrome.browserAction.setIcon({imageData: imageData});

    function image2Base64(img, width = 19, height = 19) {
      canvas.width = width;
      canvas.height = height;
      // 清除画布
      context.clearRect(0, 0, width, height);
      // 图片压缩
      context.drawImage(img, 0, 0, width, height);
      var dataURL = canvas.toDataURL("image/png");
      // console.log(dataURL);
      return dataURL;
    }
  };

  $('#resetIcon').addEventListener('click', function(){
    if (localStorage.customIcon) {
      delete localStorage.customIcon;
      chrome.browserAction.setIcon({path: '../icons/icon32.png'});
      $iconPreview.removeAttribute('style');
    }
  });

});
