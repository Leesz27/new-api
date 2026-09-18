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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { cn } from '@/lib/utils'

import { getSubmittableInputText } from '../../lib'
import type {
  ModelOption,
  GroupOption,
  ModelCapabilities,
  ParameterEnabled,
  PlaygroundConfig,
} from '../../types'
import { PlaygroundInputControls } from './playground-input-controls'
import { PlaygroundInputTools } from './playground-input-tools'

interface PlaygroundInputProps {
  config: PlaygroundConfig
  onSubmit: (message: PromptInputMessage) => void | Promise<void>
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  isGeneratingImage?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  hasMessages?: boolean
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onClearMessages?: () => void
  onParameterEnabledChange: (
    key: keyof ParameterEnabled,
    value: boolean
  ) => void
  parameterEnabled: ParameterEnabled
  capabilities: ModelCapabilities
}

export function PlaygroundInput({
  config,
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  isGeneratingImage = false,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  hasMessages = false,
  onConfigChange,
  onClearMessages,
  onParameterEnabledChange,
  parameterEnabled,
  capabilities,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const canAttachImage =
    capabilities.vision ||
    capabilities.imageGeneration ||
    capabilities.imageEdit

  const handleSubmit = async (message: PromptInputMessage) => {
    const submittableText = getSubmittableInputText(message, disabled)

    if (!submittableText) return

    // Clear immediately so image/chat modes both feel like send-and-wait,
    // instead of keeping the draft until the request finishes.
    setText('')
    try {
      await onSubmit({ ...message, text: submittableText })
    } catch {
      // Keep the cleared input; callers already surface request errors.
    }
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput
        accept={canAttachImage ? 'image/png,image/jpeg,image/webp' : undefined}
        className='relative'
        groupClassName={cn(
          // Keep composer white even when nested submit/clear buttons are disabled.
          // Only the Send button should look inactive; InputGroup's has-disabled:*
          // styles must not wash out the whole dialog.
          'bg-white text-foreground overflow-hidden rounded-2xl border border-border shadow-sm transition-all duration-200',
          'ring-foreground/5 hover:border-border focus-within:border-primary/50 focus-within:ring-primary/15 ring-1 focus-within:shadow-md focus-within:ring-3',
          'has-disabled:bg-white has-disabled:opacity-100',
          'dark:bg-card dark:has-disabled:bg-card'
        )}
        maxFileSize={25 * 1024 * 1024}
        maxFiles={canAttachImage ? 1 : 0}
        onSubmit={handleSubmit}
      >
        <PromptInputHeader className='border-border/60 bg-white px-3 py-2 dark:bg-card'>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
        </PromptInputHeader>
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className={cn(
            'placeholder:text-muted-foreground/80 min-h-20 bg-transparent px-5 pt-4 pb-3 leading-7 md:min-h-24 md:text-base',
            'disabled:bg-transparent disabled:opacity-100'
          )}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className='border-border/60 bg-white px-3 py-2.5 dark:bg-card'>
          <PlaygroundInputControls
            disabled={disabled}
            groups={groups}
            groupValue={groupValue}
            isGenerating={isGenerating}
            isGeneratingImage={isGeneratingImage}
            isModelLoading={isModelLoading}
            models={models}
            modelValue={modelValue}
            onGroupChange={onGroupChange}
            onModelChange={onModelChange}
            onStop={onStop}
            text={text}
            tools={
              <PlaygroundInputTools
                capabilities={capabilities}
                config={config}
                disabled={disabled}
                hasMessages={hasMessages}
                onConfigChange={onConfigChange}
                onClearMessages={onClearMessages}
                onParameterEnabledChange={onParameterEnabledChange}
                parameterEnabled={parameterEnabled}
              />
            }
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
