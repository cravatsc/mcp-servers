import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { authenticate } from '@google-cloud/local-auth'
import { google, Auth } from 'googleapis'
import * as path from 'path'
import * as fs from 'fs/promises'
import { OAuth2Client } from 'google-auth-library'

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly']
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json')
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content.toString())
    return google.auth.fromJSON(credentials) as OAuth2Client
  } catch (err) {
    return null
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client: OAuth2Client): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH)
  const keys = JSON.parse(content.toString())
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  })
  await fs.writeFile(TOKEN_PATH, payload)
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize(): Promise<OAuth2Client> {
  let client = await loadSavedCredentialsIfExist()
  if (client) {
    return client
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })
  if (client.credentials) {
    await saveCredentials(client)
  }
  return client
}

// Authenticate on startup
let auth: OAuth2Client
try {
  auth = await authorize()
  console.log('Authentication successful')
} catch (err) {
  console.error('Error during authentication:', err)
  process.exit(1)
}

// Function to list files in Google Drive
async function listFiles() {
  const drive = google.drive({ version: 'v3', auth })
  try {
    const response = await drive.files.list({
      pageSize: 100,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
    })
    return response.data.files || []
  } catch (err) {
    console.error('Error listing files:', err)
    throw err
  }
}

// Create an MCP server
const server = new McpServer({
  name: 'GoogleDrive',
  version: '1.0.0',
})

// Add resource for listing files
server.resource(
  'Google Drive Files', // Name
  'gdrive://files', // URI
  {
    description: 'List of all files in Google Drive',
  },
  async () => {
    // Handler
    const files = await listFiles()
    return {
      contents: [
        {
          uri: 'gdrive://files',
          mimeType: 'application/json',
          text: JSON.stringify(files, null, 2),
        },
      ],
    }
  }
)

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport()
await server.connect(transport)
