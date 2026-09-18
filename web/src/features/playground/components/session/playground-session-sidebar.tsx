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
  PencilEdit02Icon,
  Add01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { PlaygroundSession } from '../../types'

interface PlaygroundSessionSidebarProps {
  activeSessionId: string
  disabled?: boolean
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
  onSelectSession: (sessionId: string) => void
  sessions: PlaygroundSession[]
}

export function PlaygroundSessionSidebar(props: PlaygroundSessionSidebarProps) {
  const { t } = useTranslation()
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [sessionToDelete, setSessionToDelete] =
    useState<PlaygroundSession | null>(null)

  const startEditing = (session: PlaygroundSession): void => {
    setEditingSessionId(session.id)
    setTitle(session.title)
  }

  const submitTitle = (): void => {
    if (!editingSessionId) return

    props.onRenameSession(editingSessionId, title)
    setEditingSessionId(null)
  }

  return (
    <aside className='bg-muted/20 border-border/70 flex w-64 shrink-0 flex-col border-r p-3'>
      <Button
        className='w-full justify-start'
        disabled={props.disabled}
        onClick={props.onCreateSession}
        variant='outline'
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        {t('New conversation')}
      </Button>
      <nav
        aria-label={t('Conversations')}
        className='mt-4 min-h-0 flex-1 overflow-y-auto'
      >
        <div className='space-y-1'>
          {[...props.sessions]
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .map((session) => {
              const isActive = session.id === props.activeSessionId
              const isEditing = session.id === editingSessionId

              return (
                <div
                  className={cn(
                    'group flex items-center gap-1 rounded-lg pr-1',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                  data-active={isActive ? 'true' : undefined}
                  key={session.id}
                >
                  {isEditing ? (
                    <Input
                      aria-label={t('Conversation title')}
                      autoFocus
                      className='h-8 border-0 bg-transparent shadow-none focus-visible:ring-0'
                      onBlur={submitTitle}
                      onChange={(event) => setTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') {
                          setEditingSessionId(null)
                        }
                      }}
                      value={title}
                    />
                  ) : (
                    <Button
                      className={cn(
                        'min-w-0 flex-1 justify-start truncate px-2 text-left font-normal',
                        isActive &&
                          'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={() => props.onSelectSession(session.id)}
                      variant='ghost'
                    >
                      <span className='truncate'>{session.title}</span>
                    </Button>
                  )}
                  {!isEditing && (
                    <div className='hidden shrink-0 gap-1 group-focus-within:flex group-hover:flex'>
                      <Button
                        aria-label={t('Rename conversation')}
                        disabled={props.disabled}
                        onClick={() => startEditing(session)}
                        size='icon-xs'
                        variant='ghost'
                      >
                        <HugeiconsIcon
                          icon={PencilEdit02Icon}
                          strokeWidth={2}
                        />
                      </Button>
                      <Button
                        aria-label={t('Delete conversation')}
                        disabled={props.disabled}
                        onClick={() => setSessionToDelete(session)}
                        size='icon-xs'
                        variant='ghost'
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </nav>
      <ConfirmDialog
        desc={t('This conversation and its local history will be deleted.')}
        destructive
        handleConfirm={() => {
          if (sessionToDelete) {
            props.onDeleteSession(sessionToDelete.id)
          }
          setSessionToDelete(null)
        }}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null)
        }}
        open={sessionToDelete !== null}
        title={t('Delete conversation?')}
        confirmText={t('Delete')}
      />
    </aside>
  )
}
