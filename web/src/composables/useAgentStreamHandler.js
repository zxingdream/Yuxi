import { message } from 'ant-design-vue'
import { handleChatError } from '@/utils/errorHandler'
import { unref } from 'vue'

export function useAgentStreamHandler({
  getThreadState,
  processApprovalInStream,
  currentAgentId,
  supportsFiles,
  streamSmoother
}) {
  const debugPrefix = '[AgentStateDebug]'
  /**
   * Process a single stream chunk based on its status
   * @param {Object} chunk - The parsed JSON chunk
   * @param {String} threadId - The current thread ID
   * @returns {Boolean} - Returns true if processing should stop (e.g. error, finished, interrupted)
   */
  const handleStreamChunk = (chunk, threadId) => {
    const { status, msg, request_id, message: chunkMessage } = chunk
    const threadState = getThreadState(threadId)

    if (!threadState) return false

    switch (status) {
      case 'init':
        {
          const resolvedRequestId = request_id || threadState.pendingRequestId
          if (resolvedRequestId) {
            threadState.pendingRequestId = resolvedRequestId
          }
          if (resolvedRequestId && msg && msg.type !== 'system') {
            threadState.onGoingConv.msgChunks[resolvedRequestId] = [
              {
                ...msg,
                id: msg?.id || resolvedRequestId,
                extra_metadata: {
                  ...(msg?.extra_metadata || {}),
                  request_id: resolvedRequestId
                }
              }
            ]
          }
        }
        // 只有在服务端确认 init 后，才展示“正在回复”的加载动画。
        threadState.replyLoadingVisible = true
        return false

      case 'loading':
        if (msg.id) {
          if (streamSmoother) {
            streamSmoother.pushChunk(msg, threadId)
          } else {
            if (!threadState.onGoingConv.msgChunks[msg.id]) {
              threadState.onGoingConv.msgChunks[msg.id] = []
            }
            threadState.onGoingConv.msgChunks[msg.id].push(msg)
          }
        }
        return false

      case 'error':
        streamSmoother?.flushThread(threadId)
        handleChatError({ message: chunkMessage }, 'stream')
        // Stop the loading indicator
        if (threadState) {
          threadState.isStreaming = false
          threadState.replyLoadingVisible = false
          threadState.pendingRequestId = null
        }
        return true

      case 'ask_user_question_required':
      case 'human_approval_required':
        streamSmoother?.flushThread(threadId)
        threadState.replyLoadingVisible = false
        console.log(`${debugPrefix}[approval_required]`, {
          threadId,
          currentAgentId: unref(currentAgentId)
        })
        // 使用审批 composable 处理审批请求
        return processApprovalInStream(chunk, threadId, unref(currentAgentId))

      case 'agent_state':
        console.log(`${debugPrefix}[agent_state_chunk]`, {
          threadId,
          supportsFiles: unref(supportsFiles),
          currentAgentId: unref(currentAgentId),
          hasAgentState: !!chunk.agent_state,
          todoCount: Array.isArray(chunk.agent_state?.todos) ? chunk.agent_state.todos.length : 0,
          uploadCount: Array.isArray(chunk.agent_state?.uploads)
            ? chunk.agent_state.uploads.length
            : 0
        })
        if (chunk.agent_state) {
          console.log(`${debugPrefix}[agent_state_apply]`, {
            threadId,
            todos: chunk.agent_state?.todos || [],
            uploads: chunk.agent_state?.uploads || []
          })
          threadState.agentState = chunk.agent_state
        } else {
          console.warn(`${debugPrefix}[agent_state_skip]`, {
            reason: 'empty_state',
            supportsFiles: unref(supportsFiles),
            hasAgentState: !!chunk.agent_state,
            currentAgentId: unref(currentAgentId),
            threadId
          })
        }
        return false

      case 'finished':
        streamSmoother?.flushThread(threadId)
        // 先标记流式结束，但保持消息显示直到历史记录加载完成
        if (threadState) {
          threadState.isStreaming = false
          threadState.replyLoadingVisible = false
          threadState.pendingRequestId = null
          console.log(`${debugPrefix}[finished]`, {
            threadId,
            currentAgentId: unref(currentAgentId),
            hasThreadAgentState: !!threadState.agentState,
            supportsFiles: unref(supportsFiles)
          })
          if (unref(supportsFiles) && threadState.agentState) {
            console.log(
              `[AgentState|Final] ${new Date().toLocaleTimeString()}.${new Date().getMilliseconds()}`,
              {
                threadId,
                todos: threadState.agentState?.todos || [],
                uploads: threadState.agentState?.uploads || []
              }
            )
          }
        }
        return true

      case 'interrupted':
        streamSmoother?.flushThread(threadId)
        // 中断状态，刷新消息历史
        console.warn(`${debugPrefix}[interrupted]`, {
          threadId,
          message: chunkMessage,
          currentAgentId: unref(currentAgentId)
        })
        if (threadState) {
          threadState.isStreaming = false
          threadState.replyLoadingVisible = false
          threadState.pendingRequestId = null
        }
        // 如果有 message 字段，显示提示（例如：敏感内容检测）
        if (chunkMessage) {
          message.info(chunkMessage)
        }
        return true

      case 'warning':
        if (chunkMessage) {
          message.warning(chunkMessage)
        }
        return false
    }

    return false
  }

  return {
    handleStreamChunk
  }
}
