// 🔍 ДИАГНОСТИЧЕСКАЯ ВЕРСИЯ — покажет, что получает сервер

export const config = {
  runtime: 'edge', // 🔥 Пробуем edge runtime (лучше парсит JSON)
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // 🔍 ЛОГИРУЕМ ВСЁ, что приходит
    console.log('📦 RAW req.body:', req.body);
    console.log('📦 Type of req.body:', typeof req.body);
    
    // Пытаемся получить данные
    let data;
    
    // Для edge runtime: нужно явно читать текст
    if (req.json && typeof req.json === 'function') {
      data = await req.json();
      console.log('✅ Parsed via req.json():', data);
    } 
    // Для nodejs runtime: body уже распарсен
    else if (typeof req.body === 'object' && req.body !== null) {
      data = req.body;
      console.log('✅ Using req.body as object:', data);
    }
    // Если строка — парсим
    else if (typeof req.body === 'string') {
      data = JSON.parse(req.body);
      console.log('✅ Parsed string body:', data);
    }
    else {
      // 🔴 Не смогли распарсить — возвращаем диагностику
      return res.status(400).json({
        code: 400,
        msg: 'Invalid JSON body',
        debug: {
          bodyType: typeof req.body,
          bodyValue: req.body,
          bodyString: String(req.body)
        }
      });
    }

    // Достаём поля
    const { endpoint, params, username, apikey } = data;
    
    console.log('🔑 Полученные данные:', { endpoint, username, apikey: apikey ? '***' : undefined });

    // Валидация
    if (!endpoint || !username || !apikey) {
      return res.status(400).json({
        code: 400,
        msg: 'Missing fields',
        received: { endpoint, username: !!username, apikey: !!apikey }
      });
    }

    // Запрос к Durian
    const url = new URL(`https://api.durianrcs.com/out/ext_api/${endpoint}`);
    url.searchParams.append('name', username);
    url.searchParams.append('ApiKey', apikey);
    
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.append(k, String(v));
      });
    }

    const response = await fetch(url.toString());
    const result = await response.json();
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('💥 Proxy error:', error);
    return res.status(500).json({
      code: 500,
      msg: 'Server error',
      error: error.message,
      stack: error.stack
    });
  }
}
 
