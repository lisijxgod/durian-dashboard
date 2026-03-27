// @ts-nocheck

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ code: 405, msg: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // 🔥 Читаем тело как текст и парсим
    const text = await request.text();
    console.log('📦 Raw body:', text);
    
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      console.error('❌ Parse error:', e);
      return new Response(
        JSON.stringify({ 
          code: 400, 
          msg: 'Invalid JSON body',
          rawBody: text,
          error: e.message 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Parsed body:', body);

    const { endpoint, params, username, apikey } = body;

    // Валидация
    if (!endpoint || !username || !apikey) {
      return new Response(
        JSON.stringify({ 
          code: 400, 
          msg: 'Missing required fields',
          received: { endpoint, username: !!username, apikey: !!apikey }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Формируем URL для Durian API
    const url = new URL(`https://api.durianrcs.com/out/ext_api/${endpoint}`);
    url.searchParams.append('name', username);
    url.searchParams.append('ApiKey', apikey);

    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    console.log('🔗 Requesting:', url.toString());

    // Запрос к Durian
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Durian-Dashboard/1.0'
      }
    });

    const data = await response.json();
    console.log('✅ Durian response:', data);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Proxy error:', error);
    return new Response(
      JSON.stringify({ 
        code: 500, 
        msg: 'Server error',
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}
