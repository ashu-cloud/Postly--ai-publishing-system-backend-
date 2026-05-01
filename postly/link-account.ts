import https from 'https';

const API_URL = 'https://postly-ai-publishing-system-backend.onrender.com';
const CHAT_ID = '1047713632';

async function fetchAPI(path: string, method: string, body: any = null, token: string = '') {
  return new Promise<any>((resolve, reject) => {
    const options: https.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = https.request(`${API_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Registering/Logging in to Render API...');
    
    // Always try login first to get token
    let authRes = await fetchAPI('/api/auth/login', 'POST', {
      email: 'ashu_production@test.com',
      password: 'password123',
    });

    if (authRes.status === 401 || authRes.status === 404) {
      console.log('Account not found. Registering new production account...');
      await fetchAPI('/api/auth/register', 'POST', {
        name: 'Ashu',
        email: 'ashu_production@test.com',
        password: 'password123',
      });
      
      authRes = await fetchAPI('/api/auth/login', 'POST', {
        email: 'ashu_production@test.com',
        password: 'password123',
      });
    }

    if (authRes.status !== 200) {
      console.error('Failed to auth:', JSON.stringify(authRes.data, null, 2));
      return;
    }

    // Use snake_case as defined in auth.service.ts
    const token = authRes.data.data.access_token;
    if (!token) {
      console.error('Token is missing in response!');
      return;
    }
    
    console.log('✅ Successfully authenticated!');

    console.log(`2. Linking Telegram ID (${CHAT_ID}) to profile...`);
    const profileRes = await fetchAPI('/api/user/profile', 'PUT', {
      telegramChatId: CHAT_ID,
    }, token);

    if (profileRes.status === 200) {
      console.log('✅ Telegram ID linked successfully to Render Database!');
    } else {
      console.error('Failed to link:', JSON.stringify(profileRes.data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
