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
import {
  DEFAULT_SESSION_TITLE,
  MESSAGE_ROLES,
  SESSION_TITLE_MAX_LENGTH,
} from '../../constants'
import type { Message } from '../../types'
import { getMessageContent } from './message-utils'

export function shouldAutoTitleSession(title: string): boolean {
  const trimmed = title.trim()
  return trimmed.length === 0 || trimmed === DEFAULT_SESSION_TITLE
}

export function deriveSessionTitleFromPrompt(
  text: string,
  maxLength: number = SESSION_TITLE_MAX_LENGTH
): string {
  const normalized = text.trim().replaceAll(/\s+/g, ' ')
  if (!normalized) {
    return DEFAULT_SESSION_TITLE
  }

  const characters = [...normalized]
  if (characters.length <= maxLength) {
    return normalized
  }

  return `${characters.slice(0, maxLength).join('')}…`
}

export function resolveSessionTitle(
  currentTitle: string,
  messages: Message[]
): string {
  if (!shouldAutoTitleSession(currentTitle)) {
    return currentTitle
  }

  const firstUserMessage = messages.find(
    (message) => message.from === MESSAGE_ROLES.USER
  )
  if (!firstUserMessage) {
    return currentTitle || DEFAULT_SESSION_TITLE
  }

  return deriveSessionTitleFromPrompt(getMessageContent(firstUserMessage))
}
