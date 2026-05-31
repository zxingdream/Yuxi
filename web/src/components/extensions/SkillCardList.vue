<template>
  <div class="skill-cards-page extension-page-root">
    <PageShoulder search-placeholder="搜索技能..." v-model:search="searchQuery">
      <template #actions>
        <template v-if="!isBatchDeleteMode">
          <a-button
            @click="isBatchDeleteMode = true"
            :disabled="loading || importing || filteredDeletableSkills.length === 0"
            class="lucide-icon-btn"
          >
            <span>批量管理</span>
          </a-button>
          <a-button
            @click="handleOpenRemoteInstall"
            :disabled="loading || importing"
            class="lucide-icon-btn"
          >
            <Computer :size="14" />
            <span>远程安装</span>
          </a-button>
          <a-upload
            accept=".zip,.md"
            :show-upload-list="false"
            :custom-request="handleImportUpload"
            :before-upload="beforeSkillUpload"
            :disabled="loading || importing"
          >
            <a-button type="primary" :loading="importing" class="lucide-icon-btn">
              <Upload :size="14" />
              <span>上传 Skill</span>
            </a-button>
          </a-upload>
          <a-tooltip title="刷新 Skills" placement="bottom">
            <a-button class="lucide-icon-btn" :disabled="loading" @click="fetchSkills">
              <RefreshCw :size="14" />
            </a-button>
          </a-tooltip>
        </template>
        <template v-else>
          <a-button size="small" type="link" @click="handleBatchSelectAll">全选</a-button>
          <a-button size="small" type="link" @click="handleBatchSelectInvert">反选</a-button>
          <a-button size="small" type="link" @click="handleBatchSelectNone">清空</a-button>
          <a-button
            type="primary"
            danger
            :disabled="selectedCardSlugs.length === 0"
            :loading="loading"
            @click="handleBatchDelete"
          >
            批量删除 ({{ selectedCardSlugs.length }})
          </a-button>
          <a-button :disabled="loading" @click="exitBatchDeleteMode">退出管理</a-button>
        </template>
      </template>
    </PageShoulder>

    <div
      v-if="filteredInstalledSkills.length === 0"
      class="extension-card-grid-empty-state skill-empty-state"
    >
      <div class="skill-empty-card">
        <div class="skill-empty-icon">
          <BookMarked :size="22" />
        </div>
        <div class="skill-empty-title">
          {{ searchQuery ? '没有匹配的 Skill' : '还没有添加 Skill' }}
        </div>
        <div class="skill-empty-desc">
          {{
            searchQuery
              ? '换个关键词试试，或清空搜索条件。'
              : '可以从远程仓库安装，或上传本地 Skill 文件。'
          }}
        </div>
      </div>
    </div>

    <template v-else>
      <ExtensionCardGrid>
        <div
          v-for="skill in filteredInstalledSkills"
          :key="skill.slug"
          class="card-wrapper"
          :class="{
            selected: selectedCardSlugs.includes(skill.slug),
            'batch-mode': isBatchDeleteMode
          }"
        >
          <a-checkbox
            v-if="isBatchDeleteMode && skill.sourceType !== 'builtin'"
            :checked="selectedCardSlugs.includes(skill.slug)"
            @change="handleToggleCardSelect(skill.slug)"
            class="card-select-checkbox"
          />
          <InfoCard
            :title="skill.name"
            :description="skill.description || '暂无描述'"
            :default-icon="BookMarkedIcon"
            :tags="skillTags(skill)"
            :status="skill.status"
            @click="handleCardClick(skill)"
            :class="{ 'card-clickable-select': isBatchDeleteMode }"
          >
          </InfoCard>
        </div>
      </ExtensionCardGrid>
    </template>

    <a-modal
      v-model:open="remoteInstallModalVisible"
      title="远程安装 Skill"
      :footer="null"
      width="760px"
      :closable="!installingRemoteSkill"
      :mask-closable="!installingRemoteSkill"
      :keyboard="!installingRemoteSkill"
    >
      <div class="remote-install-panel modal-mode">
        <div class="install-setup-stage">
          <a-tabs
            v-model:activeKey="activeTab"
            :disabled="installingRemoteSkill"
            class="install-tabs"
          >
            <!-- Tab 1: 按仓库拉取 -->
            <a-tab-pane key="repo" tab="按仓库拉取">
              <div class="tab-content-wrapper">
                <a-form layout="vertical" class="remote-install-form">
                  <div class="repo-input-row">
                    <div class="repo-input-field">
                      <a-input
                        v-model:value="remoteInstallForm.source"
                        placeholder="来源仓库，如 anthropics/skills 或 GitHub URL"
                        :disabled="installingRemoteSkill"
                      >
                        <template #suffix>
                          <a-dropdown
                            :trigger="['click']"
                            placement="bottomRight"
                            overlay-class-name="history-dropdown-menu"
                          >
                            <div class="history-trigger-wrapper">
                              <a-tooltip title="历史仓库">
                                <History
                                  :size="14"
                                  class="history-icon-trigger"
                                  :class="{ 'has-history': repoHistory.length > 0 }"
                                />
                              </a-tooltip>
                            </div>
                            <template #overlay>
                              <a-menu @click="handleSelectHistory">
                                <a-menu-item v-if="repoHistory.length === 0" disabled>
                                  <span class="history-empty-text">暂无使用历史</span>
                                </a-menu-item>
                                <template v-else>
                                  <a-menu-item v-for="item in repoHistory" :key="item">
                                    <div class="history-item-menu-row">
                                      <span class="history-item-text" :title="item">{{
                                        item
                                      }}</span>
                                      <span
                                        class="history-item-del-btn"
                                        @click.stop="deleteHistoryItem(item)"
                                      >
                                        <Trash2 :size="12" />
                                      </span>
                                    </div>
                                  </a-menu-item>
                                  <a-menu-divider />
                                  <a-menu-item
                                    key="clear-all-history"
                                    class="clear-history-menu-item"
                                  >
                                    <div class="clear-history-btn-content">
                                      <Trash2 :size="12" class="clear-icon" />
                                      <span>清空历史记录</span>
                                    </div>
                                  </a-menu-item>
                                </template>
                              </a-menu>
                            </template>
                          </a-dropdown>
                        </template>
                      </a-input>
                    </div>
                    <a-button
                      type="primary"
                      :loading="listingRemoteSkills"
                      :disabled="installingRemoteSkill"
                      @click="handleListRemoteSkills"
                    >
                      拉取技能
                    </a-button>
                  </div>
                  <div class="repo-hint-text">
                    支持 `owner/repo` 或 GitHub URL。可前往
                    <a href="https://skills.sh/" target="_blank" rel="noopener noreferrer"
                      >skills.sh</a
                    >
                    查询开源 skills。
                  </div>

                  <!-- 仓库技能分页多选列表 -->
                  <div v-if="remoteSkillOptions.length" class="skills-list-section">
                    <div class="list-operations-bar">
                      <div class="op-buttons">
                        <a-button size="small" type="link" @click="handleRepoSelectAll"
                          >全选</a-button
                        >
                        <a-button size="small" type="link" @click="handleRepoSelectInvert"
                          >反选</a-button
                        >
                        <a-button size="small" type="link" @click="handleRepoSelectNone"
                          >清空</a-button
                        >
                      </div>
                      <a-input
                        v-model:value="repoFilterKeyword"
                        placeholder="本地过滤检索..."
                        size="small"
                        style="width: 180px"
                        allow-clear
                      />
                    </div>
                    <div class="skills-list-viewport">
                      <a-list
                        size="small"
                        :pagination="{ pageSize: 5, size: 'small', showSizeChanger: false }"
                        :data-source="filteredRepoSkills"
                        class="remote-skills-list-container"
                      >
                        <template #renderItem="{ item }">
                          <a-list-item>
                            <div class="skill-list-item-content">
                              <div class="skill-name-col">
                                <a-checkbox
                                  :checked="selectedRepoSkills.includes(item.name)"
                                  @change="
                                    (e) => handleToggleRepoSkill(item.name, e.target.checked)
                                  "
                                  :disabled="installingRemoteSkill"
                                >
                                  <span class="skill-item-name">{{ item.name }}</span>
                                </a-checkbox>
                              </div>
                              <div class="skill-desc-col">
                                <a-tooltip
                                  :title="item.description || '暂无描述'"
                                  placement="topLeft"
                                >
                                  <span class="skill-item-desc">{{
                                    item.description || '暂无描述'
                                  }}</span>
                                </a-tooltip>
                              </div>
                            </div>
                          </a-list-item>
                        </template>
                      </a-list>
                    </div>
                    <div class="remote-skill-summary">
                      已选 {{ selectedRepoSkills.length }} / 共发现
                      {{ remoteSkillOptions.length }} 个 skills。
                    </div>
                  </div>
                </a-form>
              </div>
            </a-tab-pane>

            <!-- Tab 2: 全局搜索发现 -->
            <a-tab-pane key="search" tab="全局搜索发现">
              <div class="tab-content-wrapper">
                <a-form layout="vertical" class="remote-install-form">
                  <div class="repo-input-row">
                    <div class="repo-input-field">
                      <a-input
                        v-model:value="searchKeyword"
                        placeholder="输入 web、python 等关键字进行全局查找"
                        :disabled="installingRemoteSkill"
                        @pressEnter="handleSearchRemoteSkills"
                      />
                    </div>
                    <a-button
                      type="primary"
                      :loading="searchingRemoteSkills"
                      :disabled="installingRemoteSkill"
                      @click="handleSearchRemoteSkills"
                    >
                      查找技能
                    </a-button>
                  </div>
                  <div class="repo-hint-text">
                    直接输入关键字检索 skills.sh 上的开源 Skills 并批量拉取安装。
                  </div>

                  <!-- 搜索结果列表 -->
                  <div v-if="searchedSkills.length" class="skills-list-section">
                    <div class="list-operations-bar">
                      <div class="op-buttons">
                        <a-button size="small" type="link" @click="handleSearchSelectAll"
                          >全选</a-button
                        >
                        <a-button size="small" type="link" @click="handleSearchSelectInvert"
                          >反选</a-button
                        >
                        <a-button size="small" type="link" @click="handleSearchSelectNone"
                          >清空</a-button
                        >
                      </div>
                    </div>
                    <div class="skills-list-viewport">
                      <a-list
                        size="small"
                        :pagination="{ pageSize: 5, size: 'small', showSizeChanger: false }"
                        :data-source="searchedSkills"
                        class="remote-skills-list-container"
                      >
                        <template #renderItem="{ item }">
                          <a-list-item>
                            <div class="search-skill-item-row">
                              <div class="skill-name-col">
                                <a-checkbox
                                  :checked="
                                    selectedSearchSkills.some(
                                      (s) => s.name === item.name && s.source === item.source
                                    )
                                  "
                                  @change="(e) => handleToggleSearchSkill(item, e.target.checked)"
                                  :disabled="installingRemoteSkill"
                                >
                                  <span class="skill-item-name">{{ item.name }}</span>
                                </a-checkbox>
                              </div>
                              <div class="skill-repo-col">
                                <a-tooltip :title="item.source" placement="topLeft">
                                  <span class="skill-item-repo">{{ item.source }}</span>
                                </a-tooltip>
                              </div>
                              <div class="skill-install-col">
                                <a-tag
                                  v-if="item.installs"
                                  color="blue"
                                  class="skill-item-installs"
                                >
                                  {{ item.installs }}
                                </a-tag>
                              </div>
                            </div>
                          </a-list-item>
                        </template>
                      </a-list>
                    </div>
                    <div class="remote-skill-summary">
                      已选择 {{ selectedSearchSkills.length }} / 共找到
                      {{ searchedSkills.length }} 个 skills。
                    </div>
                  </div>
                </a-form>
              </div>
            </a-tab-pane>
          </a-tabs>

          <!-- 底部操作区 -->
          <div class="modal-footer-actions">
            <a-button :disabled="installingRemoteSkill" @click="handleCancelInstall">
              取消
            </a-button>
            <a-button
              type="primary"
              :loading="installingRemoteSkill"
              :disabled="
                activeTab === 'repo'
                  ? selectedRepoSkills.length === 0
                  : selectedSearchSkills.length === 0
              "
              @click="startInstallRemoteSkills"
            >
              解析并确认 (已选
              {{ activeTab === 'repo' ? selectedRepoSkills.length : selectedSearchSkills.length }}
              个)
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="draftConfirmVisible"
      title="确认添加 Skill"
      width="720px"
      :confirm-loading="draftConfirmLoading"
      :closable="!draftConfirmLoading"
      :mask-closable="!draftConfirmLoading"
      :keyboard="!draftConfirmLoading"
      ok-text="确认添加"
      cancel-text="取消"
      @ok="confirmSkillDraft"
      @cancel="cancelSkillDraft"
    >
      <div v-if="pendingDraft" class="skill-draft-confirm-panel">
        <div class="draft-source-row">
          <span class="draft-source-label">来源</span>
          <span>{{ pendingDraft.source || sourceTypeLabel(pendingDraft.source_type) }}</span>
        </div>
        <div class="draft-items-list">
          <div
            v-for="item in pendingDraft.items"
            :key="`${item.source || pendingDraft.source || 'local'}:${item.slug || item.name}`"
            class="draft-item"
            :class="{ failed: item.success === false }"
          >
            <div class="draft-item-main">
              <div class="draft-item-title">{{ item.name || item.slug }}</div>
              <div class="draft-item-desc">{{ item.description || item.error || '暂无描述' }}</div>
              <div v-if="item.warnings?.length" class="draft-item-warning">
                {{ item.warnings.join('；') }}
              </div>
            </div>
            <a-tag v-if="item.success === false" color="red">解析失败</a-tag>
            <a-tag v-else color="blue">{{
              sourceTypeLabel(item.source_type || pendingDraft.source_type)
            }}</a-tag>
          </div>
        </div>
        <div class="draft-share-title">生效范围</div>
        <ShareConfigForm
          ref="shareConfigFormRef"
          v-model="draftShareConfig"
          :auto-select-user-dept="true"
          :allowed-access-levels="pendingDraft.allowed_access_levels || ['user']"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { RefreshCw, Upload, Computer, BookMarked, History, Trash2 } from 'lucide-vue-next'
