/**
 * Durian API Proxy - Serverless Function
 * 
 * Этот файл обрабатывает запросы от фронтенда и пересылает их
 * на официальный API Durian RCS, подставляя учетные данные.
 * 
 * Размещается в папке /api для автоматического деплоя на Vercel
 */

export default async function handler(req, res) {
  // ============================================
  // CORS Headers
  // ============================================
  
  const allowedOrigin = req.headers.origin;
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ============================================
  // Проверка метода
  // ============================================
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      code: 405, 
      msg: 'Method not allowed. Use POST.' 
    });
  }

  // ============================================
  // Парсинг тела запроса
  // ============================================
  
  let body;
  try {
    body = JSON.parse(req.body);
  } catch (e) {
    return res.status(400).json({ 
      code: 400, 
      msg: 'Invalid JSON body' 
    });
  }

  const { endpoint, params, username, apikey } = body;

  // ============================================
  // Валидация обязательных полей
  // ============================================
  
  if (!endpoint) {
    return res.status(400).json({ 
      code: 400, 
      msg: 'Missing required field: endpoint' 
    });
  }

  if (!username || !apikey) {
    return res.status(401).json({ 
      code: 401, 
      msg: 'Missing credentials: username and apikey required' 
    });
  }

  // ============================================
  // Whitelist разрешенных эндпоинтов
  // ============================================
  
  const allowedEndpoints = [
    'getUserInfo',
    'getMobile',
    'getMobileCode',
    'getMsg',
    'passMobile',
    'addBlack',
    'getStatus',
    'getBlack',
    'getCountryPhoneNum'
  ];

  if (!allowedEndpoints.includes(endpoint)) {
    return res.status(403).json({ 
      code: 403, 
      msg: `Endpoint '${endpoint}' is not allowed` 
    });
  }

  // ============================================
  // Формирование запроса к Durian API
  // ============================================
  
  const baseUrl = 'https://api.durianrcs.com/out/ext_api';
  const url = new URL(`${baseUrl}/${endpoint}`);
  
  // Обязательные параметры
  url.searchParams.append('name', username);
  url.searchParams.append('ApiKey', apikey);
  
  // Дополнительные параметры
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // ============================================
  // Выполнение запроса
  // ============================================
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Durian-Dashboard/1.0'
      },
      timeout: 30000 // 30 секунд таймаут
    });

    const data = await response.json();

    // ============================================
    // Логирование ошибок (для отладки)
    // ============================================
    
    if (data.code !== 200 && data.code !== 201 && data.code !== 202) {
      console.log(`[Durian Proxy] API Error: ${endpoint} - Code: ${data.code} - Msg: ${data.msg}`);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('[Durian Proxy] Request failed:', error.message);
    
    return res.status(500).json({ 
      code: 500, 
      msg: 'Proxy request failed', 
      details: error.message 
    });
  }
}

// ============================================
// Конфигурация Vercel (опционально)
// ============================================

export const config = {
  runtime: 'nodejs',
  maxDuration: 30 // Максимальное время выполнения в секундах
};