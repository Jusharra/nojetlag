const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(
  process.env.AIRTABLE_BASE_ID
);

async function fetchPackages() {
  const records = await base('Signature Route Packages')
    .select({ filterByFormula: '{Active} = 1' })
    .all();
  return records.map((r) => ({
    id: r.id,
    name: r.get('Package Name'),
    route: r.get('Route'),
    startingPrice: r.get('Starting Price'),
    includedItems: r.get('Included Items'),
    disclosureSnippet: r.get('Legal Disclosure Snippet'),
  }));
}

async function fetchEmptyLegs() {
  const records = await base('Empty Legs')
    .select({ filterByFormula: '{Currently Live} = 1', sort: [{ field: 'Date', direction: 'asc' }] })
    .all();
  return records.map((r) => ({
    id: r.id,
    route: r.get('Route'),
    date: r.get('Date'),
    aircraft: r.get('Aircraft'),
    retailPrice: r.get('Retail Price'),
    emptyLegPrice: r.get('Empty Leg Price'),
    discountPct: r.get('Discount %'),
  }));
}

async function fetchDisclosure() {
  const records = await base('Compliance Log')
    .select({ maxRecords: 1 })
    .all();
  if (!records.length) return null;
  const r = records[0];
  return {
    regNumber: r.get('Seller of Travel Reg Number'),
    disclosureText: r.get('Full Disclosure Text'),
    disclosureVersion: r.get('Disclosure Text Version'),
  };
}

exports.handler = async () => {
  try {
    const [packages, emptyLegs, disclosure] = await Promise.all([
      fetchPackages(),
      fetchEmptyLegs(),
      fetchDisclosure(),
    ]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ packages, emptyLegs, disclosure }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load site content' }),
    };
  }
};
