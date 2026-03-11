function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

let sidebarSortableState = null;

function wrapSidebarPanel(panel) {
  const collapsible = document.createElement('div');
  collapsible.className = 'sidebar-expand-collapsible';
  const inner = document.createElement('div');
  inner.className = 'sidebar-expand-collapsible-inner';
  panel.parentNode.insertBefore(collapsible, panel);
  inner.appendChild(panel);
  collapsible.appendChild(inner);
  panel.removeAttribute('hidden');
  return collapsible;
}

function syncSidebarExpandableItem(button, collapsible) {
  const isExpanded = button.getAttribute('aria-expanded') === 'true';
  collapsible.classList.toggle('is-expanded', isExpanded);
}

function toggleSidebarExpandableItem(button, collapsible) {
  const isExpanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!isExpanded));
  syncSidebarExpandableItem(button, collapsible);
}

function initSidebarExpandableItems() {
  const expandableButtons = document.querySelectorAll('[data-sidebar-expand-toggle]');

  expandableButtons.forEach((button) => {
    const panelId = button.getAttribute('aria-controls');
    if (!panelId) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const collapsible = wrapSidebarPanel(panel);
    syncSidebarExpandableItem(button, collapsible);
    button.addEventListener('click', () => toggleSidebarExpandableItem(button, collapsible));
  });
}

