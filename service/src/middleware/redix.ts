/**
* @Author kjprime
* @description redis4.0数据库模块
*/
const redis = require('redis')

const redis_config = {
  host: '127.0.0.1',
  port: '6379',
}

const url = `redis://${redis_config.host}:${redis_config.port}`

const redisClient = redis.createClient({ url })

redisClient.on('ready', () => {
  globalThis.console.log('redis is ready...')
})

redisClient.on('error', (err) => {
  globalThis.console.error(err)
})

async function fun(callback, key, value) {
  return new Promise(async (res, rej) => {
    await redisClient.connect() // 连接
    const ok = callback(key, value) // 成功ok
    await redisClient.quit() // 关闭
    res(ok)
  })
}

const redix = {
  async set(key, value, expire) {
    return fun(async () => {
      return await redisClient.set(key, value, expire)
    }, key, value)
  },
  async get(key) {
    return fun(async () => {
      return await redisClient.get(key)
    }, key)
  },
  async del(key) {
    return fun(async () => {
      return await redisClient.del(key)
    }, key)
  },
}

export { redix }
