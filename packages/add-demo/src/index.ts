import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import express, { Request, Response } from 'express'
import { z } from 'zod'
import cors from 'cors'

//create mcp server
const server = new McpServer({
  name: 'Demo',
  version: '1.0.0',
})

//add a tool
// Tools let LLMs take actions through your server. Unlike resources, tools are expected to perform computation and have side effects:
server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [
    {
      type: 'text',
      text: String(a + b),
    },
  ],
}))

//add a dynamic greeting resource
// Resources are how you expose data to LLMs. They're similar to GET endpoints in a REST API -
// they provide data but shouldn't perform significant computation or have side effects:
server.resource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  })
)

const app = express()

// Enable CORS for all routes
app.use(cors())

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: { [sessionId: string]: SSEServerTransport } = {}

// Health check endpoint
app.get('/health', (_: Request, res: Response) => {
  res.json({ status: 'ok', name: 'Demo', version: '1.0.0' })
})

app.get('/sse', async (_: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const transport = new SSEServerTransport('/messages', res)
    transports[transport.sessionId] = transport

    res.on('close', () => {
      delete transports[transport.sessionId]
    })

    await server.connect(transport)
  } catch (error) {
    console.error('Error in SSE connection:', error)
    res.status(500).end()
  }
})

app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string
  const transport = transports[sessionId]
  if (transport) {
    try {
      await transport.handlePostMessage(req, res)
    } catch (error) {
      console.error('Error handling message:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.status(400).send('No transport found for sessionId')
  }
})

const port = 3000
app.listen(port, () => {
  console.log(`MCP Server running on http://localhost:${port}`)
  console.log('Available endpoints:')
  console.log('- GET  /health  - Health check')
  console.log('- GET  /sse     - SSE connection')
  console.log('- POST /messages - Message handling')
})

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
// const transports: { [sessionId: string]: SSEServerTransport } = {}

// app.get('/sse', async (_: Request, res: Response) => {
//   const transport = new SSEServerTransport('/messages', res)
//   transports[transport.sessionId] = transport
//   res.on('close', () => {
//     delete transports[transport.sessionId]
//   })
//   await server.connect(transport)
// })

// app.post('/messages', async (req: Request, res: Response) => {
//   const sessionId = req.query.sessionId as string
//   const transport = transports[sessionId]
//   if (transport) {
//     await transport.handlePostMessage(req, res)
//   } else {
//     res.status(400).send('No transport found for sessionId')
//   }
// })

// const port = 3000
// app.listen(port, () => {
//   console.log(`MCP Server running on http://localhost:${port}`)
//   console.log('Available endpoints:')
//   console.log('- GET  /health  - Health check')
//   console.log('- GET  /sse     - SSE connection')
//   console.log('- POST /messages - Message handling')
// })
