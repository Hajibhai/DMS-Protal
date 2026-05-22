import { getOAuth2Client } from "./google/url";

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { code } = req.query || {};
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const client = getOAuth2Client(req);
    const { tokens } = await client.getToken(code as string);

    // Set cookie using Set-Cookie header so it works on both Express and Vercel serverless functions
    const cookieValue = `google_tokens=${encodeURIComponent(JSON.stringify(tokens))}; Path=/; HttpOnly; Secure; SameSite=None`;
    res.setHeader('Set-Cookie', cookieValue);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Error exchanging code for tokens:", error);
    return res.status(500).send("Authentication failed");
  }
}
