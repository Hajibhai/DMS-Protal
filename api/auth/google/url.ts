import { google } from "googleapis";

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export const getOAuth2Client = (req?: any) => {
  let redirectUri = '';
  if (process.env.APP_URL) {
    redirectUri = `${process.env.APP_URL}/auth/callback`;
  } else if (req) {
    // Vercel serverless functions request has req.headers.host
    const host = req.headers.host || req.get?.('host') || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    redirectUri = `${protocol}://${host}/auth/callback`;
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = getOAuth2Client(req);
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    return res.status(200).json({ url: authUrl });
  } catch (error: any) {
    console.error("Error generating OAuth URL:", error);
    return res.status(500).json({ error: error.message || "Failed to generate Auth URL" });
  }
}
