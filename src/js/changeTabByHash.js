var lastNavA = null;
var lastPage = null;
var defaultHash = '#options';

window.addEventListener('hashchange', function() {
  var page = location.hash || defaultHash;

  if (lastNavA) lastNavA.classList.remove('active');
  if (lastPage) lastPage.classList.remove('active');
  
  var newNavA = $(`.btns > a[href="${page}"]`);
  newNavA.classList.add('active');

  var newPage = $(`${page}`);
  newPage.classList.add('active');
  
  window.scrollTo(0, 0);
  
  lastNavA = newNavA;
  lastPage = newPage;
}, false);

window.dispatchEvent(new Event('hashchange'));
