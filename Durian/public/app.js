// ============================================
// Durian SMS Dashboard - Client Logic
// ============================================

const CONFIG_KEY = 'durian_config';
const SESSION_KEY = 'durian_session';
const TIMER_DURATION = 300; // 5 минут в секундах

// ============================================
// Инициализация
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadSession();
  setupEventListeners();
  logEvent('🚀 Панель загружена', 'info');
});

// ============================================
// Настройки
// ============================================

function loadSettings() {
  const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  if (config.username) document.getElementById('username').value = config.username;
  if (config.apikey) document.getElementById('apikey').value = config.apikey;
  if (config.defaultPid) {
    document.getElementById('default-pid').value = config.defaultPid;
    document.getElementById('pid').value = config.defaultPid;
  }
  if (config.defaultCountry) {
    document.getElementById('default-country').value = config.defaultCountry;
    document.getElementById('country').value = config.defaultCountry;
  }
}

function saveSettings() {
  const config = {
    username: document.getElementById('username').value.trim(),
    apikey: document.getElementById('apikey').value.trim(),
    defaultPid: document.getElementById('default-pid').value.trim(),
    defaultCountry: document.getElementById('default-country').value
  };

  if (!config.username || !config.apikey) {
    showSettingsStatus('❌ Username и ApiKey обязательны', 'error');
    return;
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  
  // Применяем к основным полям
  document.getElementById('pid').value = config.defaultPid;
  document.getElementById('country').value = config.defaultCountry;
  
  showSettingsStatus('✅ Настройки сохранены', 'success');
  logEvent('⚙️ Настройки сохранены', 'success');
}

function clearSettings() {
  localStorage.removeItem(CONFIG_KEY);
  document.getElementById('username').value = '';
  document.getElementById('apikey').value = '';
  document.getElementById('default-pid').value = '';
  document.getElementById('pid').value = '';
  showSettingsStatus('🗑️ Настройки очищены', 'success');
  logEvent('🗑️ Настройки сброшены', 'warning');
}

function showSettingsStatus(message, type) {
  const el = document.getElementById('settings-status');
  el.textContent = message;
  el.className = `status-message ${type}`;
  setTimeout(() => {
    el.textContent = '';
    el.className = '';
  }, 5000);
}

// ============================================
// API Запросы через прокси
// ============================================

async function callDurianAPI(endpoint, params = {}) {
  const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  
  if (!config.username || !config.apikey) {
    throw new Error('❌ Сначала настройте Username и ApiKey');
  }

  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint,
      params,
      username: config.username,
      apikey: config.apikey
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || `HTTP ${response.status}`);
  }

  const result = await response.json();
  
  // Обработка кодов ошибок API
  if (result.code !== 200 && result.code !== 201 && result.code !== 202) {
    throw new Error(`API Error ${result.code}: ${result.msg}`);
  }

  return result;
}

// ============================================
// Получение номера
// ============================================

