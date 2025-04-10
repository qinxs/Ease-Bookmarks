"use strict";

var $bookmarksBar = $('#bookmarksBar');
var $otherBookmarks = $('#otherBookmarks');
var $customCSS = $('#customCSS');
var $minItemsPerCol = $('#minItemsPerCol');

var $iconPreview = $('.icon_preview');

if (lang.startsWith('zh')) {
  document.documentElement.lang = 'zh';
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

function resetIcon() {
  if (localStorage.customIcon) {
    delete localStorage.customIcon;
    chrome.browserAction.setIcon({path: 'icons/icon32.png'});
    $iconPreview.removeAttribute('style');
  }
}

// 备份与恢复
$('#exportBtn').addEventListener('click', exportConfig);

$('#importBtn').addEventListener('click', () => {
  handleFileSelect({
    accept: '.json', // 限制 json 文件
    onFileSelected: (files) => {
      const [file] = files;
      return importConfig(file).then(() => {
        location.reload();
      });
    }
  });
});

$('#resetBtn').addEventListener('click', () => {
  if (confirm(L('resetConfigTip'))) {
    resetIcon();
    resetConfig()
    .then(() => {
      chrome.runtime.sendMessage({ task: 'reset' }, () => {
          localStorage.version = chrome.runtime.getManifest().version;
          
          location.reload();
        });
    })
  }
});

i18nLocalize();
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
  var iconBase64 = localStorage.customIcon;
  if (iconBase64) {
    $iconPreview.style.backgroundImage = `url(${iconBase64})`;
    $iconPreview.style.backgroundSize = `19px`;
  }

  // 压缩图片需要的一些元素和对象
  var reader = new FileReader(), img = new Image(), file = null;

  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d", { willReadFrequently: true });

  $('#uploadIcon').addEventListener('click', () => {
    handleFileSelect({
      accept: 'image/*',
      onFileSelected: (files) => {
        const [file] = files;
        // 选择的文件是图片
        if (file.type.indexOf("image") == 0) {
          reader.readAsDataURL(file);    
        }
      }
    });
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

  $('#resetIcon').addEventListener('click', resetIcon);
});
