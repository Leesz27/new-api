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
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_CONFIG,
  DEFAULT_PARAMETER_ENABLED,
  MESSAGE_ROLES,
  MESSAGE_STATUS,
  STORAGE_KEYS,
} from '../../../constants'
import type { PlaygroundWorkspace } from '../../../types'
import {
  clearMemoryWorkspace,
  loadWorkspace,
  saveWorkspace,
} from '../storage'

function createWorkspace(): PlaygroundWorkspace {
  return {
    activeSessionId: 'session-1',
    sessions: [
      {
        id: 'session-1',
        title: 'Cats',
        createdAt: 1,
        updatedAt: 2,
        config: { ...DEFAULT_CONFIG, model: 'gpt-image-2' },
        parameterEnabled: { ...DEFAULT_PARAMETER_ENABLED },
        messages: [
          {
            key: 'user-1',
            from: MESSAGE_ROLES.USER,
            versions: [{ id: 'v1', content: '小猫喝水' }],
            createdAt: 1,
          },
          {
            key: 'assistant-1',
            from: MESSAGE_ROLES.ASSISTANT,
            model: 'gpt-image-2',
            versions: [
              {
                id: 'v2',
                content: '',
                image: {
                  model: 'gpt-image-2',
                  imageUrl: `data:image/png;base64,${'A'.repeat(40_000)}`,
                  prompt: '小猫喝水',
                  mode: 'generation',
                },
              },
            ],
            createdAt: 2,
            status: MESSAGE_STATUS.COMPLETE,
          },
        ],
      },
    ],
  }
}

describe('playground workspace persistence', () => {
  afterEach(() => {
    clearMemoryWorkspace()
    localStorage.removeItem(STORAGE_KEYS.WORKSPACE)
  })

  it('keeps the in-memory workspace across remount-style reloads', () => {
    saveWorkspace(createWorkspace())
    clearMemoryWorkspace()

    // Simulate SPA remount using memory first: restore memory via save, then
    // clear only localStorage to prove memory short-circuits disk.
    const workspace = createWorkspace()
    saveWorkspace(workspace)
    localStorage.removeItem(STORAGE_KEYS.WORKSPACE)

    expect(loadWorkspace()?.sessions[0]?.title).toBe('Cats')
    expect(loadWorkspace()?.sessions[0]?.messages).toHaveLength(2)
  })

  it('does not wipe localStorage when an image payload is oversized', () => {
    saveWorkspace(createWorkspace())
    clearMemoryWorkspace()

    const loaded = loadWorkspace()
    expect(loaded?.sessions[0]?.title).toBe('Cats')
    expect(localStorage.getItem(STORAGE_KEYS.WORKSPACE)).toBeTruthy()
  })
})
