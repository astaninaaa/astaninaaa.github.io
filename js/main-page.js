/* =============================================================================
   main-page.js — JS главной страницы (index.html)
   Содержит:
   1. Hero Entrance + инициализация по хэшу
   2. Ховеры зон (mouseenter/mouseleave → классы на body)
   3. Deep Linking: клик по зоне → хэш в URL, фиксация / снятие фиксации
   4. Раскрытие стихов: по таймеру (4s ховер) и по клику
   5. Выезд панели проекта (Project Sheet) + fetch контента
   6. Рендер карточек из JSON (craft.json, poetry.json, projects.json)
   ============================================================================= */

'use strict';

/* ─── Утилиты ────────────────────────────────────────────────────────────────── */

/**
 * Безопасно устанавливает textContent элементу по id.
 * Не использует innerHTML.
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** Проверяет, является ли строка валидным не-пустым путём (не '' и не '#') */
function isValidLink(href) {
  return typeof href === 'string' && href.length > 0 && href !== '#';
}

/**
 * Проверяет, является ли значение непустой строкой.
 * Защищает от вывода undefined / null / '' в DOM.
 */
function hasValue(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Выводит заглушку «Контент обновляется» в контейнер.
 * Используется при ошибке загрузки JSON или пустом массиве.
 */
function renderPlaceholder(container) {
  container.textContent = '';
  const p = document.createElement('p');
  p.className = 'mono';
  p.textContent = 'Контент обновляется';
  container.appendChild(p);
}

let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}, { passive: true });



/* ─── Запуск рендера — все три зоны параллельно ──────────────────────────────── */
// Promise.allSettled гарантирует: даже если один fetch упадёт,
// два других продолжат рендер независимо.
Promise.allSettled([
  renderCraft(),
  renderPoetry(),
  renderProjects(),
]);


/* ═══════════════════════════════════════════════════════════════════════════════
   1. HERO ENTRANCE + ИНИЦИАЛИЗАЦИЯ ПО ХЭШУ
   ═══════════════════════════════════════════════════════════════════════════════ */

(function initHeroEntrance() {
  const hash = window.location.hash; // '#craft' | '#poetry' | '#projects' | ''

  const VALID_HASHES = ['#craft', '#poetry', '#projects'];

  if (VALID_HASHES.includes(hash)) {
    /* ── Инициализация по хэшу: мгновенный старт без Hero Entrance анимации ── */
    // Добавляем page-loaded сразу — без задержки CSS-анимации
    document.body.classList.add('page-loaded');

    // Активируем нужную зону
    const zone = hash.slice(1); // 'craft' | 'poetry' | 'projects'
    activateZone(zone, { instant: true });

  } else {
    /* ── Стандартный Hero Entrance ── */
    // CSS уже задаёт стартовое состояние opacity:0 transform:translateY(15px)
    // Добавляем .page-loaded — запускает CSS-анимацию (Шаг 1 → Шаг 2)
    document.body.classList.add('page-loaded');
  }
})();


/* ═══════════════════════════════════════════════════════════════════════════════
   2. ХОВЕРЫ ЗОН — Нативный и производительный инжектор фокуса
   ═══════════════════════════════════════════════════════════════════════════════ */
