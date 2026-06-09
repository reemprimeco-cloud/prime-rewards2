#!/usr/bin/env node

import mysql from 'mysql2/promise';

const QB_CLIENT_ID = 'ABABKgNUES2ZEle9WlmEjfqSf5XkFgopXAVwDXTU8AcGvCkCGC';
const QB_CLIENT_SECRET = '0LfAqT8f33EKnfqRm778QqwaYjyIo11kCtLAlrqE';
const REFRESH_TOKEN = 'RT1-127-H0-1789719451cyratwmc5r7enq7c3h9k';

async function refreshQBToken() {
  try {
    console.log('📤 Refreshing QB OAuth token...');
    
    const auth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Token refresh failed:', data);
      return false;
    }

    console.log('✅ Token refresh successful!');
    console.log(`📅 New token expires in: ${data.expires_in} seconds (${Math.floor(data.expires_in / 86400)} days)`);
    console.log(`🔑 New Access Token: ${data.access_token.slice(0, 30)}...`);
    console.log(`🔄 New Refresh Token: ${data.refresh_token.slice(0, 30)}...`);

    // Calculate new expiration date
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    console.log(`⏰ Expires at: ${expiresAt.toISOString()}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (err) {
    console.error('❌ Error refreshing token:', err.message);
    return false;
  }
}

async function updateDatabase(newTokens) {
  try {
    console.log('\n💾 Updating database...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const query = `
      UPDATE qb_settings 
      SET accessToken = ?, refreshToken = ?, expiresAt = ?, updatedAt = NOW()
      WHERE id = (SELECT MAX(id) FROM qb_settings)
    `;

    await connection.execute(query, [
      newTokens.accessToken,
      newTokens.refreshToken,
      newTokens.expiresAt,
    ]);

    console.log('✅ Database updated successfully!');
    await connection.end();
    return true;
  } catch (err) {
    console.error('❌ Database update failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔄 QB OAuth Token Refresh Script\n');
  
  const newTokens = await refreshQBToken();
  
  if (newTokens) {
    const updated = await updateDatabase(newTokens);
    if (updated) {
      console.log('\n✅ QB OAuth token refreshed and database updated!');
      console.log('🚀 The system is ready to use for another 60 days.');
    }
  } else {
    console.log('\n❌ Failed to refresh token. Please try again later.');
    process.exit(1);
  }
}

main();