function sidebarSortableFlip(list, mutate) {
  const children = Array.from(list.children);
  const rects = new Map(children.map((el) => [el, el.getBoundingClientRect()]));

  mutate();

  Array.from(list.children).forEach((el) => {
    const prev = rects.get(el);
    if (!prev) return;
    const cur = el.getBoundingClientRect();
    const dy = prev.top - cur.top;
    if (Math.abs(dy) < 1) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
      { duration: 150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  });
}

function sidebarSortableStart(item, clientX, clientY) {
  const list = item.closest('[data-sidebar-sortable-list]');
  if (!list) return;

  const rect = item.getBoundingClientRect();
  const offsetX = clientX - rect.left;
  const offsetY = clientY - rect.top;

  const ghost = item.cloneNode(true);
  ghost.removeAttribute('data-sidebar-sortable-item');
  ghost.classList.add('sidebar-sortable-ghost');

  let height = rect.height;
  let width = rect.width;
  if (item.classList.contains('sidebar-folder')) {
    const row = item.querySelector('.sidebar-folder-row');
    if (row) {
      const rowRect = row.getBoundingClientRect();
      height = rowRect.height;
    }
  }

  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${width}px`,
    height: `${height}px`,
    margin: '0',
    zIndex: '9999',
    pointerEvents: 'none',
    willChange: 'transform',
  });
  document.body.appendChild(ghost);

  item.classList.add('is-dragging');
  list.classList.add('is-sorting');

  sidebarSortableState = { item, list, ghost, offsetX, offsetY, dropFolder: null };
}

function sidebarSortableClearFolderTarget() {
  const s = sidebarSortableState;
  if (!s) return;
  if (s.dropFolder) {
    s.dropFolder.classList.remove('is-drop-target');
    s.dropFolder = null;
  }
}

function getSidebarRootList(list) {
  if (list && list.classList.contains('sidebar-folder-children')) {
    const folder = list.closest('.sidebar-folder');
    return folder ? folder.parentElement : list;
  }
  return list;
}

function pointInRect(x, y, r) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function sidebarSortableMove(clientX, clientY) {
  const s = sidebarSortableState;
  if (!s) return;

  s.ghost.style.left = `${clientX - s.offsetX}px`;
  s.ghost.style.top = `${clientY - s.offsetY}px`;

  const rootList = getSidebarRootList(s.list);
  const isFolder = s.item.classList.contains('sidebar-folder');
  const folders = isFolder ? [] : Array.from(rootList.querySelectorAll('.sidebar-folder'));

  let hoveredFolder = null;
  for (const folder of folders) {
    if (folder.contains(s.item)) continue;
    const r = folder.getBoundingClientRect();
    if (pointInRect(clientX, clientY, r)) {
      hoveredFolder = folder;
      break;
    }
  }

  if (hoveredFolder) {
    if (s.dropFolder !== hoveredFolder) {
      sidebarSortableClearFolderTarget();
      hoveredFolder.classList.add('is-drop-target');
      s.dropFolder = hoveredFolder;
    }
    return;
  }

  sidebarSortableClearFolderTarget();

  if (s.list.classList.contains('sidebar-folder-children')) {
    const currentFolder = s.list.closest('.sidebar-folder');
    const insideCurrentFolder = currentFolder && pointInRect(clientX, clientY, currentFolder.getBoundingClientRect());

    if (!insideCurrentFolder) {
      const rootSortable = Array.from(rootList.children).filter(
        (el) => (el.hasAttribute('data-sidebar-sortable-item') || el.classList.contains('sidebar-folder')) && el !== s.item,
      );
      const nextInRoot = rootSortable.find((el) => {
        const r = el.getBoundingClientRect();
        return clientY < r.top + r.height / 2;
      });
      const rootAnchor = rootList.querySelector('.sidebar-list-item-all-objects');
      sidebarSortableFlip(rootList, () => {
        if (nextInRoot) {
          rootList.insertBefore(s.item, nextInRoot);
        } else if (rootAnchor) {
          rootList.insertBefore(s.item, rootAnchor);
        } else {
          rootList.appendChild(s.item);
        }
      });
      s.list = rootList;
    }
  }

  const sortableChildren = Array.from(s.list.children).filter(
    (el) => (el.hasAttribute('data-sidebar-sortable-item') || el.classList.contains('sidebar-folder')) && el !== s.item,
  );

  const next = sortableChildren.find((el) => {
    const r = el.getBoundingClientRect();
    return clientY < r.top + r.height / 2;
  });

  const anchor = s.list.querySelector('.sidebar-list-item-all-objects');
  if (next) {
    if (s.item.nextElementSibling !== next) {
      sidebarSortableFlip(s.list, () => s.list.insertBefore(s.item, next));
    }
  } else if (s.list.lastElementChild !== s.item) {
    sidebarSortableFlip(s.list, () => {
      if (anchor) {
        s.list.insertBefore(s.item, anchor);
      } else {
        s.list.appendChild(s.item);
      }
    });
  }
}

function sidebarSortableEnd() {
  const s = sidebarSortableState;
  if (!s) return;
  sidebarSortableState = null;

  if (s.dropFolder) {
    s.dropFolder.classList.remove('is-drop-target');
    const children = s.dropFolder.querySelector('.sidebar-folder-children');
    if (children) {
      s.item.classList.remove('is-dragging');
      children.appendChild(s.item);
      children.hidden = false;
      const toggle = s.dropFolder.querySelector('.sidebar-folder-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      initSidebarSortableItem(s.item, children);
    }
  }

  s.ghost.remove();
  s.item.classList.remove('is-dragging');
  s.list.classList.remove('is-sorting');
}

function initSidebarSortableItem(item, list) {
  item.setAttribute('draggable', 'false');

  const existing = item._sidebarPointerDown;
  if (existing) item.removeEventListener('pointerdown', existing);

  const DRAG_THRESHOLD = 4;
  function handler(e) {
    if (e.button !== 0) return;
    if (item.classList.contains('sidebar-folder')) {
      const inner = e.target.closest('[data-sidebar-sortable-item]');
      if (inner && inner !== item && item.contains(inner)) return;
    }
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!started && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      if (!started) {
        started = true;
        const folderChildren = item.closest('.sidebar-folder-children');
        if (folderChildren) {
          sidebarSortableStart(item, startX, startY);
        } else {
          sidebarSortableStart(item, startX, startY);
        }
      }
      sidebarSortableMove(ev.clientX, ev.clientY);
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (started) sidebarSortableEnd();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  item._sidebarPointerDown = handler;
  item.addEventListener('pointerdown', handler);
}

const SIDEBAR_DOTS_VERTICAL_SVG =
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 3C8 3.55228 7.55228 4 7 4C6.44772 4 6 3.55228 6 3C6 2.44772 6.44772 2 7 2C7.55228 2 8 2.44772 8 3ZM8 7C8 7.55228 7.55228 8 7 8C6.44772 8 6 7.55228 6 7C6 6.44772 6.44772 6 7 6C7.55228 6 8 6.44772 8 7ZM7 12C7.55228 12 8 11.5523 8 11C8 10.4477 7.55228 10 7 10C6.44772 10 6 10.4477 6 11C6 11.5523 6.44772 12 7 12Z" fill="currentColor"/>';

const SIDEBAR_EDIT_SVG =
  '<path d="M10.9983 1C11.5291 1.00016 12.038 1.21157 12.4133 1.58691C12.7886 1.96232 13.0002 2.47111 13.0002 3.00195C13.0002 3.53291 12.7887 4.04249 12.4133 4.41797L11.3752 5.45508C11.3683 5.46301 11.3632 5.47286 11.3557 5.48047C11.3473 5.48896 11.3363 5.49519 11.3274 5.50293L5.77075 11.0605C5.3783 11.453 5.14402 11.6896 4.87524 11.8828C4.64346 12.0494 4.39417 12.1906 4.13208 12.3037C3.82805 12.4348 3.50455 12.5148 2.96606 12.6494L1.62134 12.9854C1.4511 13.0278 1.27085 12.9775 1.14673 12.8535C1.02261 12.7294 0.972418 12.5492 1.01489 12.3789L1.35278 11.0293C1.48696 10.4926 1.56606 10.1703 1.69653 9.86719C1.80909 9.60577 1.94966 9.35731 2.11548 9.12598C2.30771 8.85784 2.54247 8.62333 2.93286 8.23145L8.49634 2.64746L8.50122 2.64258L9.58618 1.58203C9.96125 1.20925 10.4693 1 10.9983 1ZM3.64087 8.9375C3.2287 9.35125 3.06218 9.52085 2.92798 9.70801C2.804 9.88097 2.69866 10.0672 2.6145 10.2627C2.52343 10.4743 2.46422 10.7046 2.32251 11.2715L2.18677 11.8125L2.7229 11.6787C3.29174 11.5365 3.5233 11.4773 3.7356 11.3857C3.93166 11.3012 4.11887 11.1959 4.29224 11.0713C4.47989 10.9363 4.64919 10.768 5.06372 10.3535L10.2883 5.12793L8.85181 3.70508L3.64087 8.9375ZM10.9983 2C10.7326 2 10.4772 2.10608 10.2893 2.29395L10.2854 2.29785L9.56274 3.00195L10.9954 4.4209L11.7063 3.71094C11.8942 3.523 12.0002 3.26769 12.0002 3.00195C12.0002 2.73632 11.8941 2.48182 11.7063 2.29395C11.5185 2.10614 11.2639 2.00016 10.9983 2Z" fill="currentColor"/>';

const SIDEBAR_TRASH_SVG =
  '<path d="M7.36426 0.500488C7.70594 0.503787 7.98389 0.521689 8.22754 0.606934C8.77324 0.79793 9.2026 1.22723 9.39355 1.77295C9.50709 2.09778 9.5 2.48398 9.5 3.00049H12.5C12.7759 3.00059 12.9997 3.2237 13 3.49951C13 3.74116 12.8285 3.94315 12.6006 3.98975L12.5 4.00049H11.9971C11.997 4.01971 11.9984 4.03953 11.9961 4.05908L11.4053 9.08252C11.3112 9.88235 11.2362 10.5288 11.1123 11.0347C10.9851 11.5535 10.7929 11.9875 10.4258 12.3296C10.3975 12.3559 10.3683 12.3817 10.3389 12.4067C9.95614 12.7313 9.5029 12.8713 8.97266 12.937C8.45566 13.001 7.80549 13.0005 7 13.0005C6.19449 13.0005 5.54435 13.001 5.02734 12.937C4.49707 12.8713 4.04387 12.7314 3.66113 12.4067C3.63165 12.3817 3.60251 12.3559 3.57422 12.3296C3.20707 11.9875 3.01491 11.5535 2.8877 11.0347C2.76375 10.5288 2.68882 9.88235 2.59473 9.08252L2.00391 4.05908L2.00293 4.00049H1.5L1.39941 3.99072C1.17165 3.94404 1 3.74108 1 3.49951C1.00031 3.22374 1.2242 3.00066 1.5 3.00049H4.5C4.5 2.48398 4.49291 2.09778 4.60645 1.77295C4.7974 1.22723 5.22676 0.79793 5.77246 0.606934C6.01611 0.521689 6.29406 0.503787 6.63574 0.500488H7.36426ZM3.58789 8.96631C3.68498 9.79156 3.75353 10.3655 3.85938 10.7974C3.96203 11.2159 4.08614 11.44 4.25586 11.5981C4.27282 11.6139 4.29093 11.6291 4.30859 11.644C4.48551 11.794 4.72179 11.8918 5.14941 11.9448C5.59079 11.9995 6.16872 12.0005 7 12.0005C7.83124 12.0005 8.40921 11.9995 8.85059 11.9448C9.27817 11.8918 9.5145 11.794 9.69141 11.644C9.70905 11.6291 9.7272 11.6139 9.74414 11.5981C9.91386 11.44 10.038 11.2159 10.1406 10.7974C10.2465 10.3655 10.315 9.79155 10.4121 8.96631L10.9971 4.00049H3.00293L3.58789 8.96631ZM5.4375 5.50439C5.67712 5.47446 5.89901 5.61925 5.97363 5.83936L5.99609 5.93799L6.49609 9.93799C6.53007 10.2117 6.33609 10.4621 6.0625 10.4966C5.82301 10.5265 5.60113 10.3815 5.52637 10.1616L5.50391 10.063L5.00391 6.06299L5.00098 5.96143C5.01888 5.72963 5.19791 5.53457 5.4375 5.50439ZM8.5625 5.50439C8.80209 5.53457 8.98112 5.72963 8.99902 5.96143L8.99609 6.06299L8.49609 10.063L8.47363 10.1616C8.39887 10.3815 8.17699 10.5265 7.9375 10.4966C7.6639 10.4621 7.46993 10.2117 7.50391 9.93799L8.00391 5.93799L8.02637 5.83936C8.10099 5.61925 8.32287 5.47446 8.5625 5.50439ZM7 1.50049C6.39957 1.50049 6.22666 1.50784 6.10254 1.55127C5.8443 1.64177 5.64124 1.84477 5.55078 2.10303C5.50747 2.22712 5.5 2.40069 5.5 3.00049H8.5C8.5 2.40069 8.49253 2.22712 8.44922 2.10303C8.35876 1.84477 8.1557 1.64177 7.89746 1.55127C7.77334 1.50784 7.60043 1.50049 7 1.50049Z" fill="currentColor"/>';

function createSidebarFolder(list, name) {
  const folderId = 'sidebar-folder-' + Date.now();

  const folder = document.createElement('div');
  folder.className = 'sidebar-folder';
  folder.setAttribute('data-sidebar-sortable-item', '');

  const row = document.createElement('div');
  row.className = 'sidebar-folder-row';

  const toggle = document.createElement('button');
  toggle.className = 'sidebar-folder-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', folderId);

  toggle.innerHTML = `
    <span class="sidebar-folder-icon">
      <span class="sidebar-folder-icon-state sidebar-folder-icon-collapsed" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.58594 1C4.98369 1.00004 5.36522 1.1582 5.64648 1.43945L7.06055 2.85352C7.15427 2.94724 7.28152 2.99995 7.41406 3H10.5C12.1568 3 13.5 4.34316 13.5 6V9.5C13.5 11.1569 12.1569 12.5 10.5 12.5H3.5C1.84316 12.5 0.5 11.1568 0.5 9.5V4C0.500016 2.34317 1.84317 1.00002 3.5 1H4.58594ZM3.5 2C2.39545 2.00002 1.50002 2.89545 1.5 4V9.5C1.5 10.6046 2.39544 11.5 3.5 11.5H10.5C11.6046 11.5 12.5 10.6046 12.5 9.5V6C12.5 4.89544 11.6046 4 10.5 4H7.41406C7.0163 3.99995 6.63478 3.84181 6.35352 3.56055L4.93945 2.14648C4.84572 2.05277 4.71848 2.00004 4.58594 2H3.5Z" fill="currentColor"/>
        </svg>
      </span>
      <span class="sidebar-folder-icon-state sidebar-folder-icon-expanded" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.33691 1.00049C4.55752 1.00049 4.74968 0.996967 4.93555 1.0415C5.0884 1.07821 5.23508 1.1391 5.36914 1.22119C5.53217 1.32114 5.6662 1.45966 5.82227 1.61572L6.88477 2.67822C7.07437 2.86783 7.11461 2.90353 7.15332 2.92725C7.19789 2.95447 7.24707 2.97462 7.29785 2.98682C7.34192 2.99733 7.3956 3.00049 7.66309 3.00049H10.5C11.7371 3.00048 12.7616 3.89952 12.9619 5.07959C13.0685 5.10849 13.1731 5.14938 13.2734 5.2085C13.5822 5.3905 13.8159 5.67687 13.9316 6.01611C14.0104 6.24727 14.0081 6.48066 13.9814 6.7085C13.9552 6.93225 13.8983 7.20544 13.832 7.52588L13.6494 8.41162C13.5335 8.97265 13.4413 9.42063 13.3389 9.77979C13.2347 10.1449 13.1106 10.4529 12.916 10.729C12.5991 11.1784 12.1644 11.5322 11.6602 11.7515C11.3502 11.8862 11.0234 11.9451 10.6445 11.9731C10.272 12.0007 9.81517 12.0005 9.24219 12.0005H3C1.61942 12.0005 0.500219 10.881 0.5 9.50049V4.70068C0.5 4.14909 0.500032 3.70471 0.529297 3.34619C0.559055 2.98198 0.621753 2.66172 0.772461 2.36572C1.01212 1.89537 1.3949 1.51264 1.86523 1.27295C2.16132 1.12213 2.48137 1.05956 2.8457 1.02979C3.20429 1.00049 3.64839 1.00049 4.2002 1.00049H4.33691ZM5.59082 6.00049C5.35357 6.00049 5.20207 6.00074 5.08594 6.00928C4.97609 6.01737 4.93195 6.03126 4.9082 6.0415C4.82492 6.07752 4.75303 6.1357 4.7002 6.20947C4.68515 6.23059 4.6619 6.27125 4.63086 6.37646C4.59797 6.4881 4.56579 6.63613 4.51562 6.86768L3.61914 11.0005H9.24219C9.83002 11.0005 10.2442 11.0003 10.5713 10.9761C10.8919 10.9523 11.0949 10.907 11.2617 10.8345C11.5978 10.6883 11.8874 10.4523 12.0986 10.1528C12.2034 10.0042 12.2888 9.81455 12.377 9.50537C12.4669 9.18997 12.551 8.784 12.6699 8.2085L12.8525 7.32275C12.9224 6.98485 12.9684 6.76236 12.9883 6.59229C13.0075 6.4277 12.9944 6.3663 12.9854 6.33936C12.9468 6.22625 12.8686 6.13052 12.7656 6.06982C12.7412 6.0555 12.6843 6.03065 12.5186 6.01611C12.3479 6.00117 12.1209 6.00049 11.7754 6.00049H5.59082ZM4.2002 2.00049C3.63189 2.00049 3.23518 2.00068 2.92676 2.02588C2.62473 2.05058 2.45091 2.09662 2.31934 2.16357C2.03717 2.30739 1.80687 2.53764 1.66309 2.81982C1.59622 2.95136 1.55007 3.12544 1.52539 3.42725C1.50022 3.73561 1.5 4.13263 1.5 4.70068V9.50049C1.50018 10.1931 1.97027 10.7744 2.6084 10.9468L3.53809 6.65576C3.58522 6.43821 3.62615 6.24835 3.67188 6.09326C3.71942 5.93212 3.78181 5.77527 3.88672 5.62842C4.04553 5.40627 4.26196 5.23172 4.5127 5.12354C4.6785 5.05203 4.84507 5.02456 5.0127 5.01221C5.17397 5.00035 5.36819 5.00049 5.59082 5.00049H11.9121C11.706 4.41831 11.1528 4.00048 10.5 4.00049H7.66309C7.44251 4.00049 7.2503 4.00399 7.06445 3.95947C6.91162 3.92278 6.76491 3.86184 6.63086 3.77979C6.46782 3.67987 6.33377 3.5413 6.17773 3.38525L5.11523 2.32275C4.92575 2.13327 4.88535 2.09746 4.84668 2.07373C4.80209 2.04647 4.75296 2.02637 4.70215 2.01416C4.65806 2.00363 4.60455 2.00049 4.33691 2.00049H4.2002Z" fill="currentColor"/>
        </svg>
      </span>
    </span>
    <span class="sidebar-folder-name">${name != null && name !== '' ? name : ''}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'sidebar-folder-actions';
  const optionsBtn = document.createElement('button');
  optionsBtn.className = 'icon-btn icon-btn-ghost icon-btn-size-20L';
  optionsBtn.type = 'button';
  optionsBtn.setAttribute('aria-label', 'Mais opções da pasta');
  optionsBtn.innerHTML = `
    <span class="icon-btn-icon">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_DOTS_VERTICAL_SVG}</svg>
    </span>
  `;
  actions.appendChild(optionsBtn);

  const children = document.createElement('div');
  children.className = 'sidebar-folder-children';
  children.id = folderId;
  children.setAttribute('data-sidebar-sortable-list', '');

  const emptyState = document.createElement('div');
  emptyState.className = 'sidebar-folder-empty text-caption';
  emptyState.setAttribute('aria-hidden', 'true');
  emptyState.textContent = 'No items';
  children.appendChild(emptyState);
  children.hidden = true;

  row.appendChild(toggle);
  row.appendChild(actions);
  folder.appendChild(row);
  folder.appendChild(children);

  optionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openSidebarFolderOptionsPopover(folder, optionsBtn);
  });

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    children.hidden = expanded;
  });

  toggle.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startSidebarFolderRename(folder);
  });

  list.insertBefore(folder, list.firstChild);
  initSidebarSortableItem(folder, list);
  startSidebarFolderRename(folder);

  return folder;
}