(function initZoneHovers() {
   // Настоящая, непробиваемая проверка десктопа. На мобайле код ниже НЕ выполнится вообще.
  if (!window.matchMedia('(min-width: 1081px)').matches) return;
  
  const zoneCraft    = document.getElementById('zone-craft');
  const zonePoetry   = document.getElementById('zone-poetry');
  const zoneProjects = document.getElementById('zone-projects');
  
  // Элементы, которые при наведении на них активируют фокус на проектах
  const siteHeader   = document.querySelector('.site-header');
  const siteCenter   = document.querySelector('.site-center');

  // --- НОВОЕ: кнопки шапки ---
  const btnCraft   = document.querySelector('.header-zone-btn--craft');
  const btnPoetry  = document.querySelector('.header-zone-btn--poetry');

  if (!zoneCraft || !zonePoetry || !zoneProjects) return;

  const HOVER_CLASSES = [
    'zone-hovered--craft',
    'zone-hovered--poetry',
    'zone-hovered--projects',
  ];

  function clearHoverClasses() {
    HOVER_CLASSES.forEach(cls => document.body.classList.remove(cls));
  }

  // Если зафиксирована любая зона через Deep Linking — полностью блокируем ховеры
  function isAnyZoneActive() {
    return (
      document.body.classList.contains('active-craft') ||
      document.body.classList.contains('active-poetry') ||
      document.body.classList.contains('active-projects')
    );
  }

  function setHoverClass(cls) {
    if (isAnyZoneActive()) return;
    clearHoverClasses();
    document.body.classList.add(cls);
  }

  // Навешиваем слушатели на пересечение границ контейнеров
  zoneCraft.addEventListener('mouseenter', () => setHoverClass('zone-hovered--craft'));
  zonePoetry.addEventListener('mouseenter', () => setHoverClass('zone-hovered--poetry'));
  zoneProjects.addEventListener('mouseenter', () => setHoverClass('zone-hovered--projects'));

  // Как только мышь выходит за пределы боковых колонок — фокус мгновенно возвращается на Проекты
  zoneCraft.addEventListener('mouseleave', () => setHoverClass('zone-hovered--projects'));
  zonePoetry.addEventListener('mouseleave', () => setHoverClass('zone-hovered--projects'));

  // --- НОВОЕ: ховеры на кнопки шапки ---
  if (btnCraft) {
    btnCraft.addEventListener('mouseenter', () => setHoverClass('zone-hovered--craft'));
    btnCraft.addEventListener('mouseleave', () => {
      // Не сбрасываем на проекты, если активна craft-зона
      if (!document.body.classList.contains('active-craft')) {
        setHoverClass('zone-hovered--projects');
      }
    });
  }

  if (btnPoetry) {
    btnPoetry.addEventListener('mouseenter', () => setHoverClass('zone-hovered--poetry'));
    btnPoetry.addEventListener('mouseleave', () => {
      if (!document.body.classList.contains('active-poetry')) {
        setHoverClass('zone-hovered--projects');
      }
    });
  }

  // Шапка и центральный бренд-блок по ТЗ отдают приоритет 100% видимости проектам
  if (siteHeader) {
    siteHeader.addEventListener('mouseenter', () => setHoverClass('zone-hovered--projects'));
  }
  if (siteCenter) {
    // Включаем pointer-events в JS, чтобы центр мог ловить курсор мыши над собой
    siteCenter.style.pointerEvents = 'auto';
    siteCenter.addEventListener('mouseenter', () => setHoverClass('zone-hovered--projects'));
  }

  // Общий сброс ховеров, когда мышь полностью покидает интерактивное полотно
  document.addEventListener('mouseleave', () => {
    if (!isAnyZoneActive()) {
      clearHoverClasses();
    }
  });
})();




/* ─── 2б. WHEEL-СКРОЛЛ В ЗОНЕ ПРОЕКТОВ ─── */
(function initPremiumSlider() {
  if (!window.matchMedia('(min-width: 1081px)').matches) return;

  const zoneProjects = document.getElementById('zone-projects');
  const container = document.getElementById('projects-cards-container');
  if (!zoneProjects || !container) return;

  let currentTranslateX = 0;
  let rafId = null;
  let pendingDelta = 0;

  function applyScroll() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    rafId = requestAnimationFrame(() => {
      const zoneWidth = zoneProjects.offsetWidth;
      const containerWidth = container.scrollWidth;
      const maxScroll = containerWidth - zoneWidth;
      if (maxScroll <= 0) {
        rafId = null;
        return;
      }

      // Применяем накопленную дельту
      currentTranslateX += pendingDelta;
      pendingDelta = 0;

      // Ограничиваем
      if (currentTranslateX > 0) currentTranslateX = 0;
      if (currentTranslateX < -maxScroll) currentTranslateX = -maxScroll;

      container.style.transform = `translateX(${currentTranslateX}px)`;
      rafId = null;
    });
  }

  document.addEventListener('wheel', (e) => {
    // 1. Если активна боковая зона — проекты не скроллятся
    const isActiveZone = document.body.classList.contains('active-craft') ||
                         document.body.classList.contains('active-poetry');
    if (isActiveZone) return;

    // 2. Если курсор над кнопкой шапки — скроллим соответствующую зону
    const btnCraft = e.target.closest('.header-zone-btn--craft');
    const btnPoetry = e.target.closest('.header-zone-btn--poetry');

    const SMOOTH_FACTOR = 0.2; // меньше 1 — медленнее, больше 1 — быстрее
    pendingDelta -= e.deltaY * SMOOTH_FACTOR;

    if (btnCraft) {
      const zone = document.getElementById('zone-craft');
      if (zone) {
        zone.scrollTop += e.deltaY;
        e.preventDefault();
      }
      return;
    }

    if (btnPoetry) {
      const zone = document.getElementById('zone-poetry');
      if (zone) {
        zone.scrollTop += e.deltaY;
        e.preventDefault();
      }
      return;
    }

    // 3. Если событие пришло из боковой зоны (или её потомков) — игнорируем
    const target = e.target.closest('.zone--craft, .zone--poetry');
    if (target) return;

    // 4. В остальных случаях — скроллим проекты через rAF
    if (e.deltaY !== 0) {
      e.preventDefault();
      pendingDelta -= e.deltaY; // накапливаем дельту
      applyScroll();
    }
  }, { passive: false });

  // При ресайзе пересчитываем размеры и корректируем позицию
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateProjectsCardWidth();
      const zoneWidth = zoneProjects.offsetWidth;
      const containerWidth = container.scrollWidth;
      const maxScroll = containerWidth - zoneWidth;
      if (currentTranslateX < -maxScroll) {
        currentTranslateX = -maxScroll;
        container.style.transform = `translateX(${currentTranslateX}px)`;
      } else if (currentTranslateX > 0) {
        currentTranslateX = 0;
        container.style.transform = `translateX(0px)`;
      }
    }, 150);
  });
})();