import { skillApi } from '@/apis/skill_api'
import ExtensionCardGrid from './ExtensionCardGrid.vue'
import InfoCard from '@/components/shared/InfoCard.vue'
import PageShoulder from '@/components/shared/PageShoulder.vue'
import ShareConfigForm from '@/components/ShareConfigForm.vue'

const BookMarkedIcon = BookMarked

const router = useRouter()

const loading = ref(false)
const importing = ref(false)
const listingRemoteSkills = ref(false)
const installingRemoteSkill = ref(false)
const searchQuery = ref('')

const isBatchDeleteMode = ref(false)
const selectedCardSlugs = ref([])

const skills = ref([])

const remoteInstallModalVisible = ref(false)
const activeTab = ref('repo') // 'repo' 或 'search'

const remoteInstallForm = reactive({
  source: 'https://github.com/anthropics/skills',
  skills: []
})
const remoteSkillOptions = ref([])
const repoFilterKeyword = ref('')
const selectedRepoSkills = ref([])

const searchKeyword = ref('')
const searchingRemoteSkills = ref(false)
const searchedSkills = ref([])
const selectedSearchSkills = ref([])

const repoHistory = ref([])
const allowedSkillAccessLevels = ref(['user'])
const draftConfirmVisible = ref(false)
const draftConfirmLoading = ref(false)
const pendingDraft = ref(null)
const draftShareConfig = ref({ access_level: 'user', department_ids: [], user_uids: [] })
const shareConfigFormRef = ref(null)