const SIDEBAR_FOLDER_ICON_LINE_SVG =
  '<path d="M4.58594 1C4.98369 1.00004 5.36522 1.1582 5.64648 1.43945L7.06055 2.85352C7.15427 2.94724 7.28152 2.99995 7.41406 3H10.5C12.1568 3 13.5 4.34316 13.5 6V9.5C13.5 11.1569 12.1569 12.5 10.5 12.5H3.5C1.84316 12.5 0.5 11.1568 0.5 9.5V4C0.500016 2.34317 1.84317 1.00002 3.5 1H4.58594ZM3.5 2C2.39545 2.00002 1.50002 2.89545 1.5 4V9.5C1.5 10.6046 2.39544 11.5 3.5 11.5H10.5C11.6046 11.5 12.5 10.6046 12.5 9.5V6C12.5 4.89544 11.6046 4 10.5 4H7.41406C7.0163 3.99995 6.63478 3.84181 6.35352 3.56055L4.93945 2.14648C4.84572 2.05277 4.71848 2.00004 4.58594 2H3.5Z" fill="currentColor"/>';

const SIDEBAR_HELP_ICON_SEARCH_SVG =
  '<path d="M6 0.5C9.03757 0.5 11.5 2.96243 11.5 6C11.5 7.33872 11.0206 8.56482 10.2256 9.51855L12.8535 12.1465L12.918 12.2246C13.0461 12.4187 13.0244 12.6827 12.8535 12.8535C12.6827 13.0244 12.4187 13.0461 12.2246 12.918L12.1465 12.8535L9.51855 10.2256C8.56482 11.0206 7.33872 11.5 6 11.5C2.96243 11.5 0.5 9.03757 0.5 6C0.5 2.96243 2.96243 0.5 6 0.5ZM6 1.5C3.51472 1.5 1.5 3.51472 1.5 6C1.5 8.48528 3.51472 10.5 6 10.5C8.48528 10.5 10.5 8.48528 10.5 6C10.5 3.51472 8.48528 1.5 6 1.5Z" fill="currentColor"/>';
