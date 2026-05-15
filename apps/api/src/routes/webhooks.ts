import { Hono } from 'hono';

export const webhooks = new Hono()
  .post('/subscription-created', async (c) => {
    // TODO: Process subscription created event
    const body = await c.req.json();
    console.log('Subscription created webhook:', body);
    return c.json({ received: true });
  })
  .post('/subscription-cancelled', async (c) => {
    // TODO: Process subscription cancelled event
    const body = await c.req.json();
    console.log('Subscription cancelled webhook:', body);
    return c.json({ received: true });
  })
  .post('/payment-received', async (c) => {
    // TODO: Process payment received event
    const body = await c.req.json();
    console.log('Payment received webhook:', body);
    return c.json({ received: true });
  });
