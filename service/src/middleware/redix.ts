/**
* @Author kjprime
* @description redis4.0数据库模块
*/
// import * as dotenv from 'dotenv'
// import { createClient } from 'redis'

// dotenv.config()
// const redis_config = {
//   host: process.env.REDIS_URL,
//   port: process.env.REDIS_PORT,
// }
// globalThis.console.log('redis:', process.env.ADMIN_API_BASE_URL)
// const url = `redis://${redis_config.host}:${redis_config.port}`

// const redisClient = createClient({ url })

// redisClient.on('ready', () => {
//   globalThis.console.log('redis is ready...')
// })

// redisClient.on('error', (err) => {
//   globalThis.console.error(err)
// })

// async function fun(callback, key, value, expire) {
//   return new Promise(async (resolve, reject) => {
//     if (!redisClient.isOpen) {
//       globalThis.console.log(redisClient.isOpen)
//       await redisClient.connect() // 连接
//       const ok = callback(key, value, expire) // 成功ok
//       resolve(ok)
//     }
//     if (redisClient.isOpen)
//       await redisClient.quit() // 关闭
//   })
// }

// const redix = {
//   async set(key, value, expire) {
//     return fun(async () => {
//       return await redisClient.setEx(key, expire, value)
//     }, key, value, expire)
//   },
//   async get(key) {
//     return fun(async () => {
//       return await redisClient.get(key)
//     }, key, 1, 1)
//   },
//   async del(key) {
//     return fun(async () => {
//       return await redisClient.del(key)
//     }, key, 1, 1)
//   },
//   async setNx(key, value, expire) {
//     return fun(async () => {
//       return await redisClient.setNX(key, value)
//     }, key, value, expire)
//   },
// }

// export { redix }