const SIDEBAR_HELP_ICON_HELP_CIRCLE_SVG =
  '<path d="M7 0.5C10.5899 0.5 13.5 3.41015 13.5 7C13.5 10.5899 10.5899 13.5 7 13.5C3.41015 13.5 0.5 10.5899 0.5 7C0.5 3.41015 3.41015 0.5 7 0.5ZM7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5ZM7 9C7.3727 9.00003 7.6747 9.30212 7.6748 9.6748C7.6748 10.0476 7.37277 10.3496 7 10.3496C6.62721 10.3496 6.3252 10.0476 6.3252 9.6748C6.3253 9.3021 6.62727 9 7 9ZM5.12988 4.7998C5.48605 3.58942 6.77234 3.21652 7.76562 3.57812C9.26098 4.12307 9.44688 6.13294 8.05469 6.92188C7.89276 7.01359 7.79375 7.06574 7.69629 7.12402C7.606 7.17803 7.56696 7.20876 7.54785 7.22852C7.54401 7.2319 7.50102 7.25486 7.50098 7.5C7.50078 7.77565 7.27655 7.99947 7.00098 8C6.72496 8 6.50117 7.77597 6.50098 7.5C6.50102 7.12297 6.57206 6.79911 6.8291 6.5332C6.93995 6.41859 7.06776 6.33433 7.18262 6.26562C7.29033 6.2012 7.43621 6.12273 7.56152 6.05176C8.20014 5.68984 8.12963 4.77513 7.42383 4.51758C6.82994 4.30134 6.24218 4.56102 6.08887 5.08203L5.60938 4.94043L5.12988 4.7998ZM6.08887 5.08203C6.01074 5.34642 5.73234 5.49745 5.46777 5.41992C5.20335 5.34182 5.05233 5.06439 5.12988 4.7998L6.08887 5.08203Z" fill="currentColor"/>';
const SIDEBAR_HELP_ICON_COMMENT_SVG =
  '<path d="M8.5 1.5C9.19178 1.5 9.74067 1.50003 10.1826 1.53613C10.6304 1.57272 11.0127 1.64901 11.3623 1.82715C11.9265 2.11472 12.3853 2.57347 12.6729 3.1377C12.851 3.48732 12.9273 3.86958 12.9639 4.31738C13 4.75934 13 5.30822 13 6V6.5C13 7.19178 13 7.74066 12.9639 8.18262C12.9273 8.63042 12.851 9.01268 12.6729 9.3623C12.3853 9.92653 11.9265 10.3853 11.3623 10.6729C11.0127 10.851 10.6304 10.9273 10.1826 10.9639C9.74067 11 9.19178 11 8.5 11H5.83203C5.41298 11 5.25675 11.0012 5.11035 11.0244C4.86158 11.0638 4.6221 11.1502 4.40527 11.2783C4.27781 11.3537 4.15656 11.452 3.83398 11.7188C3.5727 11.9348 3.35608 12.1144 3.17773 12.2422C3.0064 12.3649 2.80852 12.487 2.58301 12.5273C2.0202 12.6279 1.45497 12.3621 1.17383 11.8643C1.06118 11.6647 1.02921 11.434 1.01465 11.2236C0.99951 11.0049 1 10.7245 1 10.3857V6C1 5.30822 1.00003 4.75934 1.03613 4.31738C1.07272 3.86958 1.14901 3.48732 1.32715 3.1377C1.61472 2.57348 2.07348 2.11472 2.6377 1.82715C2.98731 1.64901 3.36959 1.57272 3.81738 1.53613C4.25933 1.50003 4.80822 1.5 5.5 1.5H8.5ZM5.5 2.5C4.79169 2.5 4.29023 2.50022 3.89844 2.53223C3.51265 2.56377 3.27691 2.62345 3.0918 2.71777C2.71555 2.90951 2.40951 3.21555 2.21777 3.5918C2.12346 3.77691 2.06377 4.01264 2.03223 4.39844C2.00022 4.79023 2 5.29168 2 6V10.3857C2 10.7393 2.00054 10.9783 2.0127 11.1543C2.02518 11.3346 2.04706 11.3768 2.04492 11.373C2.11728 11.5008 2.26264 11.5688 2.40723 11.543C2.41429 11.5405 2.46562 11.5219 2.5957 11.4287C2.73913 11.3259 2.92362 11.1737 3.19629 10.9482C3.4955 10.7009 3.68549 10.5417 3.89648 10.417C4.22178 10.2247 4.58088 10.0962 4.9541 10.0371C5.19616 9.99878 5.44392 10 5.83203 10H8.5C9.20831 10 9.70977 9.99978 10.1016 9.96777C10.4874 9.93623 10.7231 9.87654 10.9082 9.78223C11.2845 9.59049 11.5905 9.28445 11.7822 8.9082C11.8765 8.72309 11.9362 8.48736 11.9678 8.10156C11.9998 7.70977 12 7.20832 12 6.5V6C12 5.29168 11.9998 4.79023 11.9678 4.39844C11.9362 4.01264 11.8765 3.77691 11.7822 3.5918C11.5905 3.21555 11.2845 2.90951 10.9082 2.71777C10.7231 2.62346 10.4874 2.56377 10.1016 2.53223C9.70977 2.50022 9.20831 2.5 8.5 2.5H5.5Z" fill="currentColor"/>';
const SIDEBAR_HELP_ICON_COMMAND_SVG =
  '<path d="M10.25 1.5C11.4926 1.5 12.5 2.50736 12.5 3.75C12.5 4.99264 11.4926 6 10.25 6H9V8H10.25C11.4926 8 12.5 9.00736 12.5 10.25C12.5 11.4926 11.4926 12.5 10.25 12.5C9.00736 12.5 8 11.4926 8 10.25V9H6V10.25C6 11.4926 4.99264 12.5 3.75 12.5C2.50736 12.5 1.5 11.4926 1.5 10.25C1.5 9.00736 2.50736 8 3.75 8H5V6H3.75C2.50736 6 1.5 4.99264 1.5 3.75C1.5 2.50736 2.50736 1.5 3.75 1.5C4.99264 1.5 6 2.50736 6 3.75V5H8V3.75C8 2.50736 9.00736 1.5 10.25 1.5ZM3.75 9C3.05964 9 2.5 9.55964 2.5 10.25C2.5 10.9404 3.05964 11.5 3.75 11.5C4.44036 11.5 5 10.9404 5 10.25V9H3.75ZM9 10.25C9 10.9404 9.55964 11.5 10.25 11.5C10.9404 11.5 11.5 10.9404 11.5 10.25C11.5 9.55964 10.9404 9 10.25 9H9V10.25ZM6 8H8V6H6V8ZM3.75 2.5C3.05964 2.5 2.5 3.05964 2.5 3.75C2.5 4.44036 3.05964 5 3.75 5H5V3.75C5 3.05964 4.44036 2.5 3.75 2.5ZM10.25 2.5C9.55964 2.5 9 3.05964 9 3.75V5H10.25C10.9404 5 11.5 4.44036 11.5 3.75C11.5 3.05964 10.9404 2.5 10.25 2.5Z" fill="currentColor"/>';
