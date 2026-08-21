const crypto = require('crypto');

const SESSION_HOURS = 12;

function sign(payload) {
  const secret = process.env.ADMIN_PASSWORD || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let password = '';
  try {
    ({ password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Admin password is not configured' }) };
  }

  const a = Buffer.from(password || '');
  const b = Buffer.from(adminPassword);
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!matches) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect password' }) };
  }

  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${expires}`;
  const signature = sign(payload);
  const token = Buffer.from(`${payload}.${signature}`).toString('base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`,
    },
    body: JSON.stringify({ success: true }),
  };
};
