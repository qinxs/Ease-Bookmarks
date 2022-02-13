var UsageLang = chrome.i18n.getUILanguage();

var mdUrl;

if (UsageLang.startsWith('zh')) {
  mdUrl = '../md/usage-zh.md';
  document.documentElement.lang = 'zh-CN';
} else {
  mdUrl = `../md/usage-en.md`;
}

renderMd(mdUrl, document.querySelector('#nice'));

function renderMd(url, ele) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.send();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      ele.innerHTML = marked.parse(xhr.responseText);
    }
  }
}
