import { nanoid } from 'nanoid'
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

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED, DEFAULT_SESSION_TITLE } from '../constants'
import {
  applyMessageStateUpdate,
  loadLegacyPlaygroundSession,
  loadWorkspace,
  saveWorkspace,
  type MessageStateUpdater,
} from '../lib'
import { resolveSessionTitle } from '../lib/message/session-title-utils'
import type {
  GroupOption,
  Message,
  ModelOption,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundSession,
  PlaygroundWorkspace,
} from '../types'

const WORKSPACE_SAVE_DEBOUNCE_MS = 500

function createSession(
  config: PlaygroundConfig = DEFAULT_CONFIG,
  parameterEnabled: ParameterEnabled = DEFAULT_PARAMETER_ENABLED,
  messages: Message[] = []
): PlaygroundSession {
  const timestamp = Date.now()
  return {
    id: nanoid(),
    title: resolveSessionTitle(DEFAULT_SESSION_TITLE, messages),
    createdAt: timestamp,
    updatedAt: timestamp,
    config: { ...config },
    parameterEnabled: { ...parameterEnabled },
    messages,
  }
}

function getInitialWorkspace(): PlaygroundWorkspace {
  return (
    loadWorkspace() ?? {
      activeSessionId: '',
      sessions: [],
    }
  )
}

