exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'Set-Cookie': 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  },
  body: JSON.stringify({ success: true }),
});
