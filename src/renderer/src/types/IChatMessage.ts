import { IMsgSender } from '@renderer/types/IMsgSender'

export type IChatMessage = {
  id?: number
  room: string
  sender: IMsgSender
  content: string
  createdAt: string
  // client-only
  _tempId?: string
  _status?: 'sending' | 'sent' | 'error'
}