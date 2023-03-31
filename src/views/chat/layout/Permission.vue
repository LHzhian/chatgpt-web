<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NButton, NInput, NModal, useMessage } from 'naive-ui'
import Register from './Register.vue'
import { fetchVerify } from '@/api'
import { useAuthStore } from '@/store'
import Icon403 from '@/icons/403.vue'

interface Props {
  visible: boolean
}

defineProps<Props>()

const authStore = useAuthStore()

const ms = useMessage()

const loading = ref(false)
const token = ref('')
const username = ref('')
const regist = ref(false)

const disabled = computed(() => !token.value.trim() || loading.value)
const needReg = computed(() => regist.value)

async function handleVerify() {
  const secretKey = token.value.trim()
  const account = username.value.trim()

  if (!account || !secretKey)
    return

  try {
    loading.value = true
    const res = await fetchVerify(account, secretKey)
    authStore.setToken(res.data.token as string)
    authStore.setUsername(res.data.username as string)
    ms.success('success')
    window.location.reload()
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    authStore.removeToken()
    token.value = ''
  }
  finally {
    loading.value = false
  }
}

function handlePress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleVerify()
  }
}

function register() {
  regist.value = true
}

function closeReg() {
  regist.value = false
}
</script>

<template>
  <NModal :show="visible" style="width: 90%; max-width: 640px">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div class="space-y-4">
        <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            登录
          </h2>
          <p class="text-base text-center text-slate-500 dark:text-slate-500">
            {{ $t('common.unauthorizedTips') }}
          </p>
          <Icon403 class="w-[200px] m-auto" />
        </header>
        <NInput v-model:value="username" type="text" placeholder="账号" />
        <NInput v-model:value="token" type="password" placeholder="密码" @keypress="handlePress" />
        <NButton
          block
          type="primary"
          :disabled="disabled"
          :loading="loading"
          @click="handleVerify"
        >
          {{ $t('common.verify') }}
        </NButton>
        <NButton
          block
          type="default"
          @click="register"
        >
          {{ $t('common.register') }}
        </NButton>
      </div>
    </div>
  </NModal>
  <Register :reg-visible="needReg" @closeReg="closeReg" />
</template>
