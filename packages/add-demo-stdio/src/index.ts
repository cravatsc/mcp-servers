#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

//create mcp server
const server = new McpServer({
  name: 'Demo stdio',
  version: '1.0.0',
})

//add a tool
// Tools let LLMs take actions through your server. Unlike resources, tools are expected to perform computation and have side effects:
server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => {
  console.log('we are using the add tool')
  return {
    content: [
      {
        type: 'text',
        text: String(a + b),
      },
    ],
  }
})

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

const transport = new StdioServerTransport()
await server.connect(transport)
