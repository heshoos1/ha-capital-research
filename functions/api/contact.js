export async function onRequestPost({ request, env }) {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  let data;
  try { data = await request.json(); }
  catch { return json({ error: 'Invalid request body.' }, 400); }

  const name    = (data.name    || '').toString().trim();
  const email   = (data.email   || '').toString().trim();
  const message = (data.message || '').toString().trim();
  const honeypot = (data.company || '').toString().trim();

  if (honeypot) return json({ ok: true });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !emailOk || !message)
    return json({ error: 'Please provide your name, a valid email, and a message.' }, 400);

  if (!env.RESEND_API_KEY)
    return json({ error: 'Server email is not configured.' }, 500);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Research Site <onboarding@resend.dev>',
      to: ['hishamahmed@gmail.com'],
      reply_to: email,
      subject: `Contact form: ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    }),
  });

  if (!resp.ok) return json({ error: 'Email service error.' }, 502);
  return json({ ok: true });
}
