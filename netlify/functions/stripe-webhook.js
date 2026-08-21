const Stripe = require('stripe');
const Airtable = require('airtable');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(
  process.env.AIRTABLE_BASE_ID
);

// Phase 1 flow: for each booking you send the customer a Stripe Payment Link
// (Stripe Dashboard > Payment Links, no code needed) with the Airtable
// Booking record ID set as that link's `client_reference_id` query param,
// e.g. https://buy.stripe.com/xxxx?client_reference_id=recXXXXXXXXXXXXXX
// This webhook listens for the resulting checkout.session.completed event
// and marks that booking Paid.
exports.handler = async (event) => {
  const signature = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : event.body;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const bookingId = session.client_reference_id;

    if (bookingId) {
      try {
        await base('Bookings').update([
          {
            id: bookingId,
            fields: {
              'Payment Status': 'Paid',
              Status: 'Paid',
              'Stripe Charge Reference': session.payment_intent || session.id,
            },
          },
        ]);
      } catch (err) {
        console.error('Failed to update Airtable booking:', err);
        return { statusCode: 500, body: 'Airtable update failed' };
      }
    } else {
      console.warn('checkout.session.completed with no client_reference_id — cannot match a booking.');
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
