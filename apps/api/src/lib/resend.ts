import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn('Resend not configured — email not sent:', opts.subject);
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: 'Subly <notifications@subly.fi>',
    ...opts,
  });

  if (error) {
    console.error('Failed to send email:', error);
    throw error;
  }

  return data;
}
