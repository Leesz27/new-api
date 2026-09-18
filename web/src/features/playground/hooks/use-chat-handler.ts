/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sendChatCompletion } from '../api'
import { ERROR_MESSAGES } from '../constants'
import {
  applyChatCompletionResponse,
  applyStreamingChunk,
  buildChatCompletionPayload,
  completeAssistantMessage,
  hasChatCompletionChoice,
  isAssistantMessageFinal,
  isAssistantMessagePending,
  parseRequestErrorDetails,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
} from '../lib'
import type { Message, ParameterEnabled, PlaygroundConfig } from '../types'
import { useStreamRequest } from './use-stream-request'

type UseChatHandlerOptions = {
  onSessionMessageUpdate: (
    sessionId: string,
    updater: (prev: Message[]) => Message[]
  ) => void
}

type PendingStreamChunks = {
  content: string
  generation: number
  reasoning: string
}

const KNOWN_ERROR_MESSAGES = new Set<string>(Object.values(ERROR_MESSAGES))
const STREAM_UPDATE_FLUSH_MS = 50

function mergePendingStreamChunk(
  currentChunk: string,
  nextChunk: string
): string {
  if (!currentChunk || !nextChunk.startsWith(currentChunk)) {
    return currentChunk + nextChunk
  }

  return nextChunk
}