/* ═══════════════════════════════════════════════════════════════════════════════
   3. DEEP LINKING — клик по зоне → хэш в URL, фиксация / снятие
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Активирует зону: вешает active-класс на body, записывает хэш в URL.
 * @param {string} zone — 'craft' | 'poetry' | 'projects'
 * @param {object} options — { instant: boolean } для инициализации по хэшу
 */
function activateZone(zone, options = {}) {
  const ZONE_CLASSES = ['active-craft', 'active-poetry', 'active-projects'];
  // Снимаем все активные классы
  ZONE_CLASSES.forEach(cls => document.body.classList.remove(cls));
  // Навешиваем нужный
  document.body.classList.add(`active-${zone}`);
  // Записываем хэш в URL без перезагрузки страницы
  history.replaceState(null, '', `#${zone}`);
}

/**
 * Деактивирует все зоны: снимает active-классы, очищает хэш.
 */
function deactivateAllZones() {
  // Снимаем активные классы
  ['active-craft', 'active-poetry', 'active-projects'].forEach(cls =>
    document.body.classList.remove(cls)
  );
  // Очищаем все классы ховеров
  ['zone-hovered--craft', 'zone-hovered--poetry', 'zone-hovered--projects'].forEach(cls =>
    document.body.classList.remove(cls)
  );
  history.replaceState(null, '', window.location.pathname);

  // Проверяем положение мыши и, если она над кнопкой или зоной, добавляем соответствующий ховер
  requestAnimationFrame(() => {
    if (lastMouseX === 0 && lastMouseY === 0) return;
    const el = document.elementFromPoint(lastMouseX, lastMouseY);
    if (!el) return;

    const craftZone = el.closest('.zone--craft') || el.closest('.header-zone-btn--craft');
    const poetryZone = el.closest('.zone--poetry') || el.closest('.header-zone-btn--poetry');

    if (craftZone) {
      document.body.classList.add('zone-hovered--craft');
    } else if (poetryZone) {
      document.body.classList.add('zone-hovered--poetry');
    }
  });
}

(function initDeepLinking() {
  const zoneCraft  = document.getElementById('zone-craft');
  const zonePoetry = document.getElementById('zone-poetry');

  // --- НОВОЕ: кнопки шапки ---
  const btnCraft   = document.querySelector('.header-zone-btn--craft');
  const btnPoetry  = document.querySelector('.header-zone-btn--poetry');

  if (!zoneCraft || !zonePoetry) return;

  // --- Клики по кнопкам шапки (только на десктопе) ---
  if (window.matchMedia('(min-width: 1081px)').matches) {
    if (btnCraft) {
      btnCraft.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = document.body.classList.contains('active-craft');
        if (isActive) {
          deactivateAllZones();
        } else {
          activateZone('craft');
        }
      });
    }

    if (btnPoetry) {
      btnPoetry.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = document.body.classList.contains('active-poetry');
        if (isActive) {
          deactivateAllZones();
        } else {
          activateZone('poetry');
        }
      });
    }
  }

  // Глобальный обработчик для снятия фиксации при клике вне боковых зон (только десктоп)
  if (window.matchMedia('(min-width: 1081px)').matches) {
    document.addEventListener('click', (e) => {
      const isCraftActive = document.body.classList.contains('active-craft');
      const isPoetryActive = document.body.classList.contains('active-poetry');
      if (!isCraftActive && !isPoetryActive) return;

      const clickedInsideCraft = !!e.target.closest('.zone--craft');
      const clickedInsidePoetry = !!e.target.closest('.zone--poetry');
      const clickedOnCraftBtn = !!e.target.closest('.header-zone-btn--craft');
      const clickedOnPoetryBtn = !!e.target.closest('.header-zone-btn--poetry');
      const clickedOnProjectCard = !!e.target.closest('.card--project');

      // Игнорируем клики по карточкам проектов (они обрабатываются в initProjectSheet)
      if (clickedOnProjectCard) return;

      // Игнорируем клики по кнопкам шапки (они управляются отдельными обработчиками)
      if (clickedOnCraftBtn || clickedOnPoetryBtn) return;

      // Если клик вне зоны — снимаем фиксацию
      if (!clickedInsideCraft && !clickedInsidePoetry) {
        deactivateAllZones();
      }
    });
  }

  
})();


/* ═══════════════════════════════════════════════════════════════════════════════
   4. РАСКРЫТИЕ И СКРЫТИЕ СТИХОВ ПО КЛИКУ И ХОВЕРУ (NEW UX)
   Функция объявлена как именованная (не IIFE) — вызывается повторно
   из renderPoetry() после рендера новых карточек из JSON.
   ═══════════════════════════════════════════════════════════════════════════════ */
