import express, { Request, Response } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { randomUUID } from 'node:crypto'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import cors from 'cors'

const app = express()
app.use(express.json())
// Enable CORS for all routes
app.use(cors())

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

// Handle POST requests for client-to-server communication
app.post('/mcp', async (request: Request, response: Response) => {
  console.log('POST /mcp endpoint hit')
  // Check for existing session ID
  const sessionId = request.headers['mcp-session-id'] as string | undefined
  let transport: StreamableHTTPServerTransport

  if (sessionId && transports[sessionId]) {
    //reuse existing transport
    console.log('reusing session: ', sessionId)
    transport = transports[sessionId]
  } else if (!sessionId && isInitializeRequest(request.body)) {
    console.log('creating a new session')
    //if session doesnt exist and request is valid, create new session
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        transports[sessionId] = transport
      },
    })
    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId]
      }
    }
    const server = new McpServer({
      name: 'example-server',
      version: '1.0.0',
    })

    //TODO add server resources/tools here
    //add a tool
    // Tools let LLMs take actions through your server. Unlike resources, tools are expected to perform computation and have side effects:
    server.tool(
      'add',
      `Tool: Add Two Numbers

      Description:
      This tool performs simple addition of two numerical values. It takes two numbers as input and returns their sum. This can be useful for basic arithmetic operations within more complex workflows or calculations.

      Usage:
      - Input two numbers you want to add together.
      - The tool will return the sum of these numbers.

      Examples:
      1. Adding integers: 5 + 3 = 8
      2. Adding decimals: 2.5 + 1.7 = 4.2
      3. Adding negative numbers: -4 + 7 = 3

      Note: This tool only performs addition. For other arithmetic operations like subtraction, multiplication, or division, you would need to use or create separate tools.

      Parameters:
      - a (number): The first number to add
      - b (number): The second number to add

      Returns:
      - The sum of 'a' and 'b' as a number`,
      { a: z.number(), b: z.number() },
      async ({ a, b }) => {
        console.log('we are using the add tool')
        return {
          content: [
            {
              type: 'text',
              text: String(a + b),
            },
          ],
        }
      }
    )

    await server.connect(transport)
  } else {
    // Invalid request
    response.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    })
    return
  }

  // Handle the request
  await transport.handleRequest(request, response, request.body)
})

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (request: Request, response: Response) => {
  //check for sesison id
  const sessionId = request.headers['mcp-session-id'] as string | undefined
  console.log('handling sesison request for sessionId: ', sessionId)
  if (!sessionId || !transports[sessionId]) {
    response.status(400).send('Invalid or missing session ID')
    return
  }

  const transport = transports[sessionId]
  await transport.handleRequest(request, response)
}

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', (req, res) => {
  console.log('GET /mcp endpoint hit')
  handleSessionRequest(req, res)
})

// Handle DELETE requests for session termination
app.delete('/mcp', (req, res) => {
  console.log('DELETE /mcp endpoint hit')
  handleSessionRequest(req, res)
})

const port = 3000
const server = app.listen(port, () => {
  console.log(`MCP Streamable Server running on http://localhost:${port}`)
  console.log('Available endpoints:')
  console.log('- POST /mcp    - Client-to-server communication')
  console.log('- GET  /mcp    - Server-to-client notifications (SSE)')
  console.log('- DELETE /mcp  - Session termination')
})

// Graceful shutdown function
const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully')
  server.close(() => {
    console.log('Closed out remaining connections')
    // Clean up active transports
    Object.values(transports).forEach((transport) => {
      if (transport.close) {
        transport.close()
      }
    })
    console.log('Cleaned up transports')
    process.exit(0)
  })

  // If server hasn't finished in 10s, shut down forcefully
  setTimeout(() => {
    console.error(
      'Could not close connections in time, forcefully shutting down'
    )
    process.exit(1)
  }, 10000)
}

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
