import { MessageCircle, Send, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchChatHistory, fetchChatMessages, fetchMyChats, markChatRead, sendChatMessage } from '../../api/chats'
import { useAuth } from '../../hooks/useAuth'
import type { ChatListItem, ChatMessage } from '../../types/chat'

const CHAT_POLL_OPEN_INTERVAL_MS = 20000
const MESSAGE_POLL_INTERVAL_MS = 8000

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('aborted')
  }

  return false
}

function isPageVisible() {
  if (typeof document === 'undefined') {
    return true
  }

  return document.visibilityState === 'visible'
}

function formatChatTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatChatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  })
}

function getFallbackDirectChatTitle(chat: ChatListItem, currentUserId: number | undefined) {
  const companionId = chat.participantIds.find((id) => id !== currentUserId)
  return companionId ? `Пользователь #${companionId}` : `Личный чат #${chat.id}`
}

function mergeMessages(currentMessages: ChatMessage[], incomingMessages: ChatMessage[]) {
  if (!incomingMessages.length) {
    return currentMessages
  }

  const map = new Map<number, ChatMessage>()

  for (const message of currentMessages) {
    map.set(message.id, message)
  }

  for (const message of incomingMessages) {
    map.set(message.id, message)
  }

  return Array.from(map.values()).sort((a, b) => a.id - b.id)
}

function getUsernameLabel(username: string | null | undefined) {
  const normalized = username?.trim()
  if (!normalized) {
    return null
  }

  return normalized.startsWith('@') ? normalized : `@${normalized}`
}

function getAvatarInitials(displayName: string | null | undefined, username: string | null | undefined) {
  const normalizedDisplay = displayName?.trim()
  if (normalizedDisplay) {
    const words = normalizedDisplay.split(/\s+/).filter(Boolean)
    const first = words[0]?.[0] ?? ''
    const second = words[1]?.[0] ?? ''
    const initials = `${first}${second}`.toUpperCase()
    if (initials) {
      return initials
    }
  }

  const normalizedUsername = username?.trim()
  if (normalizedUsername) {
    return normalizedUsername[0].toUpperCase()
  }

  return '?'
}

export function ChatWidget() {
  const { session, isAuthenticated } = useAuth()
  const currentUserId = session?.user?.id

  const [isOpen, setIsOpen] = useState(false)
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messagesByChat, setMessagesByChat] = useState<Record<number, ChatMessage[]>>({})
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const chatsInFlightRef = useRef(false)
  const historyInFlightByChatRef = useRef<Record<number, boolean>>({})
  const newMessagesInFlightByChatRef = useRef<Record<number, boolean>>({})
  const latestMessageIdByChatRef = useRef<Record<number, number>>({})
  const lastReadMessageIdByChatRef = useRef<Record<number, number>>({})

  const activeChatIdRef = useRef<number | null>(activeChatId)

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? null, [activeChatId, chats])
  const activeMessages = useMemo(() => (activeChatId ? messagesByChat[activeChatId] ?? [] : []), [activeChatId, messagesByChat])

  const getChatTitle = useCallback(
    (chat: ChatListItem) => {
      const titleFromApi = chat.title?.trim()
      return titleFromApi || getFallbackDirectChatTitle(chat, currentUserId)
    },
    [currentUserId],
  )

  const tryMarkRead = useCallback(
    async (chatId: number, candidateMessage: ChatMessage | undefined) => {
      if (!candidateMessage || candidateMessage.senderUserId === currentUserId) {
        return
      }

      const alreadyReadId = lastReadMessageIdByChatRef.current[chatId] ?? 0

      if (candidateMessage.id <= alreadyReadId) {
        return
      }

      try {
        await markChatRead(chatId, candidateMessage.id)
        lastReadMessageIdByChatRef.current[chatId] = candidateMessage.id
      } catch {
        // read-state failure is non-blocking
      }
    },
    [currentUserId],
  )

  const loadChats = useCallback(
    async (options?: { signal?: AbortSignal; force?: boolean }) => {
      if (!isAuthenticated) {
        setChats([])
        setActiveChatId(null)
        return
      }

      if (!options?.force && (!isOpen || !isPageVisible())) {
        return
      }

      if (chatsInFlightRef.current) {
        return
      }

      chatsInFlightRef.current = true
      setIsLoadingChats(true)

      try {
        const response = await fetchMyChats(options?.signal)

        const sorted = [...response].sort((a, b) => {
          const aTime = new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime()
          const bTime = new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime()
          return bTime - aTime
        })

        setChats(sorted)
        setActiveChatId((currentId) => {
          if (!currentId) {
            return sorted[0]?.id ?? null
          }

          return sorted.some((chat) => chat.id === currentId) ? currentId : (sorted[0]?.id ?? null)
        })
      } catch (error) {
        if (!options?.signal?.aborted && !isAbortError(error)) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить список чатов.')
        }
      } finally {
        chatsInFlightRef.current = false
        if (!options?.signal?.aborted) {
          setIsLoadingChats(false)
        }
      }
    },
    [isAuthenticated, isOpen],
  )

  const loadChatHistory = useCallback(
    async (chatId: number, signal?: AbortSignal) => {
      if (historyInFlightByChatRef.current[chatId]) {
        return
      }

      historyInFlightByChatRef.current[chatId] = true
      setIsLoadingMessages(true)

      try {
        const history = await fetchChatHistory(chatId, undefined, 50, signal)
        const response = history.messages

        const latest = response[response.length - 1]
        latestMessageIdByChatRef.current[chatId] = latest?.id ?? 0

        setMessagesByChat((currentState) => ({
          ...currentState,
          [chatId]: response,
        }))

        await tryMarkRead(chatId, latest)
      } catch (error) {
        if (!signal?.aborted && !isAbortError(error)) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить сообщения.')
        }
      } finally {
        historyInFlightByChatRef.current[chatId] = false
        if (!signal?.aborted) {
          setIsLoadingMessages(false)
        }
      }
    },
    [tryMarkRead],
  )

  const loadNewMessages = useCallback(
    async (chatId: number, signal?: AbortSignal) => {
      if (!isPageVisible()) {
        return
      }

      if (newMessagesInFlightByChatRef.current[chatId]) {
        return
      }

      newMessagesInFlightByChatRef.current[chatId] = true

      try {
        const cursor = latestMessageIdByChatRef.current[chatId] ?? undefined
        const incoming = await fetchChatMessages(chatId, cursor, signal)

        if (!incoming.length || signal?.aborted) {
          return
        }

        const latestIncoming = incoming[incoming.length - 1]
        latestMessageIdByChatRef.current[chatId] = latestIncoming.id

        setMessagesByChat((currentState) => {
          const existing = currentState[chatId] ?? []
          return {
            ...currentState,
            [chatId]: mergeMessages(existing, incoming),
          }
        })

        await tryMarkRead(chatId, latestIncoming)
      } catch (error) {
        if (!signal?.aborted && !isAbortError(error)) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось обновить сообщения.')
        }
      } finally {
        newMessagesInFlightByChatRef.current[chatId] = false
      }
    },
    [tryMarkRead],
  )

  useEffect(() => {
    if (!isAuthenticated) {
      return () => undefined
    }

    const onChatRefresh = () => {
      void loadChats({ force: true })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOpen) {
        void loadChats({ force: true })
      }
    }

    const onFocus = () => {
      if (isOpen) {
        void loadChats({ force: true })
      }
    }

    window.addEventListener('tramplin:chat-refresh', onChatRefresh as EventListener)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('tramplin:chat-refresh', onChatRefresh as EventListener)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [isAuthenticated, isOpen, loadChats])

  useEffect(() => {
    if (!isAuthenticated || !isOpen) {
      return () => undefined
    }

    const controller = new AbortController()
    void loadChats({ signal: controller.signal, force: true })

    const intervalId = window.setInterval(() => {
      void loadChats()
    }, CHAT_POLL_OPEN_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated, isOpen, loadChats])

  useEffect(() => {
    if (!isAuthenticated || !isOpen || !activeChatId) {
      return () => undefined
    }

    const controller = new AbortController()
    void loadChatHistory(activeChatId, controller.signal)

    const intervalId = window.setInterval(() => {
      const chatId = activeChatIdRef.current

      if (chatId) {
        void loadNewMessages(chatId)
      }
    }, MESSAGE_POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [activeChatId, isAuthenticated, isOpen, loadChatHistory, loadNewMessages])

  async function handleSendMessage() {
    if (!activeChatId || !messageInput.trim() || isSending) {
      return
    }

    setIsSending(true)
    setErrorMessage('')

    try {
      const sentMessage = await sendChatMessage(activeChatId, messageInput.trim())
      latestMessageIdByChatRef.current[activeChatId] = Math.max(latestMessageIdByChatRef.current[activeChatId] ?? 0, sentMessage.id)

      setMessagesByChat((currentState) => {
        const currentMessages = currentState[activeChatId] ?? []
        return {
          ...currentState,
          [activeChatId]: mergeMessages(currentMessages, [sentMessage]),
        }
      })

      setMessageInput('')
      void loadChats({ force: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить сообщение.')
    } finally {
      setIsSending(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  const currentUserAvatarUrl = session?.user?.avatarUrl ?? null
  const currentUserUsername = session?.user?.username ?? null
  const currentUserDisplayName = session?.user?.username?.trim() || 'Вы'

  return (
    <div className="chat-widget">
      {isOpen ? (
        <section className="chat-widget__panel card" aria-label="Чаты">
          <header className="chat-widget__head">
            <strong>Чаты</strong>
            <button type="button" className="btn btn--icon" onClick={() => setIsOpen(false)} aria-label="Свернуть чат">
              <X size={16} />
            </button>
          </header>

          <div className="chat-widget__body">
            <aside className="chat-widget__list">
              {isLoadingChats ? <p>Загружаем...</p> : null}
              {!isLoadingChats && !chats.length ? <p>Чатов пока нет.</p> : null}
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-widget__list-item ${chat.id === activeChatId ? 'is-active' : ''}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <strong>{getChatTitle(chat)}</strong>
                  <span>{chat.lastMessage?.text || 'Без сообщений'}</span>
                  <small>{chat.lastMessage ? `${formatChatDate(chat.lastMessage.createdAt)} ${formatChatTime(chat.lastMessage.createdAt)}` : ''}</small>
                </button>
              ))}
            </aside>

            <div className="chat-widget__thread">
              {activeChat ? (
                <>
                  <div className="chat-widget__thread-head">
                    <strong>{getChatTitle(activeChat)}</strong>
                  </div>
                  <div className="chat-widget__messages">
                    {isLoadingMessages ? <p>Загружаем сообщения...</p> : null}
                    {!isLoadingMessages && !activeMessages.length ? <p>Сообщений пока нет.</p> : null}
                    {activeMessages.map((message) => {
                      const isMine = message.senderUserId === currentUserId
                      const displayName = (isMine ? currentUserDisplayName : message.senderDisplayName)?.trim() || 'Пользователь'
                      const username = isMine ? currentUserUsername : message.senderUsername
                      const usernameLabel = getUsernameLabel(username)
                      const avatarUrl = isMine ? currentUserAvatarUrl : message.senderAvatarUrl
                      const avatarInitials = getAvatarInitials(displayName, username)

                      return (
                        <article key={message.id} className={`chat-widget__message ${isMine ? 'is-mine' : ''} ${message.isSystem ? 'is-system' : ''}`}>
                          <div className="chat-widget__message-avatar" aria-hidden="true">
                            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{avatarInitials}</span>}
                          </div>
                          <div className="chat-widget__message-bubble">
                            <div className="chat-widget__message-meta">
                              <strong>{displayName}</strong>
                              {usernameLabel ? <span>{usernameLabel}</span> : null}
                            </div>
                            <p>{message.text}</p>
                            <small>{formatChatTime(message.createdAt)}</small>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <div className="chat-widget__composer">
                    <input
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      placeholder="Введите сообщение..."
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleSendMessage()
                        }
                      }}
                    />
                    <button type="button" className="btn btn--primary" disabled={isSending || !messageInput.trim()} onClick={() => void handleSendMessage()}>
                      <Send size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="chat-widget__empty">Выберите чат в списке.</div>
              )}
            </div>
          </div>

          {errorMessage ? <div className="auth-feedback auth-feedback--error">{errorMessage}</div> : null}
        </section>
      ) : null}

      <button type="button" className="chat-widget__fab" onClick={() => setIsOpen((currentState) => !currentState)} aria-label="Открыть чаты">
        <MessageCircle size={20} />
      </button>
    </div>
  )
}
