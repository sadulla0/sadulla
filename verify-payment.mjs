import { createHmac, timingSafeEqual } from 'node:crypto';

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

async function razorpayRequest(url, keyId, keySecret, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      ...(options.headers || {})
    }
  });
}

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return json({ error: 'Card checkout is not configured yet.' }, 503);

  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = await request.json();
    if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId) ||
        typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
        typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      return json({ error: 'The payment response is incomplete or invalid.' }, 400);
    }

    const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return json({ error: 'Payment signature did not match.' }, 400);
    }

    const baseUrl = 'https://api.razorpay.com/v1';
    const [orderResponse, paymentResponse] = await Promise.all([
      razorpayRequest(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, keyId, keySecret),
      razorpayRequest(`${baseUrl}/payments/${encodeURIComponent(paymentId)}`, keyId, keySecret)
    ]);
    if (!orderResponse.ok || !paymentResponse.ok) return json({ error: 'Could not verify this payment with Razorpay.' }, 502);

    const [order, initialPayment] = await Promise.all([orderResponse.json(), paymentResponse.json()]);
    if (initialPayment.order_id !== order.id || initialPayment.amount !== order.amount ||
        order.currency !== 'INR' || initialPayment.currency !== 'INR') {
      return json({ error: 'Payment does not match this fare order.' }, 400);
    }

    let payment = initialPayment;
    if (payment.status === 'authorized') {
      const captureResponse = await razorpayRequest(`${baseUrl}/payments/${encodeURIComponent(paymentId)}/capture`, keyId, keySecret, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: order.amount, currency: 'INR' })
      });
      if (!captureResponse.ok) return json({ error: 'Razorpay could not capture this payment.' }, 502);
      payment = await captureResponse.json();
    }

    if (payment.status !== 'captured') return json({ error: 'Payment has not been captured.' }, 400);
    return json({ verified: true, payment_id: payment.id, status: payment.status });
  } catch (error) {
    return json({ error: error.message || 'Could not verify the payment.' }, 400);
  }
};