const SIDEBAR_HELP_ICON_UNLOCKED_SVG =
  '<path d="M6.99976 0.5C8.06507 0.5 9.00038 1.0557 9.53198 1.89062C9.68026 2.12358 9.61162 2.43278 9.37866 2.58105C9.14572 2.72921 8.83648 2.66064 8.68823 2.42773C8.33245 1.86901 7.70904 1.5 6.99976 1.5C5.89527 1.5001 4.99976 2.39549 4.99976 3.5V5.00293C5.21148 5.00001 5.44414 5 5.69995 5H8.29956C8.85124 5 9.29551 5.00002 9.65405 5.0293C10.0183 5.05906 10.3385 5.12171 10.6345 5.27246C11.1049 5.51213 11.4876 5.89487 11.7273 6.36523C11.8781 6.66132 11.9407 6.98137 11.9705 7.3457C11.9998 7.70429 11.9998 8.14839 11.9998 8.7002V9.2998C11.9998 9.85161 11.9998 10.2957 11.9705 10.6543C11.9407 11.0186 11.8781 11.3387 11.7273 11.6348C11.4876 12.1051 11.1049 12.4879 10.6345 12.7275C10.3385 12.8783 10.0183 12.9409 9.65405 12.9707C9.29551 13 8.85124 13 8.29956 13H5.69995C5.14826 13 4.70399 13 4.34546 12.9707C3.98121 12.9409 3.66102 12.8783 3.36499 12.7275C2.89467 12.4878 2.51187 12.1051 2.27222 11.6348C2.12143 11.3387 2.05882 11.0186 2.02905 10.6543C1.99976 10.2957 1.99976 9.8516 1.99976 9.2998V8.7002C1.99976 8.1484 1.99976 7.70429 2.02905 7.3457C2.05882 6.9814 2.12143 6.6613 2.27222 6.36523C2.51187 5.89489 2.89467 5.51215 3.36499 5.27246C3.56357 5.1713 3.77349 5.11173 3.99976 5.07324V3.5C3.99976 1.84321 5.34299 0.500099 6.99976 0.5ZM5.69995 6C5.13178 6 4.73489 6.0002 4.42651 6.02539C4.12461 6.0501 3.95063 6.09615 3.81909 6.16309C3.53694 6.3069 3.30662 6.53716 3.16284 6.81934C3.09592 6.9509 3.04984 7.12478 3.02515 7.42676C2.99995 7.73518 2.99976 8.1319 2.99976 8.7002V9.2998C2.99976 9.8681 2.99995 10.2648 3.02515 10.5732C3.04984 10.8752 3.09592 11.0491 3.16284 11.1807C3.30662 11.4628 3.53694 11.6931 3.81909 11.8369C3.95063 11.9038 4.12461 11.9499 4.42651 11.9746C4.73489 11.9998 5.13178 12 5.69995 12H8.29956C8.86771 12 9.26461 11.9998 9.573 11.9746C9.8749 11.9499 10.0489 11.9038 10.1804 11.8369C10.4626 11.6931 10.6929 11.4629 10.8367 11.1807C10.9036 11.0491 10.9497 10.8753 10.9744 10.5732C10.9996 10.2648 10.9998 9.86811 10.9998 9.2998V8.7002C10.9998 8.13189 10.9996 7.73518 10.9744 7.42676C10.9497 7.12472 10.9036 6.95091 10.8367 6.81934C10.6929 6.53714 10.4626 6.30688 10.1804 6.16309C10.0489 6.09619 9.8749 6.05008 9.573 6.02539C9.26461 6.00021 8.86771 6 8.29956 6H5.69995Z" fill="currentColor"/>';

let sidebarFolderOptionsPopover = null;
let sidebarFolderOptionsRow = null;

let sidebarHelpPopover = null;

function closeSidebarHelpPopover() {
  if (sidebarHelpPopover) {
    sidebarHelpPopover.remove();
    sidebarHelpPopover = null;
    document.removeEventListener('click', closeSidebarHelpPopover);
    const btn = document.querySelector('[data-sidebar-help-trigger][aria-expanded="true"]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

function openSidebarHelpPopover(triggerBtn) {
  closeSidebarFolderOptionsPopover();
  closeSidebarHelpPopover();

  const popover = document.createElement('div');
  popover.className = 'popover sidebar-help-popover';
  popover.setAttribute('role', 'menu');
  popover.innerHTML = `
    <div class="popover-content">
      <div class="popover-item-group">
        <div class="list-item" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_HELP_ICON_SEARCH_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Search for help...</div>
        </div>
        <div class="list-item" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_HELP_ICON_HELP_CIRCLE_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Help center</div>
        </div>
        <div class="list-item" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_HELP_ICON_COMMENT_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Support</div>
        </div>
        <div class="list-item" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_HELP_ICON_COMMAND_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Shortcuts</div>
        </div>
        <div class="list-item" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_HELP_ICON_UNLOCKED_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Terms and privacy</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popover);
  sidebarHelpPopover = popover;

  const rect = triggerBtn.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const padding = 4;
  let top = rect.top - popoverRect.height - padding;
  let left = rect.left;
  if (top < padding) top = rect.bottom + padding;
  if (left + popoverRect.width > window.innerWidth) left = window.innerWidth - popoverRect.width - padding;
  if (left < padding) left = padding;
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;

  popover.querySelectorAll('.list-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSidebarHelpPopover();
    });
  });

  triggerBtn.setAttribute('aria-expanded', 'true');

  setTimeout(() => {
    document.addEventListener('click', closeSidebarHelpPopover);
  }, 0);
}

function closeSidebarFolderOptionsPopover() {
  if (sidebarFolderOptionsRow) {
    sidebarFolderOptionsRow.classList.remove('is-options-open');
    sidebarFolderOptionsRow = null;
  }
  if (sidebarFolderOptionsPopover) {
    sidebarFolderOptionsPopover.remove();
    sidebarFolderOptionsPopover = null;
    document.removeEventListener('click', closeSidebarFolderOptionsPopover);
  }
}

function openSidebarFolderOptionsPopover(folder, triggerBtn) {
  closeSidebarFolderOptionsPopover();

  const popover = document.createElement('div');
  popover.className = 'popover sidebar-folder-popover';
  popover.setAttribute('role', 'menu');
  popover.innerHTML = `
    <div class="popover-content">
      <div class="popover-item-group">
        <div class="list-item" data-sidebar-folder-action="rename" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_EDIT_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Rename</div>
        </div>
        <div class="list-item list-item-critical" data-sidebar-folder-action="delete" role="menuitem">
          <div class="list-item-left">
            <div class="list-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">${SIDEBAR_TRASH_SVG}</svg>
            </div>
          </div>
          <div class="list-item-text">Delete folder</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popover);
  sidebarFolderOptionsPopover = popover;

  const row = folder.querySelector('.sidebar-folder-row');
  if (row) {
    row.classList.add('is-options-open');
    sidebarFolderOptionsRow = row;
  }

  const rect = triggerBtn.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const padding = 4;
  let top = rect.bottom + padding;
  let left = rect.left;
  if (top + popoverRect.height > window.innerHeight) {
    top = rect.top - popoverRect.height - padding;
  }
  if (left + popoverRect.width > window.innerWidth) {
    left = window.innerWidth - popoverRect.width - padding;
  }
  if (left < padding) left = padding;
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;

  popover.querySelector('[data-sidebar-folder-action="rename"]').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidebarFolderOptionsPopover();
    startSidebarFolderRename(folder);
  });

  popover.querySelector('[data-sidebar-folder-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidebarFolderOptionsPopover();
    folder.remove();
  });

  setTimeout(() => {
    document.addEventListener('click', closeSidebarFolderOptionsPopover);
  }, 0);
}

function startSidebarFolderRename(folder) {
  const nameEl = folder.querySelector('.sidebar-folder-name');
  if (!nameEl) return;

  const previousName = nameEl.textContent;

  const wrapper = document.createElement('div');
  wrapper.className = 'sidebar-folder-name-edit';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sidebar-folder-name-input';
  input.value = previousName;
  input.placeholder = 'Folder name...';
  input.setAttribute('aria-label', 'Folder name');

  wrapper.appendChild(input);
  nameEl.replaceWith(wrapper);
  input.focus();
  input.select();

  function commit() {
    const val = input.value.trim();
    if (val === '' && previousName === '') {
      folder.remove();
      return;
    }
    const displayName = val || previousName;
    const span = document.createElement('span');
    span.className = 'sidebar-folder-name';
    span.textContent = displayName;
    wrapper.replaceWith(span);
  }

  const onBlur = commit;
  input.addEventListener('blur', onBlur);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      if (previousName === '') {
        input.removeEventListener('blur', onBlur);
        folder.remove();
      } else {
        input.value = previousName;
        input.blur();
      }
    }
  });
}

function initSidebarFolderButtons() {
  document.querySelectorAll('[data-sidebar-create-folder]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const listId = btn.getAttribute('data-sidebar-create-folder');
      const list = document.getElementById(listId);
      if (list) createSidebarFolder(list);
    });
  });
}

function initSidebarFolders() {
  document.querySelectorAll('.sidebar-folder').forEach((folder) => {
    const toggle = folder.querySelector('.sidebar-folder-toggle');
    const children = folder.querySelector('.sidebar-folder-children');
    if (!toggle || !children) return;

    const expanded = toggle.getAttribute('aria-expanded') !== 'false';
    children.hidden = !expanded;

    toggle.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
      }
    });

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      children.hidden = isExpanded;
    });

    toggle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startSidebarFolderRename(folder);
    });
  });
}

