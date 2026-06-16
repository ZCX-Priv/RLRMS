import type { Response } from 'express'

export interface SSEClient {
  id: string
  res: Response
}

const clients: SSEClient[] = []

let clientIdCounter = 0

/**
 * 添加 SSE 客户端连接
 */
export function addSSEClient(res: Response): SSEClient {
  const client: SSEClient = {
    id: `sse_${++clientIdCounter}`,
    res,
  }
  clients.push(client)
  return client
}

/**
 * 移除 SSE 客户端连接
 */
export function removeSSEClient(client: SSEClient): void {
  const index = clients.indexOf(client)
  if (index !== -1) {
    clients.splice(index, 1)
  }
}

/**
 * 向所有连接的 SSE 客户端广播事件
 */
export function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  // 遍历副本，避免在迭代中修改数组
  for (const client of [...clients]) {
    try {
      if (!client.res.writableEnded) {
        client.res.write(payload)
      } else {
        removeSSEClient(client)
      }
    } catch {
      removeSSEClient(client)
    }
  }
}

/**
 * 获取当前连接的客户端数量
 */
export function getSSEClientCount(): number {
  return clients.length
}