async function getNumber() {
  const pid = document.getElementById('pid').value.trim();
  const country = document.getElementById('country').value;

  if (!pid) {
    showToast('❌ Введите PID сервиса', 'error');
    return;
  }

  const btn = document.getElementById('get-number');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const result = await callDurianAPI('getMobileCode', {
      pid,
      cuy: country === 'any' ? '' : country,
      serial: 2,
      noblack: 1
    });

    // Парсинг ответа: "+19991234567,+1"
    const dataString = Array.isArray(result.data) ? result.data[0] : result.data;
    const [fullPhone, countryCode] = dataString.split(',');
    
    // Убираем +1 для отображения
    const cleanNumber = fullPhone.replace(/^\+?1/, '');

    // Отображение
    document.getElementById('phone-display').value = cleanNumber;
    document.getElementById('phone-display').dataset.fullPhone = fullPhone;
    
    // Активация кнопок
    enableSessionButtons(true);
    
    // Сохранение сессии
    saveSession({
      phone: fullPhone,
      cleanNumber,
      pid,
      country,
      endTime: Date.now() + TIMER_DURATION * 1000
    });

    // Запуск таймера
    startTimer(TIMER_DURATION);

    // Логирование
    logEvent(`✅ Номер получен: ${fullPhone}`, 'success');
    showToast('📞 Номер успешно получен!', 'success');

    // Авто-копирование
    await copyToClipboard(cleanNumber);
    showToast('📋 Номер скопирован в буфер', 'success');

  } catch (error) {
    logEvent(`❌ Ошибка получения номера: ${error.message}`, 'error');
    showToast(error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ============================================
// Освобождение номера
// ============================================

async function releaseNumber() {
  const session = getSession();
  if (!session || !session.phone) {
    showToast('❌ Нет активного номера', 'error');
    return;
  }

  const btn = document.getElementById('release-number');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await callDurianAPI('passMobile', {
      pid: session.pid,
      pn: session.phone,
      serial: 2
    });

    logEvent(`🗑️ Номер освобожден: ${session.phone}`, 'success');
    showToast('🗑️ Номер освобожден', 'success');
    clearSession();

  } catch (error) {
    logEvent(`❌ Ошибка освобождения: ${error.message}`, 'error');
    showToast(error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ============================================
// Черный список
// ============================================

async function blacklistNumber() {
  const session = getSession();
  if (!session || !session.phone) {
    showToast('❌ Нет активного номера', 'error');
    return;
  }

  const btn = document.getElementById('blacklist-number');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await callDurianAPI('addBlack', {
      pid: session.pid,
      pn: session.phone
    });

    logEvent(`⛔ Номер добавлен в черный список: ${session.phone}`, 'warning');
    showToast('⛔ Номер в черном списке', 'warning');
    clearSession();

  } catch (error) {
    logEvent(`❌ Ошибка blacklist: ${error.message}`, 'error');
    showToast(error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ============================================
// Проверка SMS
// ============================================

async function checkSMS() {
  const session = getSession();
  if (!session || !session.phone) {
    showToast('❌ Нет активного номера', 'error');
    return;
  }

  const btn = document.getElementById('check-sms');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const result = await callDurianAPI('getMsg', {
      pid: session.pid,
      pn: session.phone,
      serial: 2
    });

    if (result.code === 200 && result.data) {
      document.getElementById('sms-code').value = result.data;
      document.getElementById('copy-code').disabled = false;
      logEvent(`📨 SMS получен: ${result.data}`, 'success');
      showToast('📨 SMS код получен!', 'success');
      stopAutoPoll();
    } else if (result.code === 407) {
      logEvent('🔄 SMS еще нет, повторите через 15 сек', 'info');
      showToast('⏳ SMS еще нет, ждем...', 'warning');
    } else {
      logEvent(`⏳ Статус: ${result.msg}`, 'info');
    }

  } catch (error) {
    logEvent(`❌ Ошибка проверки SMS: ${error.message}`, 'error');
    showToast(error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ============================================
// Авто-опрос SMS
// ============================================

let autoPollInterval = null;
let autoPollEnabled = false;

function toggleAutoPoll() {
  const btn = document.getElementById('auto-poll-toggle');
  
  if (autoPollEnabled) {
    stopAutoPoll();
  } else {
    startAutoPoll();
  }
}

function startAutoPoll() {
  const session = getSession();
  if (!session || !session.phone) {
    showToast('❌ Сначала получите номер', 'error');
    return;
  }

  autoPollEnabled = true;
  document.getElementById('auto-poll-toggle').textContent = '🤖 Авто-опрос: ВКЛ';
  document.getElementById('auto-poll-toggle').classList.add('btn-primary');
  
  logEvent('🤖 Авто-опрос SMS запущен (каждые 15 сек)', 'info');
  
  // Первая проверка сразу
  checkSMS();
  
  // Затем каждые 15 секунд
  autoPollInterval = setInterval(() => {
    checkSMS();
  }, 15000);
}

function stopAutoPoll() {
  autoPollEnabled = false;
  if (autoPollInterval) {
    clearInterval(autoPollInterval);
    autoPollInterval = null;
  }
  document.getElementById('auto-poll-toggle').textContent = '🤖 Авто-опрос: ВЫКЛ';
  document.getElementById('auto-poll-toggle').classList.remove('btn-primary');
  logEvent('🛑 Авто-опрос SMS остановлен', 'info');
}

// ============================================
// Таймер
// ============================================

let timerInterval = null;

function startTimer(durationSeconds) {
  if (timerInterval) clearInterval(timerInterval);
  
  const session = getSession();
  if (!session || !session.endTime) {
    session.endTime = Date.now() + durationSeconds * 1000;
    saveSession(session);
  }

  updateTimerDisplay();
  
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const session = getSession();
  if (!session || !session.endTime) {
    stopTimer();
    return;
  }

  const remaining = Math.max(0, session.endTime - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  const display = document.getElementById('timer-display');
  const barFill = document.getElementById('timer-bar-fill');
  
  display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Прогресс-бар
  const percentage = (remaining / (TIMER_DURATION * 1000)) * 100;
  barFill.style.width = `${percentage}%`;
  
  // Цветовая индикация
  display.classList.remove('warning', 'danger', 'expired');
  barFill.classList.remove('warning', 'danger');
  
  if (remaining <= 0) {
    display.classList.add('expired');
    display.textContent = '⏰ ИСТЕК';
    stopTimer();
    logEvent('⏰ Время номера истекло!', 'error');
    showToast('⏰ Номер истек!', 'error');
    enableSessionButtons(false);
  } else if (remaining <= 30000) {
    display.classList.add('danger');
    barFill.classList.add('danger');
  } else if (remaining <= 60000) {
    display.classList.add('warning');
    barFill.classList.add('warning');
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ============================================
// Копирование
// ============================================

async function copyNumber() {
  const input = document.getElementById('phone-display');
  const number = input.value;
  
  if (!number) {
    showToast('❌ Нет номера для копирования', 'error');
    return;
  }

  await copyToClipboard(number);
  showToast('📋 Номер скопирован!', 'success');
  logEvent('📋 Номер скопирован в буфер', 'info');
}

async function copyCode() {
  const input = document.getElementById('sms-code');
  const code = input.value;
  
  if (!code) {
    showToast('❌ Нет кода для копирования', 'error');
    return;
  }

  await copyToClipboard(code);
  showToast('🔐 Код скопирован!', 'success');
  logEvent('🔐 SMS код скопирован в буфер', 'info');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback для старых браузеров
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// ============================================
// Сессия
// ============================================

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
}

function loadSession() {
  const session = getSession();
  if (session && session.phone) {
    document.getElementById('phone-display').value = session.cleanNumber || session.phone.replace(/^\+?1/, '');
    document.getElementById('phone-display').dataset.fullPhone = session.phone;
    
    if (session.endTime && session.endTime > Date.now()) {
      enableSessionButtons(true);
      startTimer(0); // Таймер восстановится из session.endTime
    } else {
      clearSession();
    }
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('phone-display').value = '';
  document.getElementById('sms-code').value = '';
  document.getElementById('copy-number').disabled = true;
  document.getElementById('copy-code').disabled = true;
  enableSessionButtons(false);
  stopTimer();
  stopAutoPoll();
  
  const display = document.getElementById('timer-display');
  display.textContent = '00:00';
  display.classList.remove('warning', 'danger', 'expired');
  document.getElementById('timer-bar-fill').style.width = '100%';
}

function enableSessionButtons(enabled) {
  document.getElementById('release-number').disabled = !enabled;
  document.getElementById('blacklist-number').disabled = !enabled;
  document.getElementById('copy-number').disabled = !enabled;
  document.getElementById('check-sms').disabled = !enabled;
  
  if (enabled) {
    document.getElementById('copy-number').disabled = false;
  }
}

// ============================================
// Логирование
// ============================================

function logEvent(message, type = 'info') {
  const log = document.getElementById('event-log');
  const entry = document.createElement('div');
  entry.className = `event-log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  entry.textContent = `[${timestamp}] ${message}`;
  
  log.insertBefore(entry, log.firstChild);
  
  // Ограничение лога (последние 100 записей)
  while (log.children.length > 100) {
    log.removeChild(log.lastChild);
  }
}

// ============================================
// Уведомления (Toast)
// ============================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Анимация появления
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Исчезновение через 3 секунды
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// Проверка подключения (тест API ключа)
// ============================================

async function testConnection() {
  const btn = document.getElementById('test-connection');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const result = await callDurianAPI('getUserInfo', {});
    
    if (result.code === 200) {
      showSettingsStatus(`✅ Подключено! Баланс: ${result.data.score}`, 'success');
      logEvent(`✅ Тест подключения успешен. Баланс: ${result.data.score}`, 'success');
    } else {
      showSettingsStatus(`❌ Ошибка: ${result.msg}`, 'error');
    }
  } catch (error) {
    showSettingsStatus(`❌ ${error.message}`, 'error');
    logEvent(`❌ Тест подключения failed: ${error.message}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Настройки
  document.getElementById('toggle-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('hidden');
  });

  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('clear-settings').addEventListener('click', clearSettings);
  document.getElementById('test-connection').addEventListener('click', testConnection);

  // Показать/скрыть API ключ
  document.getElementById('toggle-apikey').addEventListener('click', () => {
    const input = document.getElementById('apikey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Основные действия
  document.getElementById('get-number').addEventListener('click', getNumber);
  document.getElementById('release-number').addEventListener('click', releaseNumber);
  document.getElementById('blacklist-number').addEventListener('click', blacklistNumber);
  document.getElementById('check-sms').addEventListener('click', checkSMS);
  document.getElementById('auto-poll-toggle').addEventListener('click', toggleAutoPoll);

  // Копирование
  document.getElementById('copy-number').addEventListener('click', copyNumber);
  document.getElementById('copy-code').addEventListener('click', copyCode);

  // Лог
  document.getElementById('clear-log').addEventListener('click', () => {
    document.getElementById('event-log').innerHTML = '';
    logEvent('🗑️ Лог очищен', 'info');
  });

  // Синхронизация настроек с основными полями
  document.getElementById('default-pid').addEventListener('change', (e) => {
    document.getElementById('pid').value = e.target.value;
  });
  
  document.getElementById('default-country').addEventListener('change', (e) => {
    document.getElementById('country').value = e.target.value;
  });
}

// ============================================
// Предупреждение при закрытии с активным таймером
// ============================================

window.addEventListener('beforeunload', (e) => {
  const session = getSession();
  if (session && session.endTime && session.endTime > Date.now()) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});