function initSidebarSortableLists() {
  document.querySelectorAll('[data-sidebar-sortable-list]').forEach((list) => {
    list.querySelectorAll('[data-sidebar-sortable-item]').forEach((item) => {
      initSidebarSortableItem(item, list);
    });
  });
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

function initSidebarHelpPopover() {
  document.querySelectorAll('[data-sidebar-help-trigger]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeSidebarHelpPopover();
      else openSidebarHelpPopover(btn);
    });
  });
}

function initSmartButtons() {
  const container = document.querySelector('.sidebar-right-header-buttons');
  if (!container) return;

  const buttons = Array.from(container.querySelectorAll('.sidebar-smart-btn'));
  if (!buttons.length) return;

  const ICON_WIDTH = 28;
  const GAP = 8;

  buttons.forEach(btn => {
    btn.classList.remove('is-icon-only', 'is-fill');
    btn.style.flex = 'none';
  });

  const fullWidths = buttons.map(btn => btn.offsetWidth);

  buttons.forEach(btn => {
    btn.style.flex = '';
  });

  const alwaysIconCount = container.querySelectorAll('.sidebar-always-icon').length;
  const alwaysIconSpace = alwaysIconCount * ICON_WIDTH + (alwaysIconCount > 0 ? alwaysIconCount * GAP : 0);

  function update() {
    const style = getComputedStyle(container);
    const containerWidth = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const totalGap = (buttons.length - 1) * GAP;
    const available = containerWidth - totalGap - alwaysIconSpace;

    let expandedCount = 0;
    let usedByExpanded = 0;

    for (let i = 0; i < buttons.length; i++) {
      const remainingIcons = (buttons.length - i - 1) * ICON_WIDTH;
      if (usedByExpanded + fullWidths[i] + remainingIcons <= available) {
        usedByExpanded += fullWidths[i];
        expandedCount = i + 1;
      } else {
        break;
      }
    }

    buttons.forEach((btn, i) => {
      if (i < expandedCount) {
        btn.classList.remove('is-icon-only');
        btn.classList.add('is-fill');
      } else {
        btn.classList.add('is-icon-only');
        btn.classList.remove('is-fill');
      }
    });
  }

  const ro = new ResizeObserver(() => update());
  ro.observe(container);
  update();
}

function initRecordNameRename() {
  const nameContainer = document.querySelector('.sidebar-right-header-name');
  if (!nameContainer) return;

  nameContainer.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const nameEl = nameContainer.querySelector('h2');
    if (!nameEl || nameEl.isContentEditable) return;

    const previousName = nameEl.textContent;

    nameEl.contentEditable = 'true';
    nameEl.classList.add('is-editing');
    nameEl.focus();

    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function commit() {
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('is-editing');
      const val = nameEl.textContent.trim();
      nameEl.textContent = val || previousName;
      nameEl.removeEventListener('blur', commit);
      nameEl.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      }
      if (e.key === 'Escape') {
        nameEl.textContent = previousName;
        nameEl.blur();
      }
    }

    nameEl.addEventListener('blur', commit);
    nameEl.addEventListener('keydown', onKey);
  });
}

function initSidebarRightResize() {
  const handle = document.querySelector('.sidebar-right-resize');
  const sidebar = document.querySelector('.sidebar-right');
  if (!handle || !sidebar) return;

  let startX, startWidth;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    handle.classList.add('resizing');
    handle.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(380, startWidth + delta);
      sidebar.style.width = `${newWidth}px`;
    }

    function onUp() {
      handle.classList.remove('resizing');
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    }

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

function initSidebarRightSections() {
  document.querySelectorAll('.sidebar-right-section-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const group = toggle.closest('.sidebar-right-section-group');
      group.classList.toggle('is-expanded');
    });
  });
}

function initSeeMoreToggles() {
  document.querySelectorAll('.sidebar-right-section-footer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.sidebar-right-section-group');
      const wrapper = group.querySelector('.detail-rows-extra-wrapper');
      if (!wrapper) return;
      const isVisible = wrapper.classList.toggle('is-visible');
      btn.querySelector('span:first-child').textContent = isVisible ? 'Show less' : 'Show all';
    });
  });
}

function initTabsOverflow() {
  const wrapper = document.querySelector('.tabs-wrapper');
  if (!wrapper) return;
  const tabsContainer = wrapper.querySelector('.tabs');
  const container = wrapper.querySelector('.tab-overflow-container');
  const overflowBtn = wrapper.querySelector('.tab-overflow-btn');
  const popover = wrapper.querySelector('.tabs-overflow-popover');
  const popoverList = wrapper.querySelector('.tabs-overflow-list');
  if (!tabsContainer || !container || !overflowBtn || !popover || !popoverList) return;

  const allTabs = Array.from(tabsContainer.querySelectorAll('.tab'));
  let tabWidths = [];

  function measureTabs() {
    allTabs.forEach((t) => { t.style.display = ''; });
    container.classList.remove('is-visible');
    tabWidths = allTabs.map((t) => t.offsetWidth);
  }

  measureTabs();

  function updateOverflow() {
    allTabs.forEach((t) => { t.style.display = ''; });
    container.classList.remove('is-visible');
    popoverList.innerHTML = '';
    popover.classList.remove('is-open');

    const wrapperWidth = wrapper.offsetWidth;
    const gap = 2;
    const btnSpace = 48 + gap;
    const totalContentWidth = tabWidths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);

    if (totalContentWidth <= wrapperWidth) return;

    const availableWidth = wrapperWidth - btnSpace;
    let usedWidth = 0;
    let overflowIndex = -1;

    for (let i = 0; i < allTabs.length; i++) {
      usedWidth += tabWidths[i] + (i > 0 ? gap : 0);
      if (usedWidth > availableWidth) {
        overflowIndex = i;
        break;
      }
    }

    if (overflowIndex === -1) return;

    const hiddenTabs = allTabs.slice(overflowIndex);
    hiddenTabs.forEach((tab) => { tab.style.display = 'none'; });

    overflowBtn.textContent = '+' + hiddenTabs.length;
    container.classList.add('is-visible');

    hiddenTabs.forEach((tab) => {
      const tabTextEl = tab.querySelector('.tab-text');
      const iconHTML = tab.querySelector('.tab-icon')?.innerHTML || '';
      const countEl = tabTextEl?.querySelector('.tab-count');
      const label = tabTextEl ? tabTextEl.childNodes[0]?.textContent?.trim() : '';
      const countHTML = countEl ? ` <span class="list-item-count">${countEl.textContent}</span>` : '';
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `<div class="list-item-left"><div class="list-item-icon">${iconHTML}</div></div><div class="list-item-text">${label}${countHTML}</div>`;
      item.addEventListener('click', () => {
        tab.click();
        popover.classList.remove('is-open');
        container.classList.remove('is-open');
      });
      popoverList.appendChild(item);
    });
  }

  const ro = new ResizeObserver(() => updateOverflow());
  ro.observe(wrapper);
  updateOverflow();

  overflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = popover.classList.toggle('is-open');
    container.classList.toggle('is-open', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      popover.classList.remove('is-open');
      container.classList.remove('is-open');
    }
  });
}

