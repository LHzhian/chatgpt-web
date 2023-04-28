import express from 'express'
import axios from 'axios'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel, trylock, unlock } from './chatgpt'
import { auth, cutdown } from './middleware/auth'
import { redix } from './middleware/redis'
import { tokenError } from './utils/error'

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

function sleep(delay) {
  const start = (new Date()).getTime()
  while ((new Date()).getTime() - start < delay) {
    // 使用  continue 实现；
    continue
  }
}

router.post('/chat-process', [auth, cutdown], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  const { prompt, options = {} } = req.body as { prompt: string; options?: ChatContext }
  const authorization = req.header('Authorization').replace('Bearer ', '')
  const retryCount = 10 // 重试次数
  let tries = 0
  let lock = null
  const tryLock = async () => {
    try {
      // 上锁
      lock = await trylock(authorization)
      global.console.log('锁结果：', lock)
      if (lock === null || lock === undefined || lock !== 1)
        throw tokenError
      return true
    }
    catch (error) {
      globalThis.console.log('error:', error)
      tries++
      if (tries <= retryCount) {
        // 如果重试次数未达到上限，则延迟 1 秒后再次尝试
        setTimeout(tryLock, 1000)
      }
      else {
        res.write(JSON.stringify({ type: 'Fail', message: '当前通道繁忙，请稍后再试' }))
        res.end()
        return false
      }
    }
  }

  const lockres = await tryLock()
  globalThis.console.log('lockres:', lockres)
  if (!lockres)
    return

  const retry = async () => {
    try {
      let firstChunk = true
      await chatReplyProcess(prompt, options, (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      })
      res.end()
    }
    catch (error) {
      globalThis.console.log(`error:${error === tokenError}`, error)
      tries++
      if (tries <= retryCount) {
        // 如果重试次数未达到上限，则延迟 1 秒后再次尝试
        setTimeout(retry, 1000)
      }
      else {
        // 如果重试次数已经达到上限，则向客户端发送错误响应
        res.status(500).json({ error: `Failed after ${retryCount} retries` })
        res.end()
      }
    }
  }
  await retry()
  await unlock(authorization)
})

router.post('/config', async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    let hasAuth = false
    let username = ''
    if (token == null || !token) {
      hasAuth = false
      globalThis.console.log('data1:', { auth: hasAuth, model: currentModel() })
      res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel(), username } })
    }
    else {
      await redix.get(`TOKEN:${token}`).then((rr) => {
        if (!rr) {
          res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel(), username } })
        }
        else {
          hasAuth = rr != null && rr !== undefined && rr !== ''
          const reJson = JSON.parse(rr as string)
          username = reJson.username
          globalThis.console.log('data:', { auth: hasAuth, model: currentModel() })
          res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel(), username } })
        }
      })
    }
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token, account } = req.body as { token: string; account: string }
    if (!account || !token)
      throw new Error('账号或密码不能为空')

    // todo 登录
    const param = new URLSearchParams()
    param.append('username', account)
    param.append('password', token)
    axios.post(`${process.env.ADMIN_API_BASE_URL}/simlogin`, param)
      .then((resp) => {
        if (resp.data.code === 200 && resp.data.data !== '' && resp.data.data) {
          const val = { username: resp.data.data.username, roles: resp.data.data.roles }
          redix.set(`TOKEN:${resp.data.data.token}`, JSON.stringify(val), 86400)
          res.send({ status: 'Success', message: 'Success', data: { token: resp.data.data.token, username: resp.data.data.username } })
        }
        else {
          res.send({ status: 'Fail', message: resp.data.msg, data: '' })
        }
      })
      .catch((resp) => {
        globalThis.console.log('系统异常：', resp)
        res.send({ status: 'Fail', message: '系统异常，请联系技术人员', data: '' })
      })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { account, password, comfirm } = req.body as { account: string; password: string; comfirm: string }
    if (password !== comfirm)
      throw new Error('密码不一致')
    if (!account.trim() || !password.trim)
      throw new Error('账号或密码不能为空')

    // 注册
    const param = new URLSearchParams()
    param.append('username', account)
    param.append('password', password)
    axios.post(`${process.env.ADMIN_API_BASE_URL}/register`, param)
      .then((resp) => {
        if (resp.data.code === 200)
          res.send({ status: 'Success', message: 'Success', data: '' })
        else
          res.send({ status: 'Fail', message: resp.data.msg, data: '' })
      })
      .catch((resp) => {
        globalThis.console.log('系统异常：', resp)
        res.send({ status: 'Fail', message: '系统异常，请联系技术人员', data: '' })
      })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)

app.listen(3012, () => globalThis.console.log('Server is running on port 3012'))