function initPoetryExpand() {
  const poetryContainer = document.getElementById('poetry-cards-container');
  if (!poetryContainer) return;

  /** Управляет состоянием раскрытия карточки */
  function setCardState(card, expand) {
    const textEl = card.querySelector('.card__poetry-text');
    const btnEl  = card.querySelector('.poetry-toggle-btn');
    if (!textEl || !btnEl) return;

    if (expand) {
      if (card.classList.contains('is-expanded')) return;
      
      card.classList.add('is-expanded');
      btnEl.setAttribute('aria-expanded', 'true');
      btnEl.textContent = '[скрыть]';

      // Передаем реальную высоту контента в CSS для плавной анимации скольжения
      textEl.style.maxHeight = textEl.scrollHeight + 'px';
    } else {
      if (!card.classList.contains('is-expanded')) return;

      card.classList.remove('is-expanded');
      btnEl.setAttribute('aria-expanded', 'false');
      btnEl.textContent = '[...]';

      // Полностью удаляем инлайновый стиль — браузер вернётся к CSS-ограничению
      textEl.style.maxHeight = '';
    }
  }

  // Навешиваем логику долгого ховера и изоляцию кликов на каждую карточку
  const poetryCards = poetryContainer.querySelectorAll('.card--poetry');
  
  poetryCards.forEach(card => {
    let hoverTimer = null;
    const btnEl = card.querySelector('.poetry-toggle-btn');

    // ── ЗАЩИТА ОТ УТЕЧЕК ПАМЯТИ: СБРОС ТАЙМЕРОВ ──
    const clearTimer = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    };

    // Создаем именованные функции, чтобы браузер мог их корректно удалять из памяти
    const handleMouseEnter = () => {
      if (!card.classList.contains('is-expanded')) {
        clearTimer(); // очищаем старый хвост перед запуском
        hoverTimer = setTimeout(() => {
          setCardState(card, true);
        }, 3000); 
      }
    };

    const handleMouseLeave = () => {
      clearTimer(); // ТЗ защита: сброс при уходе мыши
    };

    // Перед тем как навесить новые события, принудительно удаляем старые (если они были)
    card.removeEventListener('mouseenter', card._onMouseEnter);
    card.removeEventListener('mouseleave', card._onMouseLeave);

    // Сохраняем ссылки на функции прямо в объект DOM-узла карточки
    card._onMouseEnter = handleMouseEnter;
    card._onMouseLeave = handleMouseLeave;

    // Навешиваем чистые слушатели
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    // Мгновенный клик строго по хитбоксу кнопки
    if (btnEl) {
      const handleBtnClick = (e) => {
        e.stopPropagation();
        clearTimer(); // Очищаем таймер ховера при принудительном клике
        const isExpanded = card.classList.contains('is-expanded');
        setCardState(card, !isExpanded);
      };

      btnEl.removeEventListener('click', btnEl._onClick);
      btnEl._onClick = handleBtnClick;
      btnEl.addEventListener('click', handleBtnClick);
    }
  });
}


/* ═══════════════════════════════════════════════════════════════════════════════
   5. PROJECT SHEET — выезд панели проекта снизу
   ═══════════════════════════════════════════════════════════════════════════════ */

