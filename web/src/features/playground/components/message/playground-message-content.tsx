import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
import { sanitizeImageSrc } from 'stream-markdown-parser'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Loader } from '@/components/ai-elements/loader'
import { MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { cn } from '@/lib/utils'

import { MESSAGE_STATUS } from '../../constants'
import {
  getMessageAlignmentClass,
  getMessageContentState,
  isErrorMessage,
  type MessageAlignment,
} from '../../lib'
import { getMessageContentStyles } from '../../lib/message/message-styles'
import { getImageMessage } from '../../lib/message/message-utils'
import type { Message } from '../../types'
import { MessageError } from './message-error'
import { MessageMetadata } from './message-metadata'

type PlaygroundMessageContentProps = {
  actions: ReactNode
  alignment: MessageAlignment
  errorActions?: ReactNode
  isGeneratingImage?: boolean
  isSourceVisible?: boolean
  message: Message
  versionContent: string
}

export function PlaygroundMessageContent({
  actions,
  alignment,
  errorActions,
  isGeneratingImage = false,
  isSourceVisible = false,
  message,
  versionContent,
}: PlaygroundMessageContentProps) {
  const { t } = useTranslation()
  const {
    displayContent,
    hasReasoning,
    hasSources,
    reasoningContent,
    showLoader,
    showMessageContent,
    sources,
  } = getMessageContentState(message, versionContent)
  const image = getImageMessage(message)
  const isError = isErrorMessage(message)
  const isMessageFinal =
    message.status !== MESSAGE_STATUS.LOADING &&
    message.status !== MESSAGE_STATUS.STREAMING

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        getMessageAlignmentClass(alignment)
      )}
    >
      {message.from === 'user' &&
        message.versions[0]?.attachments?.map((attachment) => {
          const src = sanitizeImageSrc(attachment.url)
          if (!src || !attachment.mediaType.startsWith('image/')) return null

          return (
            <img
              alt={attachment.name}
              className='border-border/70 mb-3 max-h-72 max-w-full rounded-lg border object-contain'
              key={`${attachment.name}-${attachment.url}`}
              loading='lazy'
              src={src}
            />
          )
        })}

      {image && (
        <div
          className={cn(
            'border-border/70 bg-muted/70 space-y-3 rounded-2xl rounded-bl-md border px-3 py-3 shadow-sm',
            'max-w-[85%] sm:max-w-[62ch] md:max-w-[68ch] lg:max-w-[72ch]'
          )}
        >
          {image.sourceUrl && (
            <img
              alt={t('Source image')}
              className='border-border/70 max-h-72 max-w-full rounded-lg border object-contain'
              src={sanitizeImageSrc(image.sourceUrl)}
            />
          )}
          <img
            alt={image.revisedPrompt || image.prompt}
            className='border-border/70 max-h-[32rem] max-w-full rounded-lg border object-contain'
            src={sanitizeImageSrc(image.imageUrl)}
          />
          {image.revisedPrompt &&
            image.revisedPrompt.trim() !== image.prompt.trim() && (
              <p className='text-muted-foreground text-sm leading-6'>
                {image.revisedPrompt}
              </p>
            )}
        </div>
      )}

      {hasSources && (
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source
                href={source.href}
                key={`${source.href}-${source.title}`}
                title={source.title}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {hasReasoning && (
        <Reasoning
          defaultOpen
          duration={message.reasoning?.duration}
          isStreaming={message.isReasoningStreaming}
        >
          <ReasoningTrigger />
          <ReasoningContent>{reasoningContent}</ReasoningContent>
        </Reasoning>
      )}

      {showLoader && (
        <div className='bg-muted/70 border-border/70 flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border px-4 py-2.5 shadow-sm'>
          <Loader />
          <Shimmer className='text-sm' duration={1}>
            {isGeneratingImage
              ? t('Generating image...')
              : t('Responding...')}
          </Shimmer>
        </div>
      )}

      {isError && (
        <>
          <MessageError message={message} className='mb-2' />
          <MessageMetadata alignment={alignment} message={message} />
          {errorActions}
        </>
      )}

      {!isError && (showMessageContent || image) && (
        <>
          {showMessageContent &&
            (isSourceVisible ? (
              <CodeBlock
                code={versionContent}
                className='my-0 w-fit max-w-[85%] sm:max-w-[62ch] md:max-w-[68ch] lg:max-w-[72ch]'
                collapsedLines={24}
                defaultCollapsed={false}
                language='markdown'
                maxExpandedLines={48}
                showLineNumbers
                showToolbar
                title={t('Raw response')}
              >
                <CodeBlockCopyButton />
              </CodeBlock>
            ) : (
              <MessageContent
                variant='flat'
                className={cn(getMessageContentStyles())}
              >
                <Response final={isMessageFinal}>{displayContent}</Response>
              </MessageContent>
            ))}
          <MessageMetadata alignment={alignment} message={message} />
          {actions}
        </>
      )}
    </div>
  )
}
