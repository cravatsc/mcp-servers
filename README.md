# MCP Servers

This is a monorepo containing various Model Context Protocol (MCP) server implementations.

## Packages

- `@mcp-servers/add-demo`: A demo MCP server that implements a simple addition tool

## Development

This project uses pnpm workspaces and Turborepo for fast, efficient builds. To get started:

1. Install pnpm (if you haven't already):

```bash
npm install -g pnpm
```

2. Install dependencies:

```bash
pnpm install
```

3. Build all packages:

```bash
pnpm build
```

4. Run development mode:

```bash
pnpm dev
```

5. Run linting:

```bash
pnpm lint
```

6. Format code:

```bash
pnpm format
```

## Project Structure

```
mcp-servers/
├── packages/
│   └── add-demo/        # Demo MCP server with add tool
├── package.json         # Root package.json with workspace config
├── pnpm-workspace.yaml  # PNPM workspace configuration
├── turbo.json          # Turborepo configuration
└── tsconfig.json       # Base TypeScript configuration
```

## Features

- 🚀 Fast builds with Turborepo
- 📦 Efficient dependency management with pnpm
- 🔍 TypeScript support
- 🧹 Code formatting with Prettier
- 🔍 Linting with ESLint