const matchesSearch = (skill) => {
  if (!searchQuery.value) return true
  const q = searchQuery.value.toLowerCase()
  return skill.name.toLowerCase().includes(q) || skill.slug.toLowerCase().includes(q)
}

const installedSkillCards = computed(() =>
  (skills.value || []).map((skill) => {
    const sourceType = skill.source_type || 'upload'
    return {
      ...skill,
      sourceType,
      sourceLabel: sourceTypeLabel(sourceType),
      status:
        skill.enabled === false
          ? { label: '已禁用', level: 'default' }
          : { label: '已启用', level: 'success' }
    }
  })
)

const filteredInstalledSkills = computed(() => installedSkillCards.value.filter(matchesSearch))
const filteredDeletableSkills = computed(() =>
  filteredInstalledSkills.value.filter((skill) => skill.sourceType !== 'builtin')
)

// 仓库拉取的技能列表过滤
const filteredRepoSkills = computed(() => {
  if (!repoFilterKeyword.value.trim()) return remoteSkillOptions.value
  const kw = repoFilterKeyword.value.trim().toLowerCase()
  return remoteSkillOptions.value.filter(
    (item) =>
      item.name.toLowerCase().includes(kw) ||
      (item.description && item.description.toLowerCase().includes(kw))
  )
})

