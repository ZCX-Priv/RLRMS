import type { Response } from 'express'

export interface SSEClient {
  id: string
  res: Response
}

/**
 * 最大 SSE 连接数限制
 * 超过此限制将拒绝新连接，防止资源耗尽
 */
const MAX_CLIENTS = 100

const clients: SSEClient[] = []

let clientIdCounter = 0

/**
 * 添加 SSE 客户端连接
 * @returns 客户端实例；超过最大连接数时返回 null
 */
export function addSSEClient(res: Response): SSEClient | null {
  // 超过最大连接数限制时拒绝新连接
  if (clients.length >= MAX_CLIENTS) {
    return null
  }
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
 * 使用索引遍历原数组（不复制），并对背压进行处理
 */
export function broadcastSSE(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  // 直接用索引遍历 clients 数组，避免复制开销
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    try {
      if (client.res.writableEnded) {
        // 连接已结束，移除客户端
        clients.splice(i, 1)
        i-- // 修正索引，因为移除后后续元素前移
        continue
      }
      // 背压处理：res.write 返回 false 表示底层缓冲已满
      const ok = client.res.write(payload)
      if (!ok) {
        console.warn(`SSE client ${client.id} backpressure detected, write returned false`)
        // 背压时跳过本次写入，等待 drain 事件，避免内存膨胀
        continue
      }
    } catch {
      // 写入异常，移除客户端
      clients.splice(i, 1)
      i--
    }
  }
}

/**
 * 获取当前连接的客户端数量
 */
export function getSSEClientCount(): number {
  return clients.length
}