export function usePlaygroundState() {
  const [workspace, setWorkspace] =
    useState<PlaygroundWorkspace>(getInitialWorkspace)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const workspaceSaveTimerRef = useRef<number | null>(null)
  const latestWorkspaceRef = useRef(workspace)
  const hasLoadedWorkspaceRef = useRef(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  const persistWorkspace = useCallback(
    (workspaceToSave: PlaygroundWorkspace) => {
      latestWorkspaceRef.current = workspaceToSave

      if (!hasLoadedWorkspaceRef.current) {
        return
      }

      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current)
      }

      workspaceSaveTimerRef.current = window.setTimeout(() => {
        workspaceSaveTimerRef.current = null
        saveWorkspace(latestWorkspaceRef.current)
      }, WORKSPACE_SAVE_DEBOUNCE_MS)
    },
    []
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setWorkspace((currentWorkspace) => {
        if (currentWorkspace.sessions.length > 0) {
          latestWorkspaceRef.current = currentWorkspace
          return currentWorkspace
        }

        const session = loadLegacyPlaygroundSession(createSession)
        const nextWorkspace = {
          activeSessionId: session.id,
          sessions: [session],
        }
        latestWorkspaceRef.current = nextWorkspace
        return nextWorkspace
      })
      hasLoadedWorkspaceRef.current = true
      setIsLoadingMessages(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(
    () => () => {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current)
        workspaceSaveTimerRef.current = null
      }

      // Always flush on leave so SPA route switches do not drop the last edits.
      if (hasLoadedWorkspaceRef.current) {
        saveWorkspace(latestWorkspaceRef.current)
      }
    },
    []
  )

  const activeSession =
    workspace.sessions.find(
      (session) => session.id === workspace.activeSessionId
    ) ?? workspace.sessions[0]

  const updateActiveSession = useCallback(
    (updater: (session: PlaygroundSession) => PlaygroundSession) => {
      setWorkspace((previousWorkspace) => {
        const activeSessionId = previousWorkspace.activeSessionId
        const sessions = previousWorkspace.sessions.map((session) =>
          session.id === activeSessionId
            ? { ...updater(session), updatedAt: Date.now() }
            : session
        )
        const nextWorkspace = { ...previousWorkspace, sessions }
        persistWorkspace(nextWorkspace)
        return nextWorkspace
      })
    },
    [persistWorkspace]
  )

  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      updateActiveSession((session) => ({
        ...session,
        config: { ...session.config, [key]: value },
      }))
    },
    [updateActiveSession]
  )

  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      updateActiveSession((session) => ({
        ...session,
        parameterEnabled: { ...session.parameterEnabled, [key]: value },
      }))
    },
    [updateActiveSession]
  )

  const updateSessionMessages = useCallback(
    (sessionId: string, updater: MessageStateUpdater) => {
      setWorkspace((previousWorkspace) => {
        const sessions = previousWorkspace.sessions.map((session) => {
          if (session.id !== sessionId) {
            return session
          }

          const messages = applyMessageStateUpdate(session.messages, updater)
          return {
            ...session,
            messages,
            title: resolveSessionTitle(session.title, messages),
            updatedAt: Date.now(),
          }
        })
        const nextWorkspace = { ...previousWorkspace, sessions }
        persistWorkspace(nextWorkspace)
        return nextWorkspace
      })
    },
    [persistWorkspace]
  )

  const updateMessages = useCallback(
    (updater: MessageStateUpdater) => {
      updateActiveSession((session) => {
        const messages = applyMessageStateUpdate(session.messages, updater)
        return {
          ...session,
          messages,
          title: resolveSessionTitle(session.title, messages),
        }
      })
    },
    [updateActiveSession]
  )

  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  const createNewSession = useCallback(() => {
    setWorkspace((previousWorkspace) => {
      const activeSession = previousWorkspace.sessions.find(
        (session) => session.id === previousWorkspace.activeSessionId
      )
      if (activeSession && activeSession.messages.length === 0) {
        return previousWorkspace
      }

      const emptySession = [...previousWorkspace.sessions]
        .filter((session) => session.messages.length === 0)
        .sort((left, right) => right.updatedAt - left.updatedAt)[0]

      if (emptySession) {
        const now = Date.now()
        const sessions = previousWorkspace.sessions.map((session) =>
          session.id === emptySession.id
            ? { ...session, updatedAt: now }
            : session
        )
        const nextWorkspace = {
          activeSessionId: emptySession.id,
          sessions,
        }
        persistWorkspace(nextWorkspace)
        return nextWorkspace
      }

      const session = createSession()
      const nextWorkspace = {
        activeSessionId: session.id,
        sessions: [...previousWorkspace.sessions, session],
      }
      persistWorkspace(nextWorkspace)
      return nextWorkspace
    })
  }, [persistWorkspace])

  const selectSession = useCallback(
    (sessionId: string) => {
      setWorkspace((previousWorkspace) => {
        if (
          !previousWorkspace.sessions.some(
            (session) => session.id === sessionId
          )
        ) {
          return previousWorkspace
        }

        const nextWorkspace = {
          ...previousWorkspace,
          activeSessionId: sessionId,
        }
        persistWorkspace(nextWorkspace)
        return nextWorkspace
      })
    },
    [persistWorkspace]
  )

  const renameSession = useCallback(
    (sessionId: string, title: string) => {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return

      setWorkspace((previousWorkspace) => {
        const sessions = previousWorkspace.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, title: trimmedTitle, updatedAt: Date.now() }
            : session
        )
        const nextWorkspace = { ...previousWorkspace, sessions }
        persistWorkspace(nextWorkspace)
        return nextWorkspace
      })
    },
    [persistWorkspace]
  )

  const deleteSession = useCallback(
    (sessionId: string) => {
      setWorkspace((previousWorkspace) => {
        const sessions = previousWorkspace.sessions.filter(
          (session) => session.id !== sessionId
        )
        const remainingSessions =
          sessions.length > 0 ? sessions : [createSession()]
        const activeSessionId = remainingSessions.some(
          (session) => session.id === previousWorkspace.activeSessionId
        )
          ? previousWorkspace.activeSessionId
          : remainingSessions[0].id
        const nextWorkspace = { activeSessionId, sessions: remainingSessions }
        persistWorkspace(nextWorkspace)
        return nextWorkspace
      })
    },
    [persistWorkspace]
  )

  return {
    config: activeSession?.config ?? DEFAULT_CONFIG,
    parameterEnabled:
      activeSession?.parameterEnabled ?? DEFAULT_PARAMETER_ENABLED,
    messages: activeSession?.messages ?? [],
    activeSessionId: activeSession?.id ?? '',
    sessions: workspace.sessions,
    isLoadingMessages,
    models,
    groups,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    updateSessionMessages,
    clearMessages,
    createNewSession,
    selectSession,
    renameSession,
    deleteSession,
  }
}