// 批量选择/反选/清空管理
const handleRepoSelectAll = () => {
  selectedRepoSkills.value = filteredRepoSkills.value.map((item) => item.name)
}
const handleRepoSelectNone = () => {
  selectedRepoSkills.value = []
}
const handleRepoSelectInvert = () => {
  const currentSelected = new Set(selectedRepoSkills.value)
  const newSelected = []
  filteredRepoSkills.value.forEach((item) => {
    if (!currentSelected.has(item.name)) {
      newSelected.push(item.name)
    }
  })
  selectedRepoSkills.value = newSelected
}

const handleSearchSelectAll = () => {
  selectedSearchSkills.value = [...searchedSkills.value]
}
const handleSearchSelectNone = () => {
  selectedSearchSkills.value = []
}
const handleSearchSelectInvert = () => {
  const newSelected = []
  searchedSkills.value.forEach((item) => {
    const isSelected = selectedSearchSkills.value.some(
      (s) => s.name === item.name && s.source === item.source
    )
    if (!isSelected) {
      newSelected.push(item)
    }
  })
  selectedSearchSkills.value = newSelected
}

const handleToggleRepoSkill = (name, checked) => {
  if (checked) {
    if (!selectedRepoSkills.value.includes(name)) {
      selectedRepoSkills.value.push(name)
    }
  } else {
    selectedRepoSkills.value = selectedRepoSkills.value.filter((n) => n !== name)
  }
}