function initTooltips() {
  let tooltipEl = null;
  const GAP = 6;

  function createTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip tooltip--top';
    tooltipEl.innerHTML = '<span class="tooltip-arrow"></span>';
    document.body.appendChild(tooltipEl);
  }

  function showTooltip(trigger) {
    if (!tooltipEl) createTooltip();
    const text = trigger.getAttribute('data-tooltip');
    if (!text) return;

    const position = trigger.getAttribute('data-tooltip-position') || 'top';
    const shortcut = trigger.getAttribute('data-tooltip-shortcut') || '';
    const avatarSrc = trigger.getAttribute('data-tooltip-avatar') || '';
    const subline = trigger.getAttribute('data-tooltip-subline') || '';
    const isSubline = !!subline;
    const avatarSize = isSubline ? '24' : '16';

    let inner = '';
    if (avatarSrc) {
      inner += `<span class="tooltip-avatar"><span class="avatar avatar--size-${avatarSize} avatar--circle avatar--image"><img src="${avatarSrc}" alt=""></span></span>`;
    }
    const shortcutHTML = shortcut
      ? `<span class="tooltip-shortcut">${shortcut.split('+').map(k => `<kbd>${k.trim()}</kbd>`).join('')}</span>`
      : '';
    const sublineHTML = isSubline
      ? `<span class="tooltip-subline">${subline}</span>`
      : '';
    inner += `<span class="tooltip-text-wrapper"><span class="tooltip-text">${text}${shortcutHTML}</span>${sublineHTML}</span>`;
    tooltipEl.innerHTML = inner;

    const variantClass = isSubline ? ' tooltip--subline' : '';
    tooltipEl.className = `tooltip tooltip--${position}${variantClass} is-visible`;

    const rect = trigger.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    let top, left;

    switch (position) {
      case 'bottom':
        top = rect.bottom + GAP;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tipRect.width - GAP;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + GAP;
        break;
      default:
        top = rect.top - tipRect.height - GAP;
        left = rect.left + rect.width / 2;
    }

    tooltipEl.style.top = top + window.scrollY + 'px';
    tooltipEl.style.left = left + window.scrollX + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('is-visible');
  }

  document.addEventListener('mouseenter', (e) => {
    const trigger = e.target.closest('[data-tooltip]');
    if (trigger) showTooltip(trigger);
  }, true);

  document.addEventListener('mouseleave', (e) => {
    const trigger = e.target.closest('[data-tooltip]');
    if (trigger) hideTooltip();
  }, true);
}

function playTaskCompleteSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.setValueAtTime(880, t + 0.06);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);

  setTimeout(() => ctx.close(), 300);
}


