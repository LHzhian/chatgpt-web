<script setup lang='ts'>
import { defineEmits, ref } from 'vue'
import { NButton, NInput, NModal, useMessage } from 'naive-ui'
import { register } from '@/api'
import Icon403 from '@/icons/403.vue'

interface Props {
  regVisible: boolean
}

defineProps<Props>()

const emit = defineEmits(['closeReg'])

const ms = useMessage()

const loading = ref(false)
const username = ref('')
const password = ref('')
const comfirm = ref('')

async function reg() {
  const pwd = password.value.trim()
  const cfm = comfirm.value.trim()
  const name = username.value.trim()

  const regEmail = /^([a-zA-Z0-9_-])+@([a-zA-Z0-9_-])+(\.[a-zA-Z0-9_-])+/
  const regMobile = /^(0|86|17951)?(13[0-9]|15[012356789]|17[678]|18[0-9]|14[57])[0-9]{8}$/
  if (!regEmail.test(name) && !regMobile.test(name)) {
    ms.warning('账号格式不正确，请使用正确邮箱或手机号')
    return
  }

  if (pwd !== cfm) {
    ms.warning('两次密码不一致')
    return
  }

  if (!name || !pwd) {
    ms.warning('账号或密码不能为空')
    return
  }

  try {
    const res = await register(name, pwd, cfm)
    ms.success(res.message as string)
    window.location.reload()
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
  }
}

function closeReg() {
  emit('closeReg')
}
</script>

<template>
  <NModal :show="regVisible" style="width: 90%; max-width: 640px">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div class="space-y-4">
        <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            注册
          </h2>
          <p class="text-base text-center text-slate-500 dark:text-slate-500">
            {{ $t('common.unauthorizedTips') }}
          </p>
          <Icon403 class="w-[200px] m-auto" />
        </header>
        <NInput v-model:value="username" type="text" placeholder="账号: 请使用邮箱或手机号" maxlength="32" />
        <NInput v-model:value="password" type="password" placeholder="密码" maxlength="32" />
        <NInput v-model:value="comfirm" type="password" placeholder="重复密码" maxlength="32" />
        <NButton
          block
          type="primary"
          :loading="loading"
          @click="reg"
        >
          {{ $t('common.confirm') }}
        </NButton>
        <NButton
          block
          type="default"
          :loading="loading"
          @click="closeReg"
        >
          {{ $t('common.turnback') }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>
