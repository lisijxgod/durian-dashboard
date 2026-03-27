export const config = {
  runtime: 'nodejs',
  bodyParser: true, // 🔥 Важно: включаем парсинг тела
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔥 Получаем данные из req.body (Vercel уже распарсил)
    const { endpoint, params, username, apikey } = req.body;

    // Валидация
    if (!endpoint || !username || !apikey) {
      return res.status(400).json({ 
        code: 400, 
        msg: 'Missing required fields',
        received: { endpoint: !!endpoint, username: !!username, apikey: !!apikey }
      });
    }

    // Формируем URL для Durian API
    const url = new URL(`https://api.durianrcs.com/out/ext_api/${endpoint}`);
    url.searchParams.append('name', username);
    url.searchParams.append('ApiKey', apikey);

    // Добавляем параметры
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Делаем запрос к Durian
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Durian-Dashboard/1.0'
      }
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('[Proxy Error]:', error);
    return res.status(500).json({ 
      code: 500, 
      msg: 'Internal server error',
      details: error.message 
    });
  }
}
