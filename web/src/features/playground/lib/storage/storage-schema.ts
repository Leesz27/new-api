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
import { z } from 'zod'

export const STORAGE_VERSION = 2
export const MAX_STORED_SESSIONS = 50
export const MAX_STORED_MESSAGES = 100
export const MAX_STORED_MESSAGES_BYTES = 1024 * 1024
export const MAX_PERSISTED_DATA_URL_CHARS = 16_384
export const MAX_LOADED_MESSAGES_CHARS = 120_000
export const MAX_LOADED_MESSAGE_CHARS = 40_000

export const playgroundConfigSchema = z.object({
  model: z.string().optional(),
  group: z.string().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  seed: z.number().nullable().optional(),
  stream: z.boolean().optional(),
})

export const parameterEnabledSchema = z.object({
  temperature: z.boolean().optional(),
  top_p: z.boolean().optional(),
  max_tokens: z.boolean().optional(),
  frequency_penalty: z.boolean().optional(),
  presence_penalty: z.boolean().optional(),
  seed: z.boolean().optional(),
})

const messageRoleSchema = z.enum(['user', 'assistant', 'system'])
const messageStatusSchema = z.enum([
  'loading',
  'streaming',
  'complete',
  'error',
])

const messageAttachmentSchema = z.object({
  name: z.string(),
  mediaType: z.string(),
  url: z.string(),
})

const imageMessageSchema = z.object({
  model: z.string().optional(),
  sourceUrl: z.string().optional(),
  imageUrl: z.string(),
  prompt: z.string(),
  revisedPrompt: z.string().optional(),
  mode: z.enum(['generation', 'edit']),
})

const messageVersionSchema = z.object({
  id: z.string(),
  content: z.string(),
  attachments: z.array(messageAttachmentSchema).max(1).optional(),
  image: imageMessageSchema.optional(),
})

const sourceSchema = z.object({
  href: z.string(),
  title: z.string(),
})

const reasoningSchema = z.object({
  content: z.string(),
  duration: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  durationMs: z.number().optional(),
})

const messageSchema = z.object({
  key: z.string(),
  from: messageRoleSchema,
  model: z.string().optional(),
  versions: z.array(messageVersionSchema).min(1),
  createdAt: z.number().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  durationMs: z.number().optional(),
  sources: z.array(sourceSchema).optional(),
  reasoning: reasoningSchema.optional(),
  isReasoningStreaming: z.boolean().optional(),
  isReasoningComplete: z.boolean().optional(),
  isContentComplete: z.boolean().optional(),
  status: messageStatusSchema.optional(),
  errorCode: z.string().nullable().optional(),
})

export const messagesSchema = z.array(messageSchema)

const playgroundSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  config: playgroundConfigSchema,
  parameterEnabled: parameterEnabledSchema,
  messages: messagesSchema,
})

export const playgroundWorkspaceSchema = z.object({
  activeSessionId: z.string(),
  sessions: z.array(playgroundSessionSchema).min(1).max(MAX_STORED_SESSIONS),
})
