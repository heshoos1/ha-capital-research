export async function onRequestPost({ request, env }) {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  let data;
  try { data = await request.json(); }
  catch { return json({ error: 'Invalid request body.' }, 400); }

  const firstName = (data.first_name || '').toString().trim();
  const lastName  = (data.last_name  || '').toString().trim();
  const email     = (data.email      || '').toString().trim();
  const topic     = (data.topic      || '').toString().trim();
  const message   = (data.message    || '').toString().trim();
  const honeypot  = (data.company    || '').toString().trim();

  if (honeypot) return json({ ok: true });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!firstName || !emailOk || !message)
    return json({ error: 'Please provide your name, a valid email, and a message.' }, 400);

  if (!env.RESEND_API_KEY)
    return json({ error: 'Server email is not configured.' }, 500);

  const fullName = lastName ? `${firstName} ${lastName}` : firstName;

  try {
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
        subject: `Contact form: ${fullName}`,
        text: `Name: ${fullName}\nEmail: ${email}\nTopic: ${topic || '(none selected)'}\n\nMessage:\n${message}`,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Resend error:', resp.status, detai