export function useChatHandler({
  onSessionMessageUpdate,
}: UseChatHandlerOptions) {
  const { t } = useTranslation()
  const { sendStreamRequest, stopStream, isStreaming } = useStreamRequest()
  const [requestingSessions, setRequestingSessions] = useState<Set<string>>(
    () => new Set()
  )
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const requestGenerationsRef = useRef(new Map<string, number>())
  const pendingStreamChunksRef = useRef(new Map<string, PendingStreamChunks>())
  const streamFlushTimersRef = useRef(new Map<string, number>())

  const isCurrentGeneration = useCallback(
    (sessionId: string, generation: number): boolean =>
      requestGenerationsRef.current.get(sessionId) === generation,
    []
  )

  const setRequesting = useCallback(
    (sessionId: string, requesting: boolean) => {
      setRequestingSessions((current) => {
        const next = new Set(current)
        if (requesting) next.add(sessionId)
        else next.delete(sessionId)
        return next
      })
    },
    []
  )

  const discardPendingStreamUpdates = useCallback(
    (sessionId: string, generation: number) => {
      const timer = streamFlushTimersRef.current.get(sessionId)
      if (timer !== undefined) {
        window.clearTimeout(timer)
        streamFlushTimersRef.current.delete(sessionId)
      }
      pendingStreamChunksRef.current.set(sessionId, {
        generation,
        content: '',
        reasoning: '',
      })
    },
    []
  )

  const flushStreamUpdates = useCallback(
    (sessionId: string, generation: number) => {
      if (!isCurrentGeneration(sessionId, generation)) return
      const timer = streamFlushTimersRef.current.get(sessionId)
      if (timer !== undefined) {
        window.clearTimeout(timer)
        streamFlushTimersRef.current.delete(sessionId)
      }

      const pendingChunks = pendingStreamChunksRef.current.get(sessionId)
      if (
        !pendingChunks ||
        pendingChunks.generation !== generation ||
        (!pendingChunks.reasoning && !pendingChunks.content)
      ) {
        return
      }

      pendingStreamChunksRef.current.set(sessionId, {
        generation,
        content: '',
        reasoning: '',
      })
      onSessionMessageUpdate(sessionId, (previousMessages) => {
        if (!isCurrentGeneration(sessionId, generation)) return previousMessages
        return updateLastAssistantMessage(previousMessages, (message) => {
          let updatedMessage = message
          if (pendingChunks.reasoning) {
            updatedMessage = applyStreamingChunk(
              updatedMessage,
              'reasoning',
              pendingChunks.reasoning
            )
          }
          if (pendingChunks.content) {
            updatedMessage = applyStreamingChunk(
              updatedMessage,
              'content',
              pendingChunks.content
            )
          }
          return updatedMessage
        })
      })
    },
    [isCurrentGeneration, onSessionMessageUpdate]
  )

  const scheduleStreamFlush = useCallback(
    (sessionId: string, generation: number) => {
      if (
        !isCurrentGeneration(sessionId, generation) ||
        streamFlushTimersRef.current.has(sessionId)
      ) {
        return
      }
      const timer = window.setTimeout(() => {
        flushStreamUpdates(sessionId, generation)
      }, STREAM_UPDATE_FLUSH_MS)
      streamFlushTimersRef.current.set(sessionId, timer)
    },
    [flushStreamUpdates, isCurrentGeneration]
  )

  const getDisplayError = useCallback(
    (error: string) => {
      if (KNOWN_ERROR_MESSAGES.has(error)) return t(error)

      const connectionClosedSuffix = `: ${ERROR_MESSAGES.CONNECTION_CLOSED}`
      if (error.endsWith(connectionClosedSuffix)) {
        return `${error.slice(0, -ERROR_MESSAGES.CONNECTION_CLOSED.length)}${t(
          ERROR_MESSAGES.CONNECTION_CLOSED
        )}`
      }
      return error
    },
    [t]
  )

  const startGeneration = useCallback(
    (sessionId: string): number => {
      const generation = (requestGenerationsRef.current.get(sessionId) ?? 0) + 1
      requestGenerationsRef.current.set(sessionId, generation)
      abortControllersRef.current.get(sessionId)?.abort()
      abortControllersRef.current.delete(sessionId)
      discardPendingStreamUpdates(sessionId, generation)
      setRequesting(sessionId, true)
      return generation
    },
    [discardPendingStreamUpdates, setRequesting]
  )

  const handleStreamError = useCallback(
    (
      sessionId: string,
      generation: number,
      error: string,
      errorCode?: string
    ) => {
      if (!isCurrentGeneration(sessionId, generation)) return
      flushStreamUpdates(sessionId, generation)
      setRequesting(sessionId, false)
      const displayError = getDisplayError(error)
      toast.error(displayError)
      onSessionMessageUpdate(sessionId, (previousMessages) => {
        if (!isCurrentGeneration(sessionId, generation)) return previousMessages
        return updateAssistantMessageWithError(
          previousMessages,
          displayError,
          errorCode,
          t(ERROR_MESSAGES.API_REQUEST_ERROR)
        )
      })
    },
    [
      flushStreamUpdates,
      getDisplayError,
      isCurrentGeneration,
      onSessionMessageUpdate,
      setRequesting,
      t,
    ]
  )

  const sendChat = useCallback(
    (
      sessionId: string,
      messages: Message[],
      config: PlaygroundConfig,
      parameterEnabled: ParameterEnabled
    ) => {
      const generation = startGeneration(sessionId)
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled
      )

      if (config.stream) {
        void sendStreamRequest(
          sessionId,
          payload,
          (type, chunk) => {
            if (!isCurrentGeneration(sessionId, generation)) return
            const current = pendingStreamChunksRef.current.get(sessionId)
            if (!current || current.generation !== generation) return
            current[type] = mergePendingStreamChunk(current[type], chunk)
            scheduleStreamFlush(sessionId, generation)
          },
          () => {
            if (!isCurrentGeneration(sessionId, generation)) return
            flushStreamUpdates(sessionId, generation)
            setRequesting(sessionId, false)
            onSessionMessageUpdate(sessionId, (previousMessages) =>
              !isCurrentGeneration(sessionId, generation)
                ? previousMessages
                : updateLastAssistantMessage(previousMessages, (message) =>
                    isAssistantMessageFinal(message)
                      ? message
                      : completeAssistantMessage(message)
                  )
            )
          },
          (error, errorCode) =>
            handleStreamError(sessionId, generation, error, errorCode)
        )
        return
      }

      const abortController = new AbortController()
      abortControllersRef.current.set(sessionId, abortController)
      stopStream(sessionId)
      void sendChatCompletion(payload, abortController.signal)
        .then((response) => {
          if (
            abortController.signal.aborted ||
            !isCurrentGeneration(sessionId, generation)
          ) {
            return
          }
          if (!hasChatCompletionChoice(response)) {
            handleStreamError(
              sessionId,
              generation,
              ERROR_MESSAGES.API_REQUEST_ERROR
            )
            return
          }
          onSessionMessageUpdate(sessionId, (previousMessages) => {
            if (!isCurrentGeneration(sessionId, generation)) {
              return previousMessages
            }
            return updateLastAssistantMessage(
              previousMessages,
              (message) =>
                applyChatCompletionResponse(message, response) ?? message
            )
          })
        })
        .catch((error: unknown) => {
          if (
            abortController.signal.aborted ||
            !isCurrentGeneration(sessionId, generation)
          ) {
            return
          }
          const { errorCode, errorMessage } = parseRequestErrorDetails(error)
          handleStreamError(sessionId, generation, errorMessage, errorCode)
        })
        .finally(() => {
          if (!isCurrentGeneration(sessionId, generation)) return
          abortControllersRef.current.delete(sessionId)
          setRequesting(sessionId, false)
        })
    },
    [
      flushStreamUpdates,
      handleStreamError,
      isCurrentGeneration,
      onSessionMessageUpdate,
      scheduleStreamFlush,
      sendStreamRequest,
      setRequesting,
      startGeneration,
      stopStream,
    ]
  )

  const stopGeneration = useCallback(
    (sessionId: string) => {
      const generation = requestGenerationsRef.current.get(sessionId) ?? 0
      flushStreamUpdates(sessionId, generation)
      const idleGeneration = generation + 1
      requestGenerationsRef.current.set(sessionId, idleGeneration)
      discardPendingStreamUpdates(sessionId, idleGeneration)
      stopStream(sessionId)
      abortControllersRef.current.get(sessionId)?.abort()
      abortControllersRef.current.delete(sessionId)
      setRequesting(sessionId, false)
      onSessionMessageUpdate(sessionId, (previousMessages) =>
        updateLastAssistantMessage(previousMessages, (message) =>
          isAssistantMessagePending(message)
            ? completeAssistantMessage(message)
            : message
        )
      )
    },
    [
      discardPendingStreamUpdates,
      flushStreamUpdates,
      onSessionMessageUpdate,
      setRequesting,
      stopStream,
    ]
  )

  useEffect(
    () => () => {
      for (const timer of streamFlushTimersRef.current.values()) {
        window.clearTimeout(timer)
      }
      for (const controller of abortControllersRef.current.values()) {
        controller.abort()
      }
    },
    []
  )

  return {
    isGenerating: (sessionId: string) =>
      isStreaming(sessionId) || requestingSessions.has(sessionId),
    sendChat,
    stopGeneration,
  }
}
