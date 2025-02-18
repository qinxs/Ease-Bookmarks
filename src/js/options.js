"use strict";

var $bookmarksBar = $('#bookmarksBar');
var $otherBookmarks = $('#otherBookmarks');
var $customCSS = $('#customCSS');
var $minItemsPerCol = $('#minItemsPerCol');

var $iconPreview = $('.icon_preview');

if (lang.startsWith('zh')) {
  document.documentElement.lang = 'zh';
}

// 多语言
for (var ele of $$('[data-i18n]')) {
    // console.log(ele);
    // 单独处理的元素
    if (ele.id === 'customCSS' ) {
      ele.placeholder = L(ele.dataset.i18n) + ele.placeholder;
      continue;
    }
    // 多属性或者非常规属性 翻译
    if (ele.dataset.i18n.includes('=')) {
      var i18nStr = ele.dataset.i18n.replaceAll(' ', '');
      // console.log(i18nStr);
      for(var _i18nStr of i18nStr.split(',')) {
        var [ key, value ] = _i18nStr.split('=');
        ele.setAttribute(key, L(value));
      }
      continue;
    }
    // 普通翻译
    switch(ele.tagName) {
      case "INPUT":
      case "TEXTAREA":
        ele.placeholder = L(ele.dataset.i18n);
        break;
      default:
        ele.textContent = L(ele.dataset.i18n);
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

  // 必须在最前面 #folderX的数据通过后面for写入
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

  // 读数据
  // console.log(BM.settings);
  for (var key in BM.default) {
    // [value=]会报错 单独处理
    if (key === 'customCSS') continue;

    var value = BM.settings[key];
    // console.log(`${key}: ${value}`);
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
  chrome.bookmarks.getChildren('0', (results) => {
    // console.log(results);
    $bookmarksBar.placeholder = results[0].title;
    $otherBookmarks.placeholder = results[1].title;
  });

  $customCSS.value = BM.settings.customCSS || '';

  // 写数据
  for (var ele of $$('input[type=radio]')) {
    // console.log(ele);
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
    if (this.value < 1) this.value = BM.default[this.name];
    setSyncItem(this.name, this.value);
  });

  $bookmarksBar.addEventListener('change', bookmarksAlias);
  $otherBookmarks.addEventListener('change', bookmarksAlias);
  
  $customCSS.addEventListener('change', function() {
    setSyncItem(this.name, this.value);
  });

  // 预览自定义头像
  chrome.storage.local.get('customIcon', items => {
    var iconBase64 = items.customIcon;
    if (iconBase64) {
      $iconPreview.style.backgroundImage = `url(${iconBase64})`;
      $iconPreview.style.backgroundSize = `19px`;
    }
  });

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
    // localStorage.customIcon = imgBase64;
    chrome.storage.local.set({customIcon: imgBase64}, () => {
      var imageData = context.getImageData(0, 0, 19, 19);
      chrome.action.setIcon({imageData: imageData});
    });

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
    chrome.storage.local.remove('customIcon', () =>{
      chrome.action.setIcon({path: '../icons/icon32.png'});
      $iconPreview.removeAttribute('style');
    });
  });

});

// 备份与恢复
document.addEventListener('DOMContentLoaded', function() {
    $('#exportBtn').addEventListener('click', exportConfig);
    
    $('#importBtn').addEventListener('click', () => {
      // 触发隐藏的文件输入控件点击事件，让用户选择文件
      $('#fileInput').click();
    });
    $('#fileInput').addEventListener('change', importConfig);

    $('#resetBtn').addEventListener('click', () => {
      if (confirm(L('resetConfigTip'))) {
        resetConfig();
      }
    });
});

function exportConfig() {
  // 使用回调 兼容mv2
  chrome.storage.local.get(null, function(localItems) {
    chrome.storage.sync.get(null, function(syncItems) {
      const localStorageData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        localStorageData[key] = localStorage.getItem(key);
      }

      const config = {
        version: chrome.runtime.getManifest().version,
        sync: syncItems,
        local: localItems,
        localStorage: localStorageData,
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const options = { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      };
      let timestamp = new Date().toLocaleString('zh-CN', options);
      timestamp = timestamp.replace(/\//g, '-').replace(/ /, '_').replace(/:/g, '.');

      const a = document.createElement("a");
      a.href = url;
      a.download = `EaseBookmarks_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url); // 清除临时URL
    });
  });
}

function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const config = JSON.parse(e.target.result);

      resetConfig(false).then(function() {
        chrome.storage.sync.set(config.sync, function() {
          chrome.storage.local.set(config.local, function() {
            for (const key in config.localStorage) {
              localStorage.setItem(key, config.localStorage[key]);
            }
            location.reload();
          });
        });
      });
    } catch (err) {
      console.error('Failed to parse JSON:', err);
    }
  };
  reader.readAsText(file);
}

function resetConfig(doReload = true) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.clear(function() {
      chrome.storage.local.clear(function() {
        localStorage.clear();

        localStorage.version = chrome.runtime.getManifest().version;
        // eventPage.js中 checkRootInfo
        chrome.bookmarks.getChildren('0', (results) => {
          var rootInfo = {
            1: results[0].title,
            2: results[1].title,
          }
          chrome.storage.sync.set({rootInfo: rootInfo}, () => {
            resolve();
            doReload && location.reload();
          });
        });
      });
    });
  });
}