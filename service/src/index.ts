import express from 'express'
import axios from 'axios'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { redix } from './middleware/redix'

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

router.post('/chat-process', auth, async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = {} } = req.body as { prompt: string; options?: ChatContext }
    let firstChunk = true
    await chatReplyProcess(prompt, options, (chat: ChatMessage) => {
      res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
      firstChunk = false
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
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
      hasAuth = true
    }
    else {
      redix.get(`TOKEN:${token}`).then((res) => {
        hasAuth = !res != null && res as boolean
        username = res as string
      })
    }
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel(), username } })
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
          redix.set(`TOKEN:${resp.data.data.token}`, resp.data.data.username, 86400)
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

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
