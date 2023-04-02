import { redix } from './redix'

const auth = async (req, res, next) => {
  try {
    const Authorization = req.header('Authorization')
    if (!Authorization)
      throw new Error('Error: 无访问权限 | No access rights')
    redix.get(`TOKEN:${Authorization.replace('Bearer ', '').trim()}`).then((r) => {
      if (!r)
        res.send({ status: 'Unauthorized', message: '请先登录' ?? 'Please authenticate.', data: null })
      else
        next()
    })
  }
  catch (error) {
    res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
  }
}

const cutdown = async (req, res, next) => {
  try {
    const Authorization = req.header('Authorization')
    if (!Authorization)
      throw new Error('Error: 无访问权限 | No access rights')
    const token = `${Authorization.replace('Bearer ', '').trim()}`
    const userInfo = await redix.get(`TOKEN:${token}`) as string
    const userInfoJson = JSON.parse(userInfo)
    const roles = userInfoJson.roles
    const cnt = await redix.get(`PERMISSION:${token}`) as string
    const count = cnt ? parseInt(cnt) : 0
    if (roles.includes('group1') && count > 5) { // 普通用户才限制次数
      res.send({ status: 'Fail', message: '今天免费次数已超额，请明天再使用，或者添加微信：by11338，成为会员后无次数限制', data: null })
    }
    else {
      const perCnt = count + 1
      const now = new Date().getTime()
      const smallHours = new Date(new Date(new Date().toLocaleDateString()).getTime() + 24 * 60 * 60 * 1000 - 1).getTime()
      const expireTime = Math.ceil((smallHours - now) / 1000)
      await redix.set(`PERMISSION:${token}`, `${perCnt}`, expireTime)
      next()
    }
  }
  catch (error) {
    res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
  }
}

export { auth, cutdown }
