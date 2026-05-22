import { google } from "googleapis";
import { getOAuth2Client } from "../auth/google/url";

function getTokensFromCookie(req: any) {
  if (req.cookies?.google_tokens) {
    return req.cookies.google_tokens;
  }
  // Fallback manual cookie parser
  const cookieHeader = req.headers?.cookie || "";
  const match = cookieHeader.match(/(^|;\s*)google_tokens=([^;]*)/);
  if (match) {
    return decodeURIComponent(match[2]);
  }
  return null;
}

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

  const tokenStr = getTokensFromCookie(req);
  if (!tokenStr) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(JSON.parse(tokenStr));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.list({
      pageSize: 20,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink)',
      q: "trashed = false"
    });
    return res.status(200).json(response.data.files || []);
  } catch (error: any) {
    console.error("Error fetching drive files:", error);
    return res.status(500).json({ error: "Failed to fetch files" });
  }
}
