// 扩展通用 且相对独立的功能
'use strict';

/**
 * [多语言]
 * USE:（函数依赖 L、$$）
 * data-i18n="themeColor"
 * data-i18n="placeholder:prefix=example"
 * data-i18n="placeholder:suffix=example,title=titleTip"
 */
function i18nLocalize() {
  // 普通翻译
  const i18nDefault = (ele, i18nValue) => {
    switch (ele.tagName) {
      case 'INPUT':
      case 'TEXTAREA':
        ele.placeholder = L(i18nValue);
        break;
      default:
        ele.textContent = L(i18nValue);
    }
  }

  // 多属性或者非常规属性
  const i18nMulti = (ele, i18nValue) => {
    // console.log(i18nValue);
    i18nValue.replaceAll(' ', '').split(',').forEach(unit => {
      const [key, value] = unit.split('=');
      const [attr, modifier] = key.split(':');

      let translated = L(value);
      if (modifier === 'prefix') {
        translated = translated + ele[attr];
      } else if (modifier === 'suffix') {
        translated = ele[attr] + translated;
      }

      ele.setAttribute(attr, translated);
    });
  }

  $$('[data-i18n]').forEach(ele => {
    // console.log(ele);
    let i18nValue = ele.dataset.i18n;
    i18nValue.includes('=')
        ? i18nMulti(ele, i18nValue)
        : i18nDefault(ele, i18nValue);
  });
}

// 兼容mv2 不要直接使用chromeAPI.then
function exportConfig() {
  Promise.all([
   new Promise(resolve => chrome.storage.sync.get(null, resolve)),
   new Promise(resolve => chrome.storage.local.get(null, resolve)),
  ]).then(([syncItems, localItems]) => {
    const { name, version } = chrome.runtime.getManifest();
    const lang = chrome.i18n.getUILanguage();
    
    const options = { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    };
    let time = new Date().toLocaleString(lang, options);
    time = time.replace(/\//g, '-').replace(/ /, '_').replace(/:/g, '.');

    const localStorageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      localStorageData[key] = localStorage.getItem(key);
    }
    const config = {
      version: version,
      sync: syncItems,
      local: localItems,
      localStorage: localStorageData,
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${time}.json`;
    a.click();
    URL.revokeObjectURL(url); // 清除临时URL
  });
}

function importConfig(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(e) {
      try {
        const config = JSON.parse(e.target.result);

        resetConfig().then(() => Promise.all([
          new Promise(resolve => chrome.storage.sync.set(config.sync, resolve)),
          new Promise(resolve => chrome.storage.local.set(config.local, resolve)),
        ]))
        .then(() => {
          for (const key in config.localStorage) {
            localStorage.setItem(key, config.localStorage[key]);
          }

          resolve('Import completed');
        })
        .catch(reject);
      } catch (err) {
        alert(`Failed to parse JSON: ${err.message}`);
        reject(err);
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsText(file);
  });
}

function resetConfig() {
  return Promise.all([
    new Promise(resolve => chrome.storage.sync.clear(resolve)),
    new Promise(resolve => chrome.storage.local.clear(resolve)),
    localStorage.clear(),
  ]);
}

function handleFileSelect(options = {}) {
  const {
    onFileSelected, // 必须参数：文件选择后的回调函数
    accept = '',    // 可选参数：文件类型限制
    multiple = false // 可选参数：是否允许多选
  } = options;

  const input = document.createElement('input');
  input.type = 'file';
  input.style.display = 'none';
  input.accept = accept;
  input.multiple = multiple;

  input.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      cleanup();
      return;
    }

    try {
      await Promise.resolve(onFileSelected(files));
    } finally {
      cleanup();
    }
  });

  document.body.appendChild(input);
  input.click();

  function cleanup() {
    input.removeEventListener('change', this);
    document.body.removeChild(input);
  }
}