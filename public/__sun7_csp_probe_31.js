// Temporary read-only probe for PR #31 preview; delete after verification.
(async () => {
  const response = await fetch('/', { cache: 'no-store' });
  const names = [
    'content-security-policy',
    'x-content-type-options',
    'referrer-policy',
    'x-frame-options',
  ];
  const headers = Object.fromEntries(names.map((name) => [name, response.headers.get(name)]));
  const img = document.createElement('img');
  img.src = '/__sun7_probe_missing_image_31.png';
  img.setAttribute('onerror', 'window.__SUN7_CSP_PROBE_EXECUTED = true');
  document.body.appendChild(img);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const output = document.createElement('pre');
  output.id = 'sun7-csp-audit-result';
  output.textContent = JSON.stringify({
    responseStatus: response.status,
    headers,
    inlineEventHandlerExecuted: window.__SUN7_CSP_PROBE_EXECUTED === true,
  });
  document.body.appendChild(output);
})().catch((error) => {
  const output = document.createElement('pre');
  output.id = 'sun7-csp-audit-result';
  output.textContent = JSON.stringify({ error: String(error) });
  document.body.appendChild(output);
});
