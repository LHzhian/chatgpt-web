import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fetch from 'node-fetch'
import axios from 'axios'
import { tokenError } from 'src/utils/error'
import { sendResponse } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import { redix } from '../middleware/redis'

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
  600: '[OpenAI] 通道忙碌，请稍后再试 | Channel is busy, please try again later',
}

dotenv.config()

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 30 * 1000

let apiModel: ApiModel

if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_ACCESS_TOKEN)
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let api: ChatGPTAPI | ChatGPTUnofficialProxyAPI

(async () => {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  if (process.env.OPENAI_API_KEY) {
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const model = isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

    const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model },
      debug: true,
    }

    if (isNotEmptyString(process.env.OPENAI_API_BASE_URL))
      options.apiBaseUrl = process.env.OPENAI_API_BASE_URL

    setupProxy(options)

    api = new ChatGPTAPI({ ...options })
    apiModel = 'ChatGPTAPI'
  }
  else {
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: process.env.OPENAI_ACCESS_TOKEN,
      debug: true,
    }

    if (isNotEmptyString(process.env.API_REVERSE_PROXY))
      options.apiReverseProxyUrl = process.env.API_REVERSE_PROXY

    setupProxy(options)

    api = new ChatGPTUnofficialProxyAPI({ ...options })
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
  // 初始化访问锁
  setupLocks()
})()

async function chatReplyProcess(
  message: string,
  lastContext?: { conversationId?: string; parentMessageId?: string },
  process?: (chat: ChatMessage) => void,
) {
  try {
    let options: SendMessageOptions = { timeoutMs }

    if (lastContext) {
      if (apiModel === 'ChatGPTAPI')
        options = { parentMessageId: lastContext.parentMessageId }
      else
        options = { ...lastContext }
    }

    const response = await api.sendMessage(message, {
      ...options,
      onProgress: (partialResponse) => {
        process?.(partialResponse)
      },
    })

    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    global.console.log(error === tokenError)
    global.console.log(error)
    if (error === tokenError)
      throw error
    const code = error.statusCode
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

async function fetchBalance() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  try {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    const response = await axios.get(`${API_BASE_URL}/dashboard/billing/credit_grants`, { headers })
    const balance = response.data.total_available ?? 0
    return Promise.resolve(balance.toFixed(3))
  }
  catch {
    return Promise.resolve('-')
  }
}

async function chatConfig() {
  const balance = await fetchBalance()
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
    ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
    : '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, socksProxy, httpsProxy, balance },
  })
}

function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  if (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (process.env.HTTPS_PROXY || process.env.ALL_PROXY) {
      const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
      if (httpsProxy) {
        const agent = new HttpsProxyAgent(httpsProxy)
        options.fetch = (url, options) => {
          return fetch(url, { agent, ...options })
        }
      }
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

function setupLocks() {
  const accessTokens: string[] = process.env.OPENAI_ACCESS_TOKENS.split(',')
  globalThis.console.log(accessTokens)
  for (let i = 0; i < accessTokens.length; i++)
    redix.set(accessTokens[i], '0', 100000000)
}

async function trylock(authorization: string) {
  let lock = null
  if (api instanceof ChatGPTUnofficialProxyAPI) {
    const val = await redix.get(`AT:${authorization}`) as string
    if (val) {
      // 如果是自己占用的，那就继续

      lock = await redix.setNx(`LOCK:${val}`, authorization, 10)
      // await wait(50000)
      globalThis.console.log('lock2:', lock)
      await redix.set(val, authorization, 100000000)
      await redix.set(`AT:${authorization}`, val, 3600)
      api.accessToken = val
      return lock
    }
    else {
      // 第一次访问, 轮询accessTokens，看哪个空闲
      const accessTokens: string[] = process.env.OPENAI_ACCESS_TOKENS.split(',')
      for (let i = 0; i < accessTokens.length; i++) {
        const at = await redix.get(accessTokens[i]) as string
        if (at) {
          // 当前accessToken已被占用
          continue
        }
        else {
          // 轮询到一个accessToken没被占用, ==> 上锁
          lock = await redix.setNx(`LOCK:${accessTokens[i]}`, authorization, 10)
          await redix.set(accessTokens[i], authorization, 100000000)
          await redix.set(`AT:${authorization}`, accessTokens[i], 3600)
          api.accessToken = accessTokens[i]
          return lock
        }
      }
      // 如果所有accessTokens都被占用，就随机等待一个
      const randomNumber = Math.floor(Math.random() * accessTokens.length)
      api.accessToken = accessTokens[randomNumber]
      lock = await redix.setNx(`LOCK:${accessTokens[randomNumber]}`, authorization, 10)
      await redix.set(accessTokens[randomNumber], authorization, 100000000)
      await redix.set(`AT:${authorization}`, api.accessToken, 3600)
      return lock
    }
  }
  return lock
}

async function unlock(authorization: string) {
  const at = await redix.get(`AT:${authorization}`)
  if (at)
    await redix.del(`LOCK:${at}`)
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel, trylock, unlock }
