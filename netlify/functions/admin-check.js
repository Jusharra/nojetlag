const crypto = require('crypto');

function sign(payload) {
  const secret = process.env.ADMIN_PASSWORD || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

exports.handler = async (event) => {
  const cookies = parseCookies(event.headers.cookie);
  const token = cookies.admin_session;

  if (!token) {
    return { statusCode: 200, body: JSON.stringify({ authenticated: false }) };
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [expiresStr, signature] = decoded.split('.');
    const expected = sign(expiresStr);
    const validSignature =
      signature &&
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    const notExpired = Number(expiresStr) > Date.now();

    return {
      statusCode: 200,
      body: JSON.stringify({ authenticated: Boolean(validSignature && notExpired) }),
    };
  } catch {
    return { statusCode: 200, body: JSON.stringify({ authenticated: false }) };
  }
};
