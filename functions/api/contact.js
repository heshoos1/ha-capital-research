/**
 * Cloudflare Pages Function — Contact form handler
 * Path: /api/contact   (file lives at /functions/api/contact.js)
 *
 * Required environment variables (set in Cloudflare Pages → Settings →
 * Variables and secrets):
 *   RESEND_API_KEY   — your Resend API key (mark as Secret/encrypted)
 *   CONTACT_TO       — the Gmail address that should receive submissions
 *   CONTACT_FROM     — verified sender, e.g. "Research Site <noreply@ha-capital.org>"
 */

export async function onRequestPost({ request, env }) {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const firstName = (data.first_name || '').toString().trim();
  const lastName  = (data.last_name  || '').toString().trim();
  const email     = (data.email      || '').toString().trim();
  const topic     = (data.topic      || '').toString().trim();
  const message   = (data.message    || '').toString().trim();
  const honeypot  = (data.company    || '').toString().trim();

  // Spam honeypot: real users never fill the hidden "company" field.
  if (honeypot) {
    return json({ ok: true });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!firstName || !emailOk || !message) {
    return json({ error: 'Please provide your name, a valid email, and a message.' }, 400);
  }
  if (message.length > 5000) {
    return json({ error: 'Message is too long.' }, 400);
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO) {
    return json({ error: 'Server email is not configured.' }, 500);
  }
  const fromAddress = env.CONTACT_FROM || 'Research Site <noreply@ha-capital.org>';

  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const safe = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const subject = `Contact form: ${fullName}${topic ? ' — ' + topic : ''}`;

  const text =
    `New contact form submission\n\n` +
    `Name:  ${fullName}\n` +
    `Email: ${email}\n` +
    `Topic: ${topic || '(none selected)'}\n\n` +
    `Message:\n${message}\n`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6">
      <h2 style="margin:0 0 12px">New contact form submission</h2>
      <p style="margin:0 0 4px"><strong>Name:</strong> ${safe(fullName)}</p>
      <p style="margin:0 0 4px"><strong>Email:</strong> ${safe(email)}</p>
      <p style="margin:0 0 12px"><strong>Topic:</strong> ${safe(topic) || '(none selected)'}</p>
      <p style="margin:0 0 4px"><strong>Message:</strong></p>
      <p style="margin:0;white-space:pre-wrap;padding:12px 14px;background:#f4f4f4;border-radius:4px">${safe(message)}</p>
    </div>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [env.CONTACT_TO],
        reply_to: email,
        subject,
        text,
        html,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Resend error:', resp.status, detail);
      return json({ error: 'Email service rejected the request.' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Send failed:', err);
    return json({ error: 'Failed to send message.' }, 500);
  }
}
