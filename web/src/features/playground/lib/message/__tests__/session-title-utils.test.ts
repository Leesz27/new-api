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

import { DEFAULT_SESSION_TITLE, MESSAGE_ROLES } from '../../../constants'
import type { Message } from '../../../types'
import {
  deriveSessionTitleFromPrompt,
  resolveSessionTitle,
  shouldAutoTitleSession,
} from '../session-title-utils'

function createUserMessage(content: string): Message {
  return {
    key: 'user-1',
    from: MESSAGE_ROLES.USER,
    versions: [{ id: 'v1', content }],
  }
}

describe('session title helpers', () => {
  it('treats the default title as auto-titleable', () => {
    expect(shouldAutoTitleSession(DEFAULT_SESSION_TITLE)).toBe(true)
    expect(shouldAutoTitleSession('Already renamed')).toBe(false)
  })

  it('uses the first characters of the prompt as the title', () => {
    expect(deriveSessionTitleFromPrompt('小猫喝水')).toBe('小猫喝水')
    expect(
      deriveSessionTitleFromPrompt('这是一段比较长的中文提示词用来测试截断效果是否正确')
    ).toBe('这是一段比较长的中文提示词用来测试截断效果是否正…')
  })

  it('only auto-titles sessions that still use the default name', () => {
    const messages = [createUserMessage('画一只猫')]

    expect(resolveSessionTitle(DEFAULT_SESSION_TITLE, messages)).toBe('画一只猫')
    expect(resolveSessionTitle('My chat', messages)).toBe('My chat')
  })
})