function initTaskCompletion() {
  const backlogTasks = [
    { title: 'Update CRM integration settings', date: 'Mar 15', dateClass: '', refs: 1, person: 'Ana Silva', personEmail: 'ana@trello.com', avatar: '../assets/avatar-4.png' },
    { title: 'Schedule demo call with prospect', date: 'Mar 14', dateClass: '', refs: 2, person: 'Sarah Chen', personEmail: 'sarah@trello.com', avatar: '../assets/avatar-2.png' },
    { title: 'Write release notes for v2.4', date: 'Mar 20', dateClass: '', refs: 1, person: 'James Wilson', personEmail: 'james@trello.com', avatar: '../assets/avatar-1.png' },
    { title: 'Audit user permissions for staging', date: 'Mar 11', dateClass: 'meta-group--critical', refs: 3, person: 'Mike Ross', personEmail: 'mike@trello.com', avatar: '../assets/avatar-3.png' },
    { title: 'Design onboarding email sequence', date: 'Mar 18', dateClass: '', refs: 1, person: 'Laura Mendes', personEmail: 'laura@trello.com', avatar: '../assets/avatar-5.png' },
    { title: 'Finalize vendor contract terms', date: 'Mar 22', dateClass: '', refs: 2, person: 'Sarah Chen', personEmail: 'sarah@trello.com', avatar: '../assets/avatar-2.png' },
    { title: 'Set up automated test pipeline', date: 'Mar 16', dateClass: '', refs: 1, person: 'Mike Ross', personEmail: 'mike@trello.com', avatar: '../assets/avatar-3.png' },
    { title: 'Prepare investor update deck', date: 'Mar 10', dateClass: 'meta-group--critical', refs: 2, person: 'James Wilson', personEmail: 'james@trello.com', avatar: '../assets/avatar-1.png' },
    { title: 'Review customer success playbook', date: 'Mar 25', dateClass: '', refs: 1, person: 'Ana Silva', personEmail: 'ana@trello.com', avatar: '../assets/avatar-4.png' },
  ];

  let backlogIndex = 0;
  let remainingTasks = 12;
  var tasksCountEl = document.getElementById('tasks-count');
  var tasksTabCount = document.querySelector('.tab-text .tab-count');
  if (tasksTabCount && tasksTabCount.closest('.tab-text').textContent.trim().indexOf('Tasks') === -1) tasksTabCount = null;

  const calendarSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.5 0.5C3.77614 0.5 4 0.723858 4 1V1.50004L4.1786 1.5L4.2 1.5L7.8 1.5L7.8214 1.5C7.88225 1.5 7.94177 1.5 8 1.50004V1C8 0.723858 8.22386 0.5 8.5 0.5C8.77614 0.5 9 0.723858 9 1V1.51834C9.05312 1.52135 9.10454 1.52484 9.15431 1.52891C9.51874 1.55868 9.83883 1.62159 10.135 1.77248C10.6054 2.01217 10.9878 2.39462 11.2275 2.86502C11.3784 3.16117 11.4413 3.48126 11.4711 3.84569C11.5 4.19961 11.5 4.63667 11.5 5.17853V5.2L11.5 7.3V7.32147C11.5 7.86333 11.5 8.30039 11.4711 8.65431C11.4413 9.01874 11.3784 9.33883 11.2275 9.63498C10.9878 10.1054 10.6054 10.4878 10.135 10.7275C9.83883 10.8784 9.51874 10.9413 9.15431 10.9711C8.80039 11 8.36333 11 7.82147 11H7.8L4.2 11H4.17853C3.63667 11 3.19961 11 2.84569 10.9711C2.48126 10.9413 2.16117 10.8784 1.86502 10.7275C1.39462 10.4878 1.01217 10.1054 0.772483 9.63498C0.62159 9.33883 0.558683 9.01874 0.528909 8.65431C0.499991 8.30037 0.499995 7.8633 0.5 7.3214V7.3L0.5 5.2V5.1786C0.499995 4.6367 0.499991 4.19963 0.528909 3.84569C0.558683 3.48126 0.62159 3.16117 0.772483 2.86502C1.01217 2.39462 1.39462 2.01217 1.86502 1.77248C2.16117 1.62159 2.48126 1.55868 2.84569 1.52891C2.89546 1.52484 2.94688 1.52135 3 1.51834V1C3 0.723858 3.22386 0.5 3.5 0.5ZM8 2.50006V3C8 3.27614 8.22386 3.5 8.5 3.5C8.77614 3.5 9 3.27614 9 3V2.52019C9.02484 2.52185 9.04912 2.52365 9.07288 2.52559C9.37546 2.55031 9.54931 2.5964 9.68099 2.66349C9.96323 2.8073 10.1927 3.03677 10.3365 3.31901C10.4036 3.45069 10.4497 3.62454 10.4744 3.92712C10.4996 4.23554 10.5 4.6317 10.5 5.2L10.5 7.3C10.5 7.8683 10.4996 8.26446 10.4744 8.57288C10.4497 8.87546 10.4036 9.04931 10.3365 9.18099C10.1927 9.46323 9.96323 9.6927 9.68099 9.83651C9.54931 9.9036 9.37546 9.94969 9.07288 9.97441C8.76446 9.99961 8.3683 10 7.8 10L4.2 10C3.6317 10 3.23554 9.99961 2.92712 9.97441C2.62454 9.94969 2.45069 9.9036 2.31901 9.83651C2.03677 9.6927 1.8073 9.46323 1.66349 9.18099C1.5964 9.04931 1.55031 8.87546 1.52559 8.57288C1.50039 8.26446 1.5 7.8683 1.5 7.3L1.5 5.2C1.5 4.6317 1.50039 4.23554 1.52559 3.92712C1.55031 3.62454 1.5964 3.45069 1.66349 3.31901C1.8073 3.03677 2.03677 2.8073 2.31901 2.66349C2.45069 2.5964 2.62454 2.55031 2.92712 2.52559C2.95088 2.52365 2.97516 2.52185 3 2.52019V3C3 3.27614 3.22386 3.5 3.5 3.5C3.77614 3.5 4 3.27614 4 3V2.50006L4.2 2.5L7.8 2.5C7.86917 2.5 7.93578 2.50001 8 2.50006ZM3.5 4.5C3.22386 4.5 3 4.72386 3 5C3 5.27614 3.22386 5.5 3.5 5.5H8.5C8.77614 5.5 9 5.27614 9 5C9 4.72386 8.77614 4.5 8.5 4.5H3.5Z" fill="currentColor"/></svg>';
  const refSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.53528 7.56055C3.81138 7.56055 4.03522 7.78446 4.03528 8.06055V10.1816C4.03528 10.4578 3.81142 10.6816 3.53528 10.6816C3.25924 10.6815 3.03528 10.4577 3.03528 10.1816V9.26758L1.41419 10.8887C1.21892 11.0839 0.902417 11.0839 0.707154 10.8887C0.512059 10.6934 0.511948 10.3768 0.707154 10.1816L2.32825 8.56055H1.41419C1.13804 8.56055 0.914186 8.33669 0.914186 8.06055C0.914247 7.78446 1.13808 7.56055 1.41419 7.56055H3.53528ZM7.29993 1C7.85166 1 8.29587 1 8.65442 1.0293C9.0187 1.05907 9.33884 1.12166 9.63489 1.27246C10.1052 1.51215 10.488 1.89487 10.7277 2.36523C10.8785 2.66131 10.9411 2.98138 10.9708 3.3457C11.0001 3.70429 11.0001 4.1484 11.0001 4.7002V7.2998C11.0001 7.8516 11.0001 8.29571 10.9708 8.6543C10.9411 9.01862 10.8785 9.33869 10.7277 9.63477C10.488 10.1051 10.1052 10.4879 9.63489 10.7275C9.33884 10.8783 9.0187 10.9409 8.65442 10.9707C8.29587 11 7.85166 11 7.29993 11H6.00012C5.72398 11 5.50012 10.7761 5.50012 10.5C5.50012 10.2239 5.72398 10 6.00012 10H7.29993C7.86814 10 8.26497 9.99981 8.57337 9.97461C8.87532 9.9499 9.04923 9.90385 9.18079 9.83691C9.46297 9.6931 9.69325 9.46286 9.83704 9.18066C9.90397 9.04909 9.95003 8.87524 9.97473 8.57324C9.99993 8.26482 10.0001 7.8681 10.0001 7.2998V4.7002C10.0001 4.1319 9.99993 3.73518 9.97473 3.42676C9.95003 3.12476 9.90397 2.95091 9.83704 2.81934C9.69325 2.53714 9.46297 2.3069 9.18079 2.16309C9.04923 2.09615 8.87532 2.0501 8.57337 2.02539C8.26497 2.00019 7.86814 2 7.29993 2H4.70032C4.13211 2 3.73528 2.0002 3.42688 2.02539C3.12493 2.05009 2.95102 2.09617 2.81946 2.16309C2.53724 2.30688 2.30702 2.53712 2.16321 2.81934C2.09626 2.95091 2.05022 3.12471 2.02551 3.42676C2.00031 3.73518 2.00012 4.13189 2.00012 4.7002V6C2.00012 6.27609 1.77619 6.49991 1.50012 6.5C1.22398 6.5 1.00012 6.27614 1.00012 6V4.7002C1.00012 4.14839 1.00012 3.70429 1.02942 3.3457C1.05919 2.98136 1.12176 2.66132 1.27258 2.36523C1.51227 1.89486 1.89497 1.51213 2.36536 1.27246C2.66141 1.12168 2.98153 1.05906 3.34583 1.0293C3.70439 1.00001 4.1486 1 4.70032 1H7.29993ZM6.50012 8C6.77619 8.00009 7.00012 8.22391 7.00012 8.5C7.00012 8.77609 6.77619 8.99991 6.50012 9H5.50012C5.22398 9 5.00012 8.77614 5.00012 8.5C5.00012 8.22386 5.22398 8 5.50012 8H6.50012ZM8.50012 6C8.77619 6.00009 9.00012 6.22391 9.00012 6.5C9.00012 6.77609 8.77619 6.99991 8.50012 7H5.50012C5.22398 7 5.00012 6.77614 5.00012 6.5C5.00012 6.22386 5.22398 6 5.50012 6H8.50012ZM4.50012 3C4.77619 3.00009 5.00012 3.22391 5.00012 3.5V4.5C5.00012 4.77609 4.77619 4.99991 4.50012 5H3.50012C3.22398 5 3.00012 4.77614 3.00012 4.5V3.5C3.00012 3.22386 3.22398 3 3.50012 3H4.50012Z" fill="currentColor"/></svg>';

  function createTaskItem(task) {
    const item = document.createElement('div');
    item.className = 'record-list-item is-entering';
    item.innerHTML =
      '<div class="record-list-item-radio"><input type="radio"></div>' +
      '<div class="record-list-item-content"><span class="text-body record-list-item-title">' + task.title + '</span></div>' +
      '<div class="record-list-item-right">' +
        '<span class="text-caption meta-group ' + task.dateClass + '">' + calendarSvg + ' ' + task.date + '</span>' +
        '<span class="text-caption meta-group">' + refSvg + ' ' + task.refs + '</span>' +
        '<span class="text-caption meta-group" data-tooltip="' + task.person + '" data-tooltip-subline="' + task.personEmail + '" data-tooltip-avatar="' + task.avatar + '">' +
          '<span class="avatar avatar--size-12 avatar--circle avatar--image"><img src="' + task.avatar + '" alt="' + task.person + '"></span> ' + task.person +
        '</span>' +
      '</div>';
    return item;
  }

  function updateCount() {
    remainingTasks--;
    if (tasksCountEl) tasksCountEl.textContent = remainingTasks;
    var tabCounts = document.querySelectorAll('.tab .tab-text .tab-count');
    tabCounts.forEach(function(el) {
      if (el.closest('.tab-text') && el.closest('.tab-text').textContent.trim().startsWith('Tasks')) {
        el.textContent = remainingTasks;
      }
    });
  }

  document.addEventListener('change', function(e) {
    var radio = e.target.closest('.record-list-item-radio input[type="radio"]');
    if (!radio) return;

    var item = radio.closest('.record-list-item');
    var list = item.closest('.record-list');
    if (!list) return;
    var section = list.closest('.record-section');

    playTaskCompleteSound();
    updateCount();
    item.classList.add('is-checked');

    setTimeout(function() {
      var hasReplacement = backlogIndex < backlogTasks.length;

      if (hasReplacement) {
        var newItem = createTaskItem(backlogTasks[backlogIndex++]);
        list.appendChild(newItem);
      }

      item.classList.add('is-completing');

      item.addEventListener('transitionend', function step1(ev) {
        if (ev.propertyName !== 'opacity') return;
        item.removeEventListener('transitionend', step1);

        if (hasReplacement) {
          item.classList.add('is-collapsing');
          requestAnimationFrame(function() { newItem.classList.add('is-expanding'); });

          var collapseOrExpand = 0;
          function onSwapDone() {
            collapseOrExpand++;
            if (collapseOrExpand < 2) return;
            item.remove();

            newItem.className = 'record-list-item is-fading-in';
            requestAnimationFrame(function() {
              requestAnimationFrame(function() {
                newItem.classList.add('is-visible');
                newItem.addEventListener('transitionend', function step3() {
                  newItem.className = 'record-list-item';
                  newItem.removeEventListener('transitionend', step3);
                });
              });
            });
          }

          item.addEventListener('transitionend', function step2a(ev2) {
            if (ev2.propertyName !== 'height') return;
            item.removeEventListener('transitionend', step2a);
            onSwapDone();
          });
          newItem.addEventListener('transitionend', function step2b(ev2) {
            if (ev2.propertyName !== 'height') return;
            newItem.removeEventListener('transitionend', step2b);
            onSwapDone();
          });
        } else {
          item.classList.add('is-collapsing');
          item.addEventListener('transitionend', function stepRemove(ev2) {
            if (ev2.propertyName !== 'height') return;
            item.removeEventListener('transitionend', stepRemove);
            item.remove();

            if (remainingTasks <= 0 && section) {
              section.style.transition = 'opacity 0.8s ease';
              section.style.opacity = '0';
              section.addEventListener('transitionend', function hideSection(ev3) {
                if (ev3.propertyName !== 'opacity') return;
                section.removeEventListener('transitionend', hideSection);
                section.style.display = 'none';
              });
            }
          });
        }
      });
    }, 1000);
  });
}

initTaskCompletion();
initTooltips();
initTabsOverflow();
initSidebarExpandableItems();
initSidebarFolders();
initSidebarFolderButtons();
initSidebarHelpPopover();
initSidebarSortableLists();
initSidebarRightResize();
initRecordNameRename();
initSmartButtons();
initSidebarRightSections();
initSeeMoreToggles();
