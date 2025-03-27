JSON.stringify2 = value => typeof value === 'object' 
  ? JSON.stringify(value) 
  : value;
JSON.parse2 = (...args) => {
  try {
    return JSON.parse(...args);
  } catch {
    return args[0];
  }
}

class TableRenderer {
  constructor(container, defaultSys, userSettings) {
    this.container = container;
    this.defaultSys = defaultSys;
    this.userSettings = userSettings;
    this.editInput = null;
    this.editing = false;
    this.init();
  }

  init() {
    this.table = this.render();
    this.editInput = this.table.querySelector('#cTable-input');
    this._events();

    return this;
  }

  render() {
    let table = document.createElement('table');

    // 添加表头
    let thead = document.createElement('thead');
    let headTr = document.createElement('tr');

    let parametersUrl = lang.startsWith('zh')
        ? 'https://github.com/qinxs/Ease-Bookmarks#内置参数'
        : 'https://github.com/qinxs/Ease-Bookmarks/blob/main/README_en.md#built-in-parameters';
    headTr.innerHTML = `<th>Key</th>
      <th class="cell-info">Value
        <a href="${parametersUrl}">
          <img src="icons/i.svg">
        </a>
        <input id="cTable-input" hidden/>
      </th>
      <th class="cell-operation"></th>`;
    thead.appendChild(headTr);
    table.appendChild(thead);

    // 添加表格内容
    let tbody = document.createElement('tbody');
    table.appendChild(tbody);

    let trTemple = createTrTemple();
    
    for (const [key, value] of Object.entries(this.defaultSys)) {
      let tr = trTemple.cloneNode(true);

      if (this.userSettings[key] != value) {
        tr.classList.add('has-user-value');
      }

      let tdKey = tr.firstChild;
      tdKey.textContent = key;

      let tdValue = tdKey.nextSibling;
      tdValue.setAttribute('name', key);
      tdValue.textContent = JSON.stringify2(this.userSettings[key]);

      let tdReset = tdValue.nextSibling;
      tdReset.className = 'cell-reset';

      tbody.appendChild(tr);
    }

    this.container.appendChild(table);

    return table;

    function createTrTemple() {
      let tr = document.createElement('tr');

      let tdKey = document.createElement('td');

      let tdValue = document.createElement('td');
      tdValue.className = 'cell-value';

      let tdReset = document.createElement('td');
      tdReset.className = 'cell-reset';

      tr.append(tdKey, tdValue, tdReset);

      return tr;
    }
  }

  setEditStatus(trEle, cellReset = false) {
    trEle = trEle.closest('tr');
    if (!trEle) return;
    let tdValue = trEle.querySelector('.cell-value');
 
    this.editInput.setAttribute('name', tdValue.getAttribute('name'));
    this.editInput.value = tdValue.textContent;

    tdValue.insertAdjacentElement('beforeend', this.editInput);
    if (!cellReset) {
      this.editInput.hidden = false;
      this.editInput.focus();
      this.editing = true;
    }
  }

  cancelEditStatus() {
    this.editInput.hidden = true;
    this.editing = false;
  }
  _events() {
    this.table.addEventListener('click', event => {
      let target = event.target;
      if (target.classList.contains('cell-value')) {
        event.preventDefault();
        event.stopPropagation();
        this.setEditStatus(target);
      }
    });

    document.addEventListener('click', event => {
      let target = event.target;
      
      if (target.classList.contains('cell-reset')) {
        let tdValue = target.closest('tr').querySelector('.cell-value');

        let name = tdValue.getAttribute('name');
        let defaultValue = JSON.stringify2(this.defaultSys[name]);

        this.setEditStatus(target, true);
        this.editInput.value = defaultValue;
        this.editInput.dispatchEvent(new UIEvent('change'));
      }

      if (this.editing && target !== this.editInput) {
        this.cancelEditStatus();
      }
    });

    this.editInput.addEventListener('change', event => {
      let { name, value } = event.target;
      let tr = this.editInput.closest('tr');

      // console.log(name, value);
      this.editInput.closest('td').textContent = JSON.stringify2(value);

      if ( value != this.defaultSys[name]) {
        tr.classList.add('has-user-value');
      } else {
        tr.classList.remove('has-user-value');
      }

      if (name == 'keepLastSearchValue' && value == 0) {
        localStorage.removeItem('LastSearchValue');
      }

      this.trigger('configCanged', { name, value });
    });
  }

  on(eventType, callback) {
    this.table.addEventListener(eventType, evt => {
      // console.log(evt);
      callback.call(this, evt.detail);
    });

    return this;
  }

  trigger(eventType, detail) {
    let evt = new CustomEvent(eventType, { detail });
    this.table.dispatchEvent(evt);
    
    return this;
  }
}

loadSettings.then(() => {
  let container = document.querySelector('#configTable');
  
  new TableRenderer(container, BM.defaultSys, BM.settings)
    .on('configCanged', detail => {
      // console.log(detail);
      BM.set(detail.name, detail.value);
    });
});