(function initProjectSheet() {
  const projectsContainer = document.getElementById('projects-cards-container');
  const sheet             = document.getElementById('project-sheet');
  const sheetContent      = document.getElementById('project-sheet-content');
  const sheetClose        = sheet ? sheet.querySelector('.project-sheet__close') : null;
  const overlay           = document.getElementById('site-overlay');

  if (!projectsContainer || !sheet || !sheetContent) return;

  let lastFocusedElement = null;
  /** Открывает панель с контентом из href */

  async function openSheet(href) {
    // сохраняем текущий активный элемент (карточку проекта)
    lastFocusedElement = document.activeElement;

    // Меняем фон страницы на bg-muted
    document.body.style.backgroundColor = 'var(--bg-muted)';
    document.body.classList.add('active-projects');

    // Показываем sheet (убираем hidden, даём браузеру отрисовать)
    sheet.removeAttribute('hidden');
    // Небольшая задержка чтобы display:none → display:block → transition сработал
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sheet.classList.add('is-open');
      });
    });

    // Overlay
    if (overlay) {
      overlay.classList.add('is-visible');
    }

    // Загружаем контент страницы проекта
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      // Парсим ответ — берём только содержимое <main> или <body>
      const parser  = new DOMParser();
      const doc     = parser.parseFromString(html, 'text/html');
      const mainEl  = doc.querySelector('main') || doc.querySelector('body');

      if (mainEl) {
        // Безопасная вставка через DOM (не innerHTML)
        sheetContent.textContent = ''; // очищаем
        // Переносим дочерние узлы — безопаснее чем innerHTML для своих страниц
        const nodes = Array.from(mainEl.childNodes);
        nodes.forEach(node => {
          sheetContent.appendChild(document.importNode(node, true));
        });
      }
    } catch (err) {
      console.warn('[main-page.js] Ошибка загрузки проекта:', err);
      const errMsg = document.createElement('p');
      errMsg.textContent = 'Не удалось загрузить страницу проекта.';
      sheetContent.textContent = '';
      sheetContent.appendChild(errMsg);
    }
    requestAnimationFrame(() => {
      const closeBtn = sheet.querySelector('.project-sheet__close');
      if (closeBtn) closeBtn.focus();
    });
  }

  /** Закрывает панель */
  function closeSheet() {
    sheet.classList.remove('is-open');
    document.body.style.backgroundColor = '';
    document.body.classList.remove('active-projects');

    if (overlay) {
      overlay.classList.remove('is-visible');
    }

    // После окончания анимации — скрываем через hidden
    sheet.addEventListener('transitionend', () => {
      sheet.setAttribute('hidden', '');
      sheetContent.textContent = '';
    }, { once: true });

    // Очищаем хэш
    history.replaceState(null, '', window.location.pathname);

    // возвращаем фокус
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  // Клики по карточкам проектов — делегирование на контейнер
  // Работает и для карточек, отрендеренных динамически из JSON
  projectsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.card--project');
    if (!card) return;

    const href = card.getAttribute('href');
    if (!isValidLink(href)) return;

    // Блокируем стандартный переход по ссылке
    e.preventDefault();

    openSheet(href);
    // Записываем хэш
    history.replaceState(null, '', '#projects');
  });

  // клавиатурная навигация
  projectsContainer.addEventListener('keydown', (e) => {
    const cards = projectsContainer.querySelectorAll('.card--project');
    const current = document.activeElement;
    if (!current || !current.closest('.card--project')) return;

    const index = Array.from(cards).indexOf(current.closest('.card--project'));
    let newIndex = -1;

    if (e.key === 'ArrowRight' && index < cards.length - 1) {
      newIndex = index + 1;
    } else if (e.key === 'ArrowLeft' && index > 0) {
      newIndex = index - 1;
    } else {
      return;
    }

    e.preventDefault();
    cards[newIndex].focus();
  });

  // Закрытие по кнопке
  if (sheetClose) {
    sheetClose.addEventListener('click', closeSheet);
  }

  // Закрытие по клику на overlay
  if (overlay) {
    overlay.addEventListener('click', closeSheet);
  }

  // Блокировка фокуса за пределами sheet
  const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function trapFocus(e) {
    if (!sheet.classList.contains('is-open')) return;
    const focusable = sheet.querySelectorAll(focusableElements);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.target.closest('.project-sheet')) return;
    // если фокус ушёл за пределы sheet — вернуть на первый элемент
    first.focus();
    e.preventDefault();
  }

  document.addEventListener('focusin', trapFocus);

  // Закрытие sheet по Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) {
      closeSheet();
    }
  });

  /* МОБИЛЬНЫЙ СВАЙП ДЛЯ ЗАКРЫТИЯ BOTTOMSHEET (только ≤ 1080px) */
  if (window.matchMedia('(max-width: 1080px)').matches) {
    let touchStartY = 0;

    sheet.addEventListener('touchstart', (e) => {
      // Игнорируем, если панель закрыта
      if (!sheet.classList.contains('is-open')) return;
      // Игнорируем тачи по кнопкам/ссылкам, чтобы не мешать их нажатию
      if (e.target.closest('button') || e.target.closest('a')) return;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sheet.addEventListener('touchend', (e) => {
      if (!sheet.classList.contains('is-open')) return;
      if (e.target.closest('button') || e.target.closest('a')) return;

      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchEndY - touchStartY;

      // Закрываем только при свайпе вниз (deltaY > 0) на расстояние > 50px
      // и только если контент прокручен до самого верха (защита от случайного закрытия)
      if (deltaY > 50 && sheet.scrollTop === 0) {
        closeSheet();
      }
    }, { passive: true });
  }

})();



/* ═══════════════════════════════════════════════════════════════════════════════
   ДЕСКТОПНЫЙ ZOOM ДЛЯ КАРТОЧЕК КРАФТА (только экраны ≥ 1081px)
   ═══════════════════════════════════════════════════════════════════════════════ */

