const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(
  process.env.AIRTABLE_BASE_ID
);

function escapeFormulaValue(value) {
  return String(value).replace(/"/g, '\\"');
}

async function findOrCreateCustomer({ name, email, phone }) {
  const safeEmail = escapeFormulaValue(email);
  const existing = await base('Customers')
    .select({ filterByFormula: `{Email} = "${safeEmail}"`, maxRecords: 1 })
    .firstPage();

  if (existing.length) return existing[0].id;

  const created = await base('Customers').create([
    {
      fields: {
        Name: name,
        Email: email,
        Phone: phone || '',
      },
    },
  ]);
  return created[0].id;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    type, // "Empty Leg" | "Signature Package" | "Custom Charter"
    route,
    dates,
    passengers,
    aircraftPreference,
    notes,
    name,
    email,
    phone,
  } = payload;

  if (!route || !name || !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Route, name, and email are required.' }),
    };
  }

  try {
    const customerId = await findOrCreateCustomer({ name, email, phone });

    const booking = await base('Bookings').create([
      {
        fields: {
          Route: route,
          Customer: [customerId],
          Type: type || 'Custom Charter',
          'Date(s)': dates || '',
          Passengers: passengers ? Number(passengers) : undefined,
          'Aircraft Preference': aircraftPreference || '',
          Status: 'New Request',
          Notes: notes || '',
        },
      },
    ]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, bookingId: booking[0].id }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Could not submit your request. Please try again or call us directly.' }),
    };
  }
};
