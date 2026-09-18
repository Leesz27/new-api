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

import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'

import { sendImageEdit, sendImageGeneration } from './api'
import { PlaygroundChat } from './components/chat/playground-chat'
import { PlaygroundInput } from './components/input/playground-input'
import { PlaygroundSessionSidebar } from './components/session/playground-session-sidebar'
import { ERROR_MESSAGES } from './constants'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from './hooks'
import { parseRequestErrorDetails, getModelCapabilities } from './lib'
import {
  appendImageRequestMessages,
  completePendingImageMessage,
  removePendingAssistantMessage,
} from './lib/message/conversation-message-utils'
import type { ImageResult } from './types'

export function Playground() {
  const { t } = useTranslation()
  const [isRequestingImage, setIsRequestingImage] = useState(false)
  const imageAbortControllersRef = useRef(new Map<string, AbortController>())
  const {
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    models,
    groups,
    updateMessages,
    updateSessionMessages,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    clearMessages,
    activeSessionId,
    sessions,
    createNewSession,
    selectSession,
    renameSession,
    deleteSession,
  } = usePlaygroundState()

  const { isGenerating, sendChat, stopGeneration } = useChatHandler({
    onSessionMessageUpdate: updateSessionMessages,
  })

  const sendActiveSessionChat = useCallback(
    (nextMessages: typeof messages) =>
      sendChat(activeSessionId, nextMessages, config, parameterEnabled),
    [activeSessionId, config, parameterEnabled, sendChat]
  )

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages,
    updateMessages,
    sendChat: sendActiveSessionChat,
    model: config.model,
  })

  const modelCapabilities = getModelCapabilities(
    models.find((model) => model.value === config.model)
  )

  const isActiveSessionGenerating = isGenerating(activeSessionId)

  const handleClearMessages = () => {
    handleEditOpenChange(false)
    clearMessages()
  }

  const handleImageSubmit = useCallback(
    (message: PromptInputMessage) => {
      const prompt = message.text?.trim()
      const file = message.files?.[0]?.file

      if (!prompt) {
        return
      }
      if (message.files?.length && !file) {
        toast.error(t('Attach an image before sending'))
        return
      }

      const attachments = message.files
        ?.filter((item) => item.url)
        .map((item) => ({
          name: item.filename ?? item.file?.name ?? '',
          mediaType: item.mediaType,
          url: item.url,
        }))

      imageAbortControllersRef.current.get(activeSessionId)?.abort()
      const abortController = new AbortController()
      imageAbortControllersRef.current.set(activeSessionId, abortController)
      setIsRequestingImage(true)

      updateSessionMessages(activeSessionId, (previousMessages) =>
        appendImageRequestMessages(
          previousMessages,
          prompt,
          attachments,
          config.model
        )
      )

      void (async () => {
        try {
          const response = file
            ? await (() => {
                const formData = new FormData()
                formData.append('model', config.model)
                formData.append('group', config.group)
                formData.append('prompt', prompt)
                formData.append('n', '1')
                formData.append('image', file, file.name)
                return sendImageEdit(formData, abortController.signal)
              })()
            : await sendImageGeneration(
                {
                  model: config.model,
                  group: config.group,
                  prompt,
                  n: 1,
                },
                abortController.signal
              )
          const image = response.data[0]
          const imageUrl =
            image?.url ||
            (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : '')

          if (!imageUrl) {
            throw new Error(ERROR_MESSAGES.API_REQUEST_ERROR)
          }

          const result: ImageResult = {
            model: config.model,
            ...(file ? { sourceUrl: message.files?.[0]?.url } : {}),
            imageUrl,
            prompt,
            revisedPrompt: image.revised_prompt,
            mode: file ? 'edit' : 'generation',
          }
          updateSessionMessages(activeSessionId, (previousMessages) =>
            completePendingImageMessage(previousMessages, result)
          )
        } catch (error: unknown) {
          updateSessionMessages(activeSessionId, removePendingAssistantMessage)
          if (abortController.signal.aborted) {
            return
          }
          const { errorMessage } = parseRequestErrorDetails(error)
          toast.error(t(errorMessage))
        } finally {
          if (
            imageAbortControllersRef.current.get(activeSessionId) ===
            abortController
          ) {
            imageAbortControllersRef.current.delete(activeSessionId)
            setIsRequestingImage(false)
          }
        }
      })()
    },
    [activeSessionId, config.group, config.model, t, updateSessionMessages]
  )

  useEffect(
    () => () => {
      for (const controller of imageAbortControllersRef.current.values()) {
        controller.abort()
      }
    },
    []
  )

  const handleStop = () => {
    imageAbortControllersRef.current.get(activeSessionId)?.abort()
    stopGeneration(activeSessionId)
  }

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === activeSessionId) return

    selectSession(sessionId)
  }

  const handleInputSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!modelCapabilities.chat && modelCapabilities.imageGeneration) {
        await handleImageSubmit(message)
        return
      }

      if (message.files?.length && !modelCapabilities.vision) {
        toast.error(t('The selected model does not support image input'))
        return
      }

      if (
        (message.text || message.files?.length) &&
        modelCapabilities.chat
      ) {
        const attachments = message.files?.map((file) => ({
          name: file.filename ?? file.file?.name ?? '',
          mediaType: file.mediaType,
          url: file.url,
        }))
        handleSendMessage(message.text ?? '', attachments)
        return
      }

      if (message.text || message.files?.length) {
        toast.error(
          modelCapabilities.imageGeneration
            ? t('The selected image model requires an image prompt')
            : t('The selected model does not support chat')
        )
      }
    },
    [handleSendMessage, handleImageSubmit, modelCapabilities, t]
  )

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  return (
    <div className='flex size-full min-h-0 overflow-hidden'>
      <PlaygroundSessionSidebar
        activeSessionId={activeSessionId}
        disabled={isActiveSessionGenerating || isRequestingImage}
        onCreateSession={createNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onSelectSession={handleSelectSession}
        sessions={sessions}
      />
      <div className='relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        {/* Full-width scroll container: scrolling works even over side whitespace */}
        <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <PlaygroundChat
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            onRegenerateMessage={handleRegenerateMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onSelectPrompt={handleSendMessage}
            isGenerating={isActiveSessionGenerating || isRequestingImage}
            isGeneratingImage={isRequestingImage}
            editingKey={editingMessageKey}
            onCancelEdit={handleEditOpenChange}
            onSaveEdit={(newContent) => applyEdit(newContent, false)}
            onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
          />
        </div>

        {/* Input area: center content and constrain to the same container width */}
        <div className='mx-auto w-full max-w-4xl'>
          <PlaygroundInput
            capabilities={modelCapabilities}
            config={config}
            disabled={
              isActiveSessionGenerating ||
              isRequestingImage ||
              (!modelCapabilities.chat &&
                !modelCapabilities.imageEdit &&
                !modelCapabilities.imageGeneration)
            }
            groups={groups}
            groupValue={config.group}
            isGenerating={isActiveSessionGenerating || isRequestingImage}
            isGeneratingImage={isRequestingImage}
            isModelLoading={isLoadingModels}
            modelValue={config.model}
            models={models}
            onGroupChange={(value) => updateConfig('group', value)}
            onConfigChange={updateConfig}
            onClearMessages={handleClearMessages}
            onModelChange={(value) => updateConfig('model', value)}
            onParameterEnabledChange={updateParameterEnabled}
            onStop={handleStop}
            onSubmit={handleInputSubmit}
            parameterEnabled={parameterEnabled}
            hasMessages={messages.length > 0}
          />
        </div>
      </div>
    </div>
  )
}