function initArtZoom() {
  // Только десктоп
  if (!window.matchMedia('(min-width: 1081px)').matches) return;

  const craftContainer = document.getElementById('craft-cards-container');
  if (!craftContainer) return;

  const cards = craftContainer.querySelectorAll('.card--craft');
  const allCards = cards; // сохраняем для использования в скролле
  if (cards.length === 0) return;

  const craftZone = document.getElementById('zone-craft');
  let scrollTimer = null;

  // Функция для применения зума к одной карточке по координатам мыши
  function applyZoomToCard(card, x, y) {
    if (!card) return;
    const img = card.querySelector('.card__image-wrap img');
    if (!img) return;

    const rect = card.getBoundingClientRect();
    const mouseX = x - rect.left;
    const width = rect.width;
    const ratio = Math.min(Math.max(mouseX / width, 0), 1);

    let scale = 1;
    if (ratio < 0.4) {
      const t = ratio / 0.4;
      scale = 1 + (1 - t) * 1;
    }

    if (scale > 1) {
      card.classList.add('is-zoomed');
    } else {
      card.classList.remove('is-zoomed');
    }
    img.style.transform = `scale(${scale})`;
  }

  cards.forEach((card) => {
    const img = card.querySelector('.card__image-wrap img');
    if (!img) return;

    // Удаляем старые обработчики
    card.removeEventListener('mouseenter', card._zoomEnter);
    card.removeEventListener('mousemove', card._zoomMove);
    card.removeEventListener('mouseleave', card._zoomLeave);

    const onEnter = () => {
      applyZoomToCard(card, lastMouseX, lastMouseY);
    };

    const onMove = (e) => {
      applyZoomToCard(card, e.clientX, e.clientY);
    };

    const onLeave = () => {
      card.classList.remove('is-zoomed');
      img.style.transform = '';
    };

    card._zoomEnter = onEnter;
    card._zoomMove = onMove;
    card._zoomLeave = onLeave;

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });

  // Обработчик скролла с debounce 100ms
  if (craftZone) {
    craftZone.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        // Находим элемент под курсором
        const el = document.elementFromPoint(lastMouseX, lastMouseY);
        const cardUnderCursor = el ? el.closest('.card--craft') : null;

        // Сбрасываем зум у всех карточек
        allCards.forEach(c => {
          const imgEl = c.querySelector('.card__image-wrap img');
          if (imgEl) {
            c.classList.remove('is-zoomed');
            imgEl.style.transform = '';
          }
        });

        // Если под курсором есть карточка — применяем зум к ней
        if (cardUnderCursor) {
          applyZoomToCard(cardUnderCursor, lastMouseX, lastMouseY);
        }
      }, 150);
    });
  }
}



