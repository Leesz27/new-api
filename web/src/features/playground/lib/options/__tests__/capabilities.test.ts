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
import { describe, expect, test } from 'vitest'

import { resolveModelCapabilities } from '../playground-option-utils'

describe('resolveModelCapabilities', () => {
  test('enables chat for OpenAI-compatible models', () => {
    expect(resolveModelCapabilities('custom-chat-model', ['openai'])).toEqual({
      chat: true,
      vision: false,
      imageGeneration: false,
      imageEdit: false,
    })
  })

  test('keeps image-generation models out of chat mode', () => {
    expect(
      resolveModelCapabilities('imagen-custom', [
        'openai',
        'image-generation',
      ])
    ).toEqual({
      chat: false,
      vision: false,
      imageGeneration: true,
      imageEdit: false,
    })
  })

  test('enables editing only for the supported image-edit model', () => {
    expect(
      resolveModelCapabilities('gpt-image-2', ['image-generation'])
    ).toEqual({
      chat: false,
      vision: false,
      imageGeneration: true,
      imageEdit: true,
    })
  })

  test('enables editing for the image-2 alias without endpoint metadata', () => {
    expect(resolveModelCapabilities('image-2', ['openai'])).toEqual({
      chat: false,
      vision: false,
      imageGeneration: true,
      imageEdit: true,
    })
  })

  test('enables vision for known multimodal chat model families', () => {
    expect(resolveModelCapabilities('gpt-5.5', ['openai'])).toEqual({
      chat: true,
      vision: true,
      imageGeneration: false,
      imageEdit: false,
    })
  })
})
