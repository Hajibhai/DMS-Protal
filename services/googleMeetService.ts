import { getGoogleAccessToken } from '../firebase';

export interface MeetSpaceResult {
  meetingUri: string;
  spaceId: string;
}

/**
 * Creates a standard Google Meet Space using the Google Meet API v2.
 * Throws AUTH_REQUIRED if no token is cached, or AUTH_EXPIRED if the token is rejected with 401.
 */
export async function createGoogleMeetSpace(customToken?: string): Promise<MeetSpaceResult> {
  const token = customToken || getGoogleAccessToken();
  
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const response = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Google Meet space creation error:', errorBody);
    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Google Meet API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.meetingUri) {
    throw new Error('Could not retrieve meetingUri from Google Meet API response');
  }

  return {
    meetingUri: data.meetingUri,
    spaceId: data.name ? data.name.replace('spaces/', '') : ''
  };
}
