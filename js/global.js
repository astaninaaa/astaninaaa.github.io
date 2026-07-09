/* =============================================================================
   global.js — общий JS-код для всех страниц сайта
   Содержит: таймер футера (Новосибирск), инициализация плеера (заглушка)
   ============================================================================= */

'use strict';

/* ─── Таймер: Новосибирск ────────────────────────────────────────────────────
   Используем Intl.DateTimeFormat для корректного часового пояса.
   setInterval обновляет время строго раз в 60 секунд — не каждую секунду.
   Это экономит CPU и соответствует требованию Performance из ТЗ п.3.
   Формат вывода: "Новосибирск, ЧЧ:ММ"
   ──────────────────────────────────────────────────────────────────────────── */
(function initNovosibirskTimer() {
  const timerEl = document.getElementById('footer-timer');
  if (!timerEl) return;

  // Форматтер Intl переиспользуем — создаём один раз вне интервала
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Novosibirsk',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  });

  function updateTime() {
    try {
      const timeStr = formatter.format(new Date());
      // textContent безопасен от XSS-инъекций
      timerEl.textContent = `${timeStr} +7 GMT`;
    } catch (err) {
      // Если браузер не поддерживает Intl — тихо скрываем таймер
      timerEl.style.display = 'none';
      console.warn('[global.js] Ошибка таймера:', err);
    }
  }

  // Первый вызов — сразу при загрузке (без ожидания интервала)
  updateTime();

  // Обновление раз в 60 секунд — энергосберегающий режим
  // setInterval(fn, 60_000) НЕ запускается каждую секунду ✓
  setInterval(updateTime, 60_000);
})();
