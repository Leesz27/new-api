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
import { describe, expect, it } from 'vitest'

import { MESSAGE_ROLES, MESSAGE_STATUS } from '../../../constants'
import {
  appendImageGenerationMessages,
  appendImageRequestMessages,
  completePendingImageMessage,
  removePendingAssistantMessage,
} from '../conversation-message-utils'
import { getImageMessage } from '../message-utils'

describe('image generation message flow', () => {
  it('shows the user prompt immediately with a loading assistant placeholder', () => {
    const messages = appendImageRequestMessages(
      [],
      '小猫喝水',
      undefined,
      'gpt-image-2'
    )

    expect(messages).toHaveLength(2)
    expect(messages.at(0)?.from).toBe(MESSAGE_ROLES.USER)
    expect(messages.at(0)?.versions[0]?.content).toBe('小猫喝水')
    expect(messages.at(1)?.from).toBe(MESSAGE_ROLES.ASSISTANT)
    expect(messages.at(1)?.status).toBe(MESSAGE_STATUS.LOADING)
    expect(messages.at(1)?.model).toBe('gpt-image-2')
  })

  it('replaces the loading placeholder with the generated image message', () => {
    const pending = appendImageRequestMessages([], '小猫喝水', undefined, 'gpt-image-2')
    const messages = completePendingImageMessage(pending, {
      model: 'gpt-image-2',
      imageUrl: 'https://example.com/cat.png',
      prompt: '小猫喝水',
      mode: 'generation',
    })

    const assistantMessage = messages.at(1)
    expect(assistantMessage?.status).toBe(MESSAGE_STATUS.COMPLETE)
    expect(
      assistantMessage && getImageMessage(assistantMessage)?.imageUrl
    ).toBe('https://example.com/cat.png')
  })

  it('removes the loading placeholder when generation is aborted or fails', () => {
    const pending = appendImageRequestMessages([], '小猫喝水')
    const messages = removePendingAssistantMessage(pending)

    expect(messages).toHaveLength(1)
    expect(messages.at(0)?.from).toBe(MESSAGE_ROLES.USER)
  })

  it('keeps edit-mode attachments on the user message for the completed helper', () => {
    const messages = appendImageGenerationMessages(
      [],
      'make it blue',
      {
        model: 'gpt-image-2',
        imageUrl: 'https://example.com/edited.png',
        sourceUrl: 'blob:source',
        prompt: 'make it blue',
        mode: 'edit',
      },
      [
        {
          name: 'source.png',
          mediaType: 'image/png',
          url: 'blob:source',
        },
      ]
    )

    const userMessage = messages.at(0)
    const assistantMessage = messages.at(1)

    expect(userMessage?.versions[0]?.attachments).toEqual([
      {
        name: 'source.png',
        mediaType: 'image/png',
        url: 'blob:source',
      },
    ])
    expect(assistantMessage && getImageMessage(assistantMessage)?.mode).toBe(
      'edit'
    )
  })
})
