var mdUrl,
  mdEnUrl = `md/usage-en.md`;

if (lang.startsWith('zh')) {
  mdUrl = 'md/usage-zh.md';
  document.documentElement.lang = 'zh-CN';
} else {
  mdUrl = `md/usage-${lang}.md`;
}

// 不存在对应语言的文档 则加载英文文档
chrome.runtime.getPackageDirectoryEntry(function(rootDir) {
  rootDir.getFile(mdUrl, {}, function(fileEntry) {
    renderMd(mdUrl, document.querySelector('#usage'));
  }, function(error) {
    renderMd(mdEnUrl, document.querySelector('#usage'));
  });
});

function renderMd(url, ele) {  
  fetch(url)
    .then((response) => response.text())
    .then(data => {
      ele.innerHTML = marked.parse(data);
    })
    .then(() => {
      $$('a[href^="chrome://"]').forEach(function(a) { 
        a.addEventListener('click', function(event) {
          event.preventDefault();
          chrome.tabs.create({ url: a.href });
        });
      });
    });
}