const handleToggleSearchSkill = (item, checked) => {
  if (checked) {
    const isExist = selectedSearchSkills.value.some(
      (s) => s.name === item.name && s.source === item.source
    )
    if (!isExist) {
      selectedSearchSkills.value.push(item)
    }
  } else {
    selectedSearchSkills.value = selectedSearchSkills.value.filter(
      (s) => !(s.name === item.name && s.source === item.source)
    )
  }
}

const sourceTypeLabel = (sourceType) => {
  if (sourceType === 'builtin') return '内置'
  if (sourceType === 'remote') return '远程'
  return '上传'
}

const skillTags = (skill) => {
  if (skill.sourceType === 'builtin') return [{ name: skill.sourceLabel || '内置' }]
  return [{ name: skill.sourceLabel || '外部', color: 'blue' }]
}

const navigateToDetail = (skill) => {
  router.push({ path: `/extensions/skill/${encodeURIComponent(skill.slug)}` })
}

const handleCardClick = (skill) => {
  if (isBatchDeleteMode.value) {
    handleToggleCardSelect(skill.slug)
  } else {
    navigateToDetail(skill)
  }
}

const handleToggleCardSelect = (slug) => {
  const target = installedSkillCards.value.find((skill) => skill.slug === slug)
  if (target?.sourceType === 'builtin') return
  const idx = selectedCardSlugs.value.indexOf(slug)
  if (idx > -1) {
    selectedCardSlugs.value.splice(idx, 1)
  } else {
    selectedCardSlugs.value.push(slug)
  }
}

const handleBatchSelectAll = () => {
  selectedCardSlugs.value = filteredInstalledSkills.value
    .filter((skill) => skill.sourceType !== 'builtin')
    .map((skill) => skill.slug)
}

const handleBatchSelectNone = () => {
  selectedCardSlugs.value = []
}

const handleBatchSelectInvert = () => {
  const currentSet = new Set(selectedCardSlugs.value)
  const nextSelected = []
  filteredInstalledSkills.value.forEach((skill) => {
    if (skill.sourceType !== 'builtin' && !currentSet.has(skill.slug)) {
      nextSelected.push(skill.slug)
    }
  })
  selectedCardSlugs.value = nextSelected
}

const exitBatchDeleteMode = () => {
  isBatchDeleteMode.value = false
  selectedCardSlugs.value = []
}

const handleBatchDelete = () => {
  const deletableSlugs = selectedCardSlugs.value.filter((slug) => {
    const target = installedSkillCards.value.find((skill) => skill.slug === slug)
    return target?.sourceType !== 'builtin'
  })
  if (deletableSlugs.length === 0) return

  Modal.confirm({
    title: '确定要批量删除选中的技能吗？',
    content: `您已选中了 ${deletableSlugs.length} 个技能。该操作将从数据库和物理磁盘中彻底删除这些技能包，且不可恢复！`,
    okText: '确定删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      loading.value = true
      try {
        const res = await skillApi.deleteSkillsBatch(deletableSlugs)
        const results = res?.data || []
        const successList = results.filter((r) => r.success)
        const failList = results.filter((r) => !r.success)

        if (failList.length === 0) {
          message.success(`批量删除成功，已删除 ${successList.length} 个技能`)
        } else {
          message.warning(`批量删除完成：成功 ${successList.length} 个，失败 ${failList.length} 个`)
        }

        exitBatchDeleteMode()
        await fetchSkills()
      } catch (error) {
        message.error(error?.response?.data?.detail || error.message || '批量删除失败')
      } finally {
        loading.value = false
      }
    }
  })
}