/* ═══════════════════════════════════════════════════════════════════════════════
   6. РЕНДЕР КАРТОЧЕК ИЗ JSON
   Все три функции вызываются асинхронно — независимо друг от друга.
   Ошибка в одном JSON не блокирует рендер остальных зон.
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── 6a. Крафт ──────────────────────────────────────────────────────────────── */
async function renderCraft() {
  const container = document.getElementById('craft-cards-container');
  if (!container) return;

  let items;
  try {
    const response = await fetch('data/craft.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    items = await response.json();
  } catch (err) {
    console.warn('[main-page.js] Ошибка загрузки craft.json:', err);
    renderPlaceholder(container);
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    renderPlaceholder(container);
    return;
  }

  container.textContent = '';
  const total = items.length;

  items.forEach((item, index) => {
    // Первые 3 карточки — eager (видны при загрузке), остальные — lazy
    const isEager = index < 3;

    // <article class="card card--craft">
    const article = document.createElement('article');
    article.className = 'card card--craft';

    // Обёртка картинки
    const imageWrap = document.createElement('div');
    imageWrap.className = 'card__image-wrap';

    const img = document.createElement('img');
    if (hasValue(item.src))  img.src    = item.src;
    if (hasValue(item.alt))  img.alt    = item.alt;
    else                     img.alt    = '';
    img.width   = item.width  || 280;
    img.height  = item.height || 210;
    img.loading = isEager ? 'eager' : 'lazy';

    imageWrap.appendChild(img);
    article.appendChild(imageWrap);

    // Подпись
    const caption = document.createElement('div');
    caption.className = 'card-caption-craft';

    // Счётчик
    const counter = document.createElement('p');
    counter.className = 'card__counter mono';
    counter.textContent = `${index + 1}/${total}`;
    caption.appendChild(counter);

    // Заголовок
    if (hasValue(item.title)) {
      const title = document.createElement('h3');
      title.className = 'card__title';
      title.textContent = item.title;
      caption.appendChild(title);
    }

    // Дата
    if (hasValue(item.date)) {
      const meta = document.createElement('p');
      meta.className = 'card__meta mono';
      meta.textContent = item.date;
      caption.appendChild(meta);
    }

    article.appendChild(caption);
    container.appendChild(article);
  });

  initArtZoom();

}


/* ─── 6b. Поэзия ─────────────────────────────────────────────────────────────── */
async function renderPoetry() {
  const container = document.getElementById('poetry-cards-container');
  if (!container) return;

  let items;
  try {
    const response = await fetch('data/poetry.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    items = await response.json();
  } catch (err) {
    console.warn('[main-page.js] Ошибка загрузки poetry.json:', err);
    renderPlaceholder(container);
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    renderPlaceholder(container);
    return;
  }

  container.textContent = '';
  const total = items.length;

  items.forEach((item, index) => {
    const article = document.createElement('article');
    article.className = 'card card--poetry';

    // Шапка карточки
    const header = document.createElement('header');
    header.className = 'card__poetry-header';

    const counter = document.createElement('p');
    counter.className = 'card__counter mono';
    counter.textContent = `${index + 1}/${total}`;
    header.appendChild(counter);

    if (hasValue(item.date)) {
      const time = document.createElement('time');
      time.className = 'card__date mono';
      if (hasValue(item.datetime)) time.setAttribute('datetime', item.datetime);
      time.textContent = item.date;
      header.appendChild(time);
    }

    if (hasValue(item.title)) {
      const h3 = document.createElement('h3');
      h3.className = 'card__title';
      h3.textContent = item.title;
      header.appendChild(h3);
    }

    article.appendChild(header);

    // Тело карточки
    const body = document.createElement('div');
    body.className = 'card__poetry-body';

    // Текст стиха
    let textEl = document.createElement('p');
    textEl.className = 'card__poetry-text';

    const lines = item.text.split('\n');
    lines.forEach((line, i) => {
      textEl.appendChild(document.createTextNode(line));
      if (i < lines.length - 1) {
        textEl.appendChild(document.createElement('br'));
      }
    });

    body.appendChild(textEl);
    article.appendChild(body);

    // --- АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ НУЖНОСТИ КНОПКИ ---
    // Временно добавляем карточку в DOM, чтобы измерить высоту
    container.appendChild(article);

    // Получаем ограничение max-height из CSS (13.5em)
    const maxHeight = parseFloat(getComputedStyle(textEl).maxHeight) || 0;
    const scrollHeight = textEl.scrollHeight;

    // Если текст превышает maxHeight, добавляем кнопку
    if (scrollHeight > maxHeight + 2) { // +2 для погрешности
      const btn = document.createElement('button');
      btn.className = 'poetry-toggle-btn mono';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '[...]';
      body.appendChild(btn);
    } else {
      // Если текста мало, сразу раскрываем и не добавляем кнопку
      article.classList.add('is-expanded');
    }

    // После измерения и добавления кнопки, оставляем карточку в DOM
    // (она уже добавлена через container.appendChild)
  });

  // Инициализируем интерактив (ховеры, клики) — для всех карточек,
  // даже у которых нет кнопки, обработчики будут навешаны, но не сработают
  initPoetryExpand();
}





/* ─── 6c. Проекты ────────────────────────────────────────────────────────────── */
async function renderProjects() {
  const container = document.getElementById('projects-cards-container');
  if (!container) return;

  let items;
  try {
    const response = await fetch('data/projects.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    items = await response.json();
  } catch (err) {
    console.warn('[main-page.js] Ошибка загрузки projects.json:', err);
    renderPlaceholder(container);
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    renderPlaceholder(container);
    return;
  }

  container.textContent = '';

  items.forEach((item, index) => {
    // Первые 3 карточки — eager, остальные — lazy
    const isEager = index < 3;

    // Валидация ссылки: если пустая или '#' — рендерим <div>, иначе <a>
    const hasLink = isValidLink(item.link);
    const card = document.createElement(hasLink ? 'a' : 'div');
    card.className = 'card card--project';

    if (hasLink) {
      card.href = item.link;
      if (hasValue(item.title)) {
        card.setAttribute('aria-label', `Открыть кейс: ${item.title}`);
      }
    }

    // Обёртка картинки
    const imageWrap = document.createElement('div');
    imageWrap.className = 'card__image-wrap';

    const img = document.createElement('img');
    if (hasValue(item.src)) img.src   = item.src;
    if (hasValue(item.alt)) img.alt   = item.alt;
    else                    img.alt   = '';
    img.width   = 658;
    img.height  = 352;
    img.loading = isEager ? 'eager' : 'lazy';

    imageWrap.appendChild(img);
    card.appendChild(imageWrap);

    // Подпись проекта
    const info = document.createElement('div');
    info.className = 'card__project-info';

    if (hasValue(item.title)) {
      const h3 = document.createElement('h3');
      h3.className = 'card__title';
      h3.textContent = item.title;
      info.appendChild(h3);
    }

    card.appendChild(info);
    container.appendChild(card);
  });

  updateProjectsCardWidth();
}




// ============================================================================
// ДИНАМИЧЕСКАЯ ШИРИНА КАРТОЧЕК ПРОЕКТОВ (ДЕСКТОП)
// ============================================================================

function updateProjectsCardWidth() {
  // Только десктоп
  if (window.innerWidth <= 1080) return;

  const zone = document.getElementById('zone-projects');
  const container = document.getElementById('projects-cards-container');
  if (!zone || !container) return;

  const cards = container.querySelectorAll('.card--project');
  if (cards.length === 0) return;

  const zoneHeight = Math.round(zone.offsetHeight);
  if (zoneHeight === 0) return;

  // Высота подписи (берём первую карточку)
  const firstCard = cards[0];
  const caption = firstCard.querySelector('.card__project-info');
  let captionHeight = 60;
  if (caption) {
    captionHeight = caption.offsetHeight || 60;
    captionHeight += 44; // небольшой запас
  }

  const imageHeight = Math.round(zoneHeight - captionHeight);
  if (imageHeight <= 0) return;

  // Пропорция 658/352
  const cardWidth = Math.round(imageHeight * (658 / 352));

  cards.forEach(card => {
    card.style.width = cardWidth + 'px';
    card.style.height = zoneHeight + 'px';

    const imageWrap = card.querySelector('.card__image-wrap');
    if (imageWrap) {
      imageWrap.style.height = imageHeight + 'px';
    }
  });
}

// Вызов после рендера проектов
// В конце функции renderProjects() добавьте:
// updateProjectsCardWidth();







/* =============================================================================
   MOBILE ADAPTIVE — Off-canvas панели (Крафт / Поэзия) + Оверлей
   Весь блок работает строго на экранах ≤ 1080px по схеме из макета.
   ============================================================================= */
(function initMobilePanels() {
  // Активируем код строго на мобильных экранах
  if (!window.matchMedia('(max-width: 1080px)').matches) return;

  const overlay    = document.getElementById('site-overlay');
  const zoneCraft  = document.getElementById('zone-craft');
  const zonePoetry = document.getElementById('zone-poetry');
  const btnCraft   = document.querySelector('.header-zone-btn--craft');
  const btnPoetry  = document.querySelector('.header-zone-btn--poetry');
  const closeBtns  = document.querySelectorAll('.panel-close-btn');

  function setAriaExpanded(panel, expanded) {
  const btn = panel === zoneCraft ? btnCraft : (panel === zonePoetry ? btnPoetry : null);
  if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function showOverlay() {
    if (overlay) overlay.classList.add('is-visible');
  }

  function hideOverlay() {
    if (overlay) overlay.classList.remove('is-visible');
  }

  function closeAllPanels() {
    let activeBtn = null;
    if (zoneCraft && zoneCraft.classList.contains('is-open')) {
      activeBtn = btnCraft;
    } else if (zonePoetry && zonePoetry.classList.contains('is-open')) {
      activeBtn = btnPoetry;
    }

    if (zoneCraft) zoneCraft.classList.remove('is-open');
    if (zonePoetry) zonePoetry.classList.remove('is-open');
    hideOverlay();
    history.replaceState(null, '', window.location.pathname);
    if (btnCraft)  btnCraft.setAttribute('aria-expanded', 'false');
    if (btnPoetry) btnPoetry.setAttribute('aria-expanded', 'false');
    if (activeBtn) setTimeout(() => activeBtn.focus(), 0);
  }

  /** Открытие конкретной панели с выводом оверлея */
  function openPanel(panelEl, hash) {
    closeAllPanels();
    if (!panelEl) return;
    panelEl.classList.add('is-open');
    showOverlay();
    history.replaceState(null, '', hash);
    setAriaExpanded(panelEl, true);

    // Убираем aria-hidden у заголовка панели, чтобы фокус был доступен
    const closeBtn = panelEl.querySelector('.panel-close-btn');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 0);
  }

  /* ── Тапы по кнопкам в Шапке ── */
  if (btnCraft) {
    btnCraft.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = zoneCraft && zoneCraft.classList.contains('is-open');
      isOpen ? closeAllPanels() : openPanel(zoneCraft, '#craft');
    });
  }

  if (btnPoetry) {
    btnPoetry.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = zonePoetry && zonePoetry.classList.contains('is-open');
      isOpen ? closeAllPanels() : openPanel(zonePoetry, '#poetry');
    });
  }

  /* ── Тапы по крестикам внутри панелей ── */
  closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllPanels();
    });
  });

  /* ── Тап по Оверлею (клики на оставшиеся 15% экрана сбоку) ── */
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllPanels();
    });
  }

  /* ── Умный нативный свайп для закрытия шторки пальцем ── */
  function addSwipeClose(panelEl, direction) {
    if (!panelEl) return;
    let startX = 0;
    let startY = 0;

    panelEl.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    panelEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;

      // Защита: горизонтальный сдвиг должен быть в 2 раза сильнее вертикального.
      // Это полностью исключает закрытие панели при обычном чтении или прокрутке контента.
      if (Math.abs(dx) < Math.abs(dy) * 2) return;

      // Крафт (левая шторка) закрывается свайпом влево, Поэзия (правая) — вправо
      if (direction === 'left'  && dx < -60) closeAllPanels();
      if (direction === 'right' && dx >  60) closeAllPanels();
    }, { passive: true });
  }

  addSwipeClose(zoneCraft,  'left');
  addSwipeClose(zonePoetry, 'right');

  /* ── Глубокие ссылки: открытие шторки сразу при загрузке по хэшу ── */
  const hash = window.location.hash;
  if (hash === '#craft') {
    openPanel(zoneCraft, '#craft');
   setAriaExpanded(zoneCraft, true);
  }
  if (hash === '#poetry') {
    openPanel(zonePoetry, '#poetry');
    setAriaExpanded(zonePoetry, true);
  }

  /* ── Добавляем слушатель popstate для синхронизации состояния панелей с хэшем (свайп "назад" будет закрывать панель)── */
  window.addEventListener('popstate', () => {
    const hash = window.location.hash;
    if (hash === '#craft') {
      openPanel(zoneCraft, '#craft');
    } else if (hash === '#poetry') {
      openPanel(zonePoetry, '#poetry');
    } else {
      closeAllPanels();
    }
  });
})();


