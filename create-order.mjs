import { calculateFare } from './fare.mjs';

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return json({ error: 'Card checkout is not configured yet.' }, 503);

  try {
    const fare = calculateFare(await request.json());
    const receipt = `wf-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: fare.amount,
        currency: 'INR',
        receipt,
        notes: {
          route: `${fare.origin} to ${fare.destination}`,
          mode: fare.mode,
          travellers: String(fare.travellers)
        }
      })
    });
    const order = await response.json();
    if (!response.ok) return json({ error: 'Razorpay could not create the test order. Check your gateway configuration.' }, 502);
    return json({ key_id: keyId, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    return json({ error: error.message || 'Could not create the payment order.' }, 400);
  }
};