const fetchSkills = async () => {
  loading.value = true
  try {
    const skillResult = await skillApi.listSkills()
    skills.value = skillResult?.data || []
    allowedSkillAccessLevels.value = skillResult?.allowed_access_levels || ['user']
  } catch {
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

const beforeSkillUpload = (file) => {
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.zip') && lower !== 'skill.md') {
    message.error('仅支持上传 .zip 文件或 SKILL.md 文件')
    return false
  }
  return true
}

const cloneShareConfig = (config) => ({
  access_level: config?.access_level || 'user',
  department_ids: [...(config?.department_ids || [])],
  user_uids: [...(config?.user_uids || [])]
})

const resetDraftConfirmation = () => {
  draftConfirmVisible.value = false
  draftConfirmLoading.value = false
  pendingDraft.value = null
  draftShareConfig.value = { access_level: 'user', department_ids: [], user_uids: [] }
}

const normalizePendingDraft = (draftPayload) => {
  const drafts = Array.isArray(draftPayload) ? draftPayload : [draftPayload]
  const validDrafts = drafts.filter((item) => item?.draft_id)
  const first = validDrafts[0] || {}
  return {
    ...first,
    draft_ids: validDrafts.map((item) => item.draft_id),
    source: validDrafts.length === 1 ? first.source : `${validDrafts.length} 个来源`,
    items: validDrafts.flatMap((draft) =>
      (draft.items || []).map((item) => ({
        ...item,
        source: draft.source,
        source_type: draft.source_type
      }))
    ),
    default_share_config: first.default_share_config || cloneShareConfig(null),
    allowed_access_levels: first.allowed_access_levels || allowedSkillAccessLevels.value
  }
}

const openDraftConfirmation = async (draftPayload) => {
  const draft = normalizePendingDraft(draftPayload)
  if (!draft.draft_ids.length || !draft.items.some((item) => item.success !== false)) {
    await Promise.allSettled(
      draft.draft_ids.map((draftId) => skillApi.discardSkillInstallDraft(draftId))
    )
    message.error('没有可添加的 Skill')
    return false
  }
  pendingDraft.value = draft
  draftShareConfig.value = cloneShareConfig(draft.default_share_config)
  draftConfirmVisible.value = true
  return true
}

const cancelSkillDraft = async () => {
  if (draftConfirmLoading.value) return
  const draftIds = pendingDraft.value?.draft_ids || []
  resetDraftConfirmation()
  await Promise.allSettled(draftIds.map((draftId) => skillApi.discardSkillInstallDraft(draftId)))
}

const confirmSkillDraft = async () => {
  const validation = shareConfigFormRef.value?.validate?.()
  if (validation && !validation.valid) {
    message.warning(validation.message || '请完善 Skill 生效范围')
    return
  }

  const draftIds = pendingDraft.value?.draft_ids || []
  if (!draftIds.length) return

  draftConfirmLoading.value = true
  try {
    const results = []
    for (const draftId of draftIds) {
      const res = await skillApi.confirmSkillInstallDraft(draftId, draftShareConfig.value)
      results.push(...(res?.data || []))
    }
    const successCount = results.filter((item) => item.success).length
    const failedCount = results.length - successCount
    if (failedCount === 0) {
      message.success(`已添加 ${successCount} 个 Skill`)
    } else {
      message.warning(`添加完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
    }
    remoteInstallModalVisible.value = false
    resetDraftConfirmation()
    await fetchSkills()
  } catch (error) {
    message.error(error?.response?.data?.detail || error.message || '确认添加 Skill 失败')
  } finally {
    draftConfirmLoading.value = false
  }
}

const handleImportUpload = async ({ file, onSuccess, onError }) => {
  importing.value = true
  try {
    const result = await skillApi.prepareSkillUpload(file)
    if (await openDraftConfirmation(result?.data)) {
      message.success('解析完成，请确认 Skill 生效范围')
    }
    onSuccess?.(result)
  } catch (e) {
    message.error(e?.response?.data?.detail || e.message || '解析 Skill 失败')
    onError?.(e)
  } finally {
    importing.value = false
  }
}

const handleOpenRemoteInstall = () => {
  if (!remoteInstallModalVisible.value) {
    selectedRepoSkills.value = []
    selectedSearchSkills.value = []
    remoteSkillOptions.value = []
    searchedSkills.value = []
    repoFilterKeyword.value = ''
    searchKeyword.value = ''
  }
  remoteInstallModalVisible.value = true
}

const handleCancelInstall = () => {
  remoteInstallModalVisible.value = false
}

const handleListRemoteSkills = async () => {
  const source = remoteInstallForm.source.trim()
  if (!source) {
    message.warning('请输入来源仓库')
    return
  }
  listingRemoteSkills.value = true
  try {
    const result = await skillApi.listRemoteSkills(source)
    remoteSkillOptions.value = result?.data || []
    selectedRepoSkills.value = []
    if (!remoteSkillOptions.value.length) {
      message.warning('未发现可安装的 Skills')
      return
    }
    message.success(`已发现 ${remoteSkillOptions.value.length} 个 Skills`)

    // 保存成功的拉取历史
    let history = [...repoHistory.value]
    history = history.filter((item) => item !== source)
    history.unshift(source)
    if (history.length > 10) {
      history = history.slice(0, 10)
    }
    repoHistory.value = history
    localStorage.setItem('yuxi_remote_repo_history', JSON.stringify(history))
  } catch (error) {
    message.error(error?.response?.data?.detail || error.message || '获取远程 Skills 失败')
  } finally {
    listingRemoteSkills.value = false
  }
}

const loadHistory = () => {
  try {
    const raw = localStorage.getItem('yuxi_remote_repo_history')
    if (raw) {
      repoHistory.value = JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load repo history', e)
  }
}

const deleteHistoryItem = (item) => {
  repoHistory.value = repoHistory.value.filter((h) => h !== item)
  localStorage.setItem('yuxi_remote_repo_history', JSON.stringify(repoHistory.value))
}

const clearAllHistory = () => {
  repoHistory.value = []
  localStorage.removeItem('yuxi_remote_repo_history')
  message.success('历史记录已清空')
}

const handleSelectHistory = ({ key }) => {
  if (key === 'clear-all-history') {
    clearAllHistory()
    return
  }
  remoteInstallForm.source = key
}

const handleSearchRemoteSkills = async () => {
  const query = searchKeyword.value.trim()
  if (!query) {
    message.warning('请输入搜索关键字')
    return
  }
  searchingRemoteSkills.value = true
  try {
    const result = await skillApi.searchRemoteSkills(query)
    searchedSkills.value = result?.data || []
    selectedSearchSkills.value = []
    if (!searchedSkills.value.length) {
      message.warning('未搜索到相关的 Skills')
    } else {
      message.success(`搜索到 ${searchedSkills.value.length} 个 Skills`)
    }
  } catch (error) {
    message.error(error?.response?.data?.detail || error.message || '搜索远程 Skills 失败')
  } finally {
    searchingRemoteSkills.value = false
  }
}

const startInstallRemoteSkills = async () => {
  installingRemoteSkill.value = true

  try {
    const drafts = []
    if (activeTab.value === 'repo') {
      const source = remoteInstallForm.source.trim()
      const skillsToInstall = [...selectedRepoSkills.value]
      const result = await skillApi.prepareRemoteSkills({ source, skills: skillsToInstall })
      drafts.push(result?.data)
    } else {
      const groups = {}
      selectedSearchSkills.value.forEach((item) => {
        if (!groups[item.source]) groups[item.source] = []
        groups[item.source].push(item.name)
      })

      for (const [source, sourceSkills] of Object.entries(groups)) {
        const result = await skillApi.prepareRemoteSkills({ source, skills: sourceSkills })
        drafts.push(result?.data)
      }
    }

    if (await openDraftConfirmation(drafts)) {
      remoteInstallModalVisible.value = false
      message.success('解析完成，请确认 Skill 生效范围')
    }
  } catch (error) {
    message.error(error?.response?.data?.detail || error.message || '解析远程 Skill 失败')
  } finally {
    installingRemoteSkill.value = false
  }
}

watch(activeTab, () => {
  selectedRepoSkills.value = []
  selectedSearchSkills.value = []
})

watch(remoteInstallModalVisible, (visible) => {
  if (!visible && !installingRemoteSkill.value) {
    selectedRepoSkills.value = []
    selectedSearchSkills.value = []
  }
})

onMounted(() => {
  fetchSkills()
  loadHistory()
})

defineExpose({
  fetchSkills,
  handleImportUpload,
  openRemoteInstallModal: handleOpenRemoteInstall,
  loading
})
</script>

<style lang="less" scoped>
@import '@/assets/css/extensions.less';
</style>

<style lang="less" scoped>
.skill-empty-state {
  width: 100%;
  min-height: 280px;
  padding: 40px var(--page-padding);
}

.skill-empty-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 220px;
  flex-direction: column;
  border: 1px dashed var(--gray-150);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--gray-0) 0%, var(--gray-25) 100%);
  color: var(--gray-500);
  text-align: center;
}

.skill-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: var(--main-10);
  color: var(--main-color);
}

.skill-empty-title {
  color: var(--gray-800);
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.skill-empty-desc {
  margin-top: 4px;
  color: var(--gray-500);
  font-size: 13px;
  line-height: 20px;
}

.card-wrapper {
  position: relative;

  &.batch-mode {
    :deep(.info-card) {
      cursor: pointer;
      border-color: var(--gray-200);

      &:hover {
        border-color: var(--main-100);
      }
    }

    :deep(.info-card-status) {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
  }

  &.selected {
    :deep(.info-card) {
      border-color: var(--main-color, #1890ff) !important;
      background: linear-gradient(45deg, var(--gray-0) 0%, var(--main-30) 100%) !important;
    }
  }

  .card-select-checkbox {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
  }
}

.skill-draft-confirm-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .draft-source-row {
    display: flex;
    gap: 8px;
    color: var(--gray-700);
    font-size: 13px;
  }

  .draft-source-label,
  .draft-share-title {
    color: var(--gray-500);
    font-weight: 600;
  }

  .draft-items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 260px;
    overflow: auto;
  }

  .draft-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--gray-150);
    border-radius: 10px;
    background: var(--gray-0);

    &.failed {
      border-color: var(--error-200, #ffccc7);
      background: var(--error-50, #fff2f0);
    }
  }

  .draft-item-main {
    min-width: 0;
  }

  .draft-item-title {
    font-weight: 600;
    color: var(--gray-900);
  }

  .draft-item-desc,
  .draft-item-warning {
    margin-top: 4px;
    font-size: 12px;
    color: var(--gray-500);
  }

  .draft-item-warning {
    color: var(--warning-600, #d48806);
  }
}

.remote-install-panel {
  .repo-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;

    .repo-input-field {
      flex: 1;
      min-width: 0;
    }
  }

  .history-trigger-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    cursor: pointer;
    outline: none;
    margin-right: -4px;
    border-radius: 4px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--gray-100);
    }

    &:focus,
    &:focus-visible {
      outline: none;
    }
  }

  .history-icon-trigger {
    color: var(--gray-400);
    transition: color 0.2s ease;
    outline: none;

    &:hover {
      color: var(--main-color);
    }

    &.has-history {
      color: var(--gray-500);

      &:hover {
        color: var(--main-color);
      }
    }
  }

  .repo-hint-text {
    font-size: 12px;
    color: var(--gray-400);
    margin-bottom: 12px;
    line-height: 1.4;

    a {
      color: var(--main-color);
      text-decoration: underline;
    }
  }

  .tab-content-wrapper {
    padding: 4px 0 8px 0;
  }

  .skills-list-section {
    margin-top: 12px;
    border: 1px solid var(--gray-150);
    border-radius: 8px;
    background: var(--gray-25);
    padding: 12px;
  }

  .list-operations-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--gray-150);
    padding-bottom: 6px;

    .op-buttons {
      display: flex;
      gap: 2px;

      .ant-btn {
        padding: 0 4px;
        height: auto;
        font-size: 12px;
      }
    }
  }

  .skills-list-viewport {
    max-height: 280px;
    overflow-y: auto;
    border: 1px solid var(--gray-150);
    border-radius: 6px;
    background: var(--gray-0);
    padding: 0 8px;
  }

  .remote-skills-list-container {
    :deep(.ant-list-item) {
      padding: 6px 4px;
      border-bottom: 1px solid var(--gray-100);
      &:last-child {
        border-bottom: none;
      }
    }
  }

  .skill-list-item-content {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 16px;

    .skill-name-col {
      width: 280px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      :deep(.ant-checkbox-wrapper) {
        display: flex;
        align-items: center;
        width: 100%;
      }
    }

    .skill-desc-col {
      flex: 1;
      min-width: 0;
    }

    .skill-item-name {
      font-weight: 600;
      color: var(--gray-900);
    }

    .skill-item-desc {
      display: block;
      font-size: 12px;
      color: var(--gray-500);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: help;
    }
  }

  .search-skill-item-row {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 16px;

    .skill-name-col {
      width: 280px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      :deep(.ant-checkbox-wrapper) {
        display: flex;
        align-items: center;
        width: 100%;
      }
    }

    .skill-repo-col {
      flex: 1;
      min-width: 0;
    }

    .skill-install-col {
      width: 90px;
      flex-shrink: 0;
      text-align: right;
    }

    .skill-item-name {
      font-weight: 600;
      color: var(--gray-900);
    }

    .skill-item-repo {
      display: block;
      font-size: 12px;
      color: var(--gray-400);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: help;
    }
  }

  .modal-footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
    border-top: 1px solid var(--gray-150);
    padding-top: 12px;
  }
}
</style>

<!-- NOTE: unscoped style block 用于 dropdown overlay 样式穿透 teleport -->
<style lang="less">
/* Ant Design Dropdown overlay 通过 teleport 挂载到 body，
   scoped CSS 无法穿透，因此必须使用 unscoped 样式。
   使用 .history-dropdown-menu 作为 overlayClassName 命名空间。 */
.history-dropdown-menu {
  min-width: 280px;

  .ant-dropdown-menu {
    padding: 4px;
  }

  .ant-dropdown-menu-item {
    padding: 8px 12px;
    border-radius: 6px;

    .ant-dropdown-menu-title-content {
      display: flex;
      align-items: center;
      width: 100%;
    }
  }
}

/* 历史记录行：仓库地址 + 删除按钮 */
.history-item-menu-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;

  .history-item-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--gray-800);
    line-height: 1;
  }

  .history-item-del-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--gray-400);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;

    svg {
      display: block;
    }

    &:hover {
      color: var(--color-error-500, #ff4d4f);
      background: var(--color-error-10, rgba(255, 77, 79, 0.1));
    }
  }
}

.history-empty-text {
  color: var(--gray-400);
  font-size: 12px;
}

/* 清空历史记录按钮内容 — 图标在左文字在右，水平居中 */
.clear-history-btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-error-500, #ff4d4f);
  font-weight: 500;
  font-size: 13px;
  width: 100%;

  .clear-icon {
    display: flex;
    align-items: center;
  }
}
</style>
