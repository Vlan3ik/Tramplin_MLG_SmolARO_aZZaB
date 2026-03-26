import { MessageCircle, Send, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchChatDetail, fetchChatMessages, fetchEmployerChatDetail, fetchEmployerChats, fetchMyChats, markChatRead, sendChatMediaMessage, sendChatMessage } from '../../api/chats'
import { fetchEmployerApplications } from '../../api/employer'
import { useAuth } from '../../hooks/useAuth'
import { PlatformRole } from '../../types/auth'
import type { ChatListItem, ChatMessage } from '../../types/chat'
import { useNavigate } from 'react-router-dom'
import { buildOpportunityDetailsPath } from '../../utils/opportunity-routing'

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

function formatFileSize(sizeBytes: number | null | undefined) {
  if (!sizeBytes || sizeBytes <= 0) {
    return ''
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function truncate(value: string | null | undefined, limit = 70) {
  const normalized = (value ?? '').trim()
  if (!normalized) {
    return 'Без сообщений'
  }

  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function getMessagePreview(message: ChatMessage | null | undefined) {
  if (!message) {
    return 'Без сообщений'
  }

  const text = message.text?.trim()
  if (text) {
    return truncate(text)
  }

  if (!message.attachments.length) {
    return 'Без сообщений'
  }

  const first = message.attachments[0]
  if (first.type === 1) {
    return 'Изображение'
  }
  if (first.type === 2) {
    return 'Видео'
  }
  if (first.type === 4) {
    return first.vacancy?.title?.trim() || 'Карточка вакансии'
  }
  if (first.type === 5) {
    return first.opportunity?.title?.trim() || 'Карточка мероприятия'
  }
  return first.fileName?.trim() || 'Файл'
}

function getFallbackDirectChatTitle(chat: ChatListItem, currentUserId: number | undefined) {
  const companionId = chat.participantIds.find((id) => id !== currentUserId)
  return companionId ? `Пользователь #${companionId}` : `Личный чат #${chat.id}`
}

function getChatSubjectTitle(chat: ChatListItem, currentUserId: number | undefined) {
  const titleFromApi = chat.title?.trim()
  if (titleFromApi) {
    return titleFromApi
  }

  if (chat.type === 2 || chat.type === 3) {
    return `Объявление #${chat.id}`
  }

  return getFallbackDirectChatTitle(chat, currentUserId)
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
  const isEmployerSession = session?.platformRole === PlatformRole.Employer
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messagesByChat, setMessagesByChat] = useState<Record<number, ChatMessage[]>>({})
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [pendingOpenChatId, setPendingOpenChatId] = useState<number | null>(null)
  const [chatVacancyById, setChatVacancyById] = useState<Record<number, { vacancyId: number; vacancyTitle: string }>>({})
  const [chatLinkedCardById, setChatLinkedCardById] = useState<Record<number, any>>({})

  const chatsInFlightRef = useRef(false)
  const historyInFlightByChatRef = useRef<Record<number, boolean>>({})
  const newMessagesInFlightByChatRef = useRef<Record<number, boolean>>({})
  const latestMessageIdByChatRef = useRef<Record<number, number>>({})
  const lastReadMessageIdByChatRef = useRef<Record<number, number>>({})

  const activeChatIdRef = useRef<number | null>(activeChatId)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? null, [activeChatId, chats])
  const activeMessages = useMemo(() => (activeChatId ? messagesByChat[activeChatId] ?? [] : []), [activeChatId, messagesByChat])
  const activeVacancyLink = useMemo(() => {
    if (!activeChat || activeChat.type !== 2) {
      return null
    }

    const mappedVacancy = chatVacancyById[activeChat.id]
    if (mappedVacancy?.vacancyId) {
      const mappedTitle = mappedVacancy.vacancyTitle?.trim()
      return {
        vacancyId: mappedVacancy.vacancyId,
        title: mappedTitle || 'Вакансия',
      }
    }

    return null
  }, [activeChat, chatVacancyById])
  const activeLinkedCard = useMemo(() => {
    if (!activeChatId) {
      return null
    }
    return chatLinkedCardById[activeChatId] ?? null
  }, [activeChatId, chatLinkedCardById])
  const activeOpportunityLink = useMemo(() => {
    const opportunity = activeLinkedCard?.opportunity
    if (!opportunity?.opportunityId) {
      return null
    }

    return {
      opportunityId: opportunity.opportunityId,
      title: opportunity.title ?? 'Мероприятие',
    }
  }, [activeLinkedCard])
  const activeApplicationVacancyLink = useMemo(() => {
    const vacancy = activeLinkedCard?.applicationEmployer?.vacancy ?? activeLinkedCard?.applicationSeeker?.vacancy
    if (!vacancy?.vacancyId) {
      return null
    }

    return {
      vacancyId: vacancy.vacancyId,
      title: vacancy.title ?? 'Вакансия',
    }
  }, [activeLinkedCard])
  const activeTopVacancyLink = activeVacancyLink ?? activeApplicationVacancyLink
  const activeChatHeaderTitle = useMemo(() => {
    if (!activeChat) {
      return ''
    }

    if (activeTopVacancyLink?.title) {
      return activeTopVacancyLink.title
    }

    return getChatSubjectTitle(activeChat, currentUserId)
  }, [activeChat, activeTopVacancyLink, currentUserId])
  const activeDirectUsername = useMemo(() => {
    if (!activeChat || activeChat.type !== 1) {
      return null
    }

    for (let index = activeMessages.length - 1; index >= 0; index -= 1) {
      const message = activeMessages[index]
      if (message.senderUserId !== currentUserId && message.senderUsername?.trim()) {
        return message.senderUsername.trim()
      }
    }

    return null
  }, [activeChat, activeMessages, currentUserId])

  useEffect(() => {
    if (!isOpen || !activeChatId) {
      return
    }

    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [activeChatId, activeMessages.length, isOpen])

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
        const response = isEmployerSession
          ? await fetchEmployerChats(options?.signal)
          : await fetchMyChats(options?.signal)

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
    [isAuthenticated, isEmployerSession, isOpen],
  )

  const loadChatHistory = useCallback(
    async (chatId: number, signal?: AbortSignal) => {
      if (historyInFlightByChatRef.current[chatId]) {
        return
      }

      historyInFlightByChatRef.current[chatId] = true
      setIsLoadingMessages(true)

      try {
        const detail = isEmployerSession
          ? await fetchEmployerChatDetail(chatId, undefined, 50, signal)
          : await fetchChatDetail(chatId, undefined, 50, signal)
        const history = detail.history
        const response = history.messages

        const latest = response[response.length - 1]
        latestMessageIdByChatRef.current[chatId] = latest?.id ?? 0

        setMessagesByChat((currentState) => ({
          ...currentState,
          [chatId]: response,
        }))
        setChatLinkedCardById((current) => ({
          ...current,
          [chatId]: detail.linkedCard ?? null,
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
    [isEmployerSession, tryMarkRead],
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
        const cursor = latestMessageIdByChatRef.current[chatId] ?? 0
        const incoming = isEmployerSession
          ? (await fetchEmployerChatDetail(chatId, undefined, 50, signal)).history.messages.filter((message) => message.id > cursor)
          : await fetchChatMessages(chatId, cursor || undefined, signal)

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
    [isEmployerSession, tryMarkRead],
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

    const onChatOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ chatId?: number }>
      const chatId = customEvent.detail?.chatId
      if (typeof chatId === 'number' && Number.isFinite(chatId)) {
        setPendingOpenChatId(chatId)
      }
      setIsOpen(true)
      void loadChats({ force: true })
    }

    window.addEventListener('tramplin:chat-refresh', onChatRefresh as EventListener)
    window.addEventListener('tramplin:chat-open', onChatOpen as EventListener)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('tramplin:chat-refresh', onChatRefresh as EventListener)
      window.removeEventListener('tramplin:chat-open', onChatOpen as EventListener)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [isAuthenticated, isOpen, loadChats])

  useEffect(() => {
    if (!pendingOpenChatId) {
      return
    }

    if (!isOpen) {
      setIsOpen(true)
      return
    }

    const targetExists = chats.some((chat) => chat.id === pendingOpenChatId)
    if (!targetExists) {
      return
    }

    setActiveChatId(pendingOpenChatId)
    setPendingOpenChatId(null)
  }, [chats, isOpen, pendingOpenChatId])

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

  useEffect(() => {
    if (!isAuthenticated || !isEmployerSession || !isOpen) {
      return () => undefined
    }

    const controller = new AbortController()

    async function loadEmployerApplicationsMap() {
      try {
        const rows = await fetchEmployerApplications(controller.signal)
        if (controller.signal.aborted) {
          return
        }

        const nextMap: Record<number, { vacancyId: number; vacancyTitle: string }> = {}
        for (const row of rows) {
          if (!row.chatId) {
            continue
          }

          nextMap[row.chatId] = {
            vacancyId: row.vacancyId,
            vacancyTitle: row.vacancyTitle,
          }
        }

        setChatVacancyById(nextMap)
      } catch {
        if (!controller.signal.aborted) {
          setChatVacancyById({})
        }
      }
    }

    void loadEmployerApplicationsMap()

    return () => controller.abort()
  }, [isAuthenticated, isEmployerSession, isOpen])

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

  async function handleUploadMedia(files: FileList | null) {
    if (!activeChatId || !files || files.length === 0 || isSending) {
      return
    }

    setIsSending(true)
    setErrorMessage('')

    try {
      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append('files', file)
      }
      if (messageInput.trim()) {
        formData.append('text', messageInput.trim())
      }

      const sentMessage = await sendChatMediaMessage(activeChatId, formData)
      latestMessageIdByChatRef.current[activeChatId] = Math.max(latestMessageIdByChatRef.current[activeChatId] ?? 0, sentMessage.id)

      setMessagesByChat((currentState) => {
        const currentMessages = currentState[activeChatId] ?? []
        return {
          ...currentState,
          [activeChatId]: mergeMessages(currentMessages, [sentMessage]),
        }
      })

      setMessageInput('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      void loadChats({ force: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить медиа.')
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
                  <span>{getMessagePreview(chat.lastMessage)}</span>
                </button>
              ))}
            </aside>

            <div className="chat-widget__thread">
              {activeChat ? (
                <>
                  <div className="chat-widget__thread-head">
                    <div className="chat-widget__thread-head-title">
                      <strong>{activeChatHeaderTitle}</strong>
                      {activeDirectUsername ? (
                        <button type="button" className="chat-widget__thread-link" onClick={() => navigate(`/dashboard/seeker/${encodeURIComponent(activeDirectUsername)}`)}>
                          Профиль пользователя
                        </button>
                      ) : null}
                    </div>
                    {activeOpportunityLink ? (
                      <button
                        type="button"
                        className="chat-widget__thread-vacancy"
                        onClick={() => navigate(buildOpportunityDetailsPath({ id: activeOpportunityLink.opportunityId, entityType: 'opportunity' }))}
                        title="Открыть карточку мероприятия"
                      >
                        <span>Мероприятие</span>
                        <strong>{activeOpportunityLink.title}</strong>
                      </button>
                    ) : null}
                    {activeTopVacancyLink ? (
                      <button
                        type="button"
                        className="chat-widget__thread-vacancy"
                        onClick={() => navigate(buildOpportunityDetailsPath({ id: activeTopVacancyLink.vacancyId, entityType: 'vacancy' }))}
                        title="Открыть карточку вакансии"
                      >
                        <span>Вакансия</span>
                        <strong>{activeTopVacancyLink.title}</strong>
                      </button>
                    ) : null}
                  </div>
                  <div className="chat-widget__messages" ref={messagesContainerRef}>
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
                            {message.attachments.map((attachment) => {
                              if (attachment.type === 1 && attachment.url) {
                                return (
                                  <a key={`a-${attachment.id}`} className="chat-widget__media-thumb" href={attachment.url} target="_blank" rel="noreferrer">
                                    <img src={attachment.url} alt={attachment.fileName ?? 'image'} />
                                  </a>
                                )
                              }

                              if (attachment.type === 2 && attachment.url) {
                                return <video key={`a-${attachment.id}`} className="chat-widget__media-video" src={attachment.url} controls />
                              }

                              if (attachment.type === 3 && attachment.url) {
                                return (
                                  <a key={`a-${attachment.id}`} className="chat-widget__media-file" href={attachment.url} target="_blank" rel="noreferrer">
                                    {attachment.fileName ?? 'Файл'} {formatFileSize(attachment.sizeBytes)}
                                  </a>
                                )
                              }

                              if (attachment.type === 4 && attachment.vacancy) {
                                return (
                                  <button
                                    key={`a-${attachment.id}`}
                                    type="button"
                                    className="chat-widget__thread-vacancy chat-widget__attachment-card"
                                    onClick={() => navigate(buildOpportunityDetailsPath({ id: attachment.vacancy!.vacancyId, entityType: 'vacancy' }))}
                                  >
                                    <span>Рекомендация вакансии</span>
                                    <strong>{attachment.vacancy.title}</strong>
                                  </button>
                                )
                              }

                              if (attachment.type === 5 && attachment.opportunity) {
                                return (
                                  <button
                                    key={`a-${attachment.id}`}
                                    type="button"
                                    className="chat-widget__thread-vacancy chat-widget__attachment-card"
                                    onClick={() => navigate(buildOpportunityDetailsPath({ id: attachment.opportunity!.opportunityId, entityType: 'opportunity' }))}
                                  >
                                    <span>Рекомендация мероприятия</span>
                                    <strong>{attachment.opportunity.title}</strong>
                                  </button>
                                )
                              }

                              return null
                            })}
                            <small>{formatChatTime(message.createdAt)}</small>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <div className="chat-widget__composer">
                    <input ref={fileInputRef} type="file" multiple className="chat-widget__file-input" onChange={(event) => void handleUploadMedia(event.target.files)} />
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


