// 引入 ioredis 包
import * as dotenv from 'dotenv'
import { Redis } from 'ioredis'
import Redlock from 'redlock'

dotenv.config()
const redisConfig = {
  prot: 6379, // 端口号
  host: '127.0.0.1', // ip
}
// 创建实例 连接NoSQL服务器
const client = new Redis(redisConfig)
const clients = new Set<Redis>()
clients.add(client)
const redlock = new Redlock(clients)

// Promise async/await 封装
//   ->向redis中定时存储数据
async function set(key, value, expire) {
  // 存储
  await client.set(key, value, (err, data) => {
    // 为key 设定一个时长 单位为S
    client.expire(key, expire)
    if (err)
      globalThis.console.log(err)
    return data // 成功会返回ok
  })
}
// Promise async/await 封装
//  ->查询 rides 库中是否有该Key 用于判断Token是否过期
async function exists(key) {
  const result = await client.exists(key)
  //  判断该值是否为空 如果为空返回null
  if (result === 0) {
    globalThis.console.log(result)
    return null
  }
  globalThis.console.log(result)
  return result
}
// Promise async/await 封装
//  ->获取 rides 库中该 Key 的 value
async function get(key) {
  const result = await client.get(key)
  if (result === null)
    return null
  return result
}

// Promise async/await 封装
//  ->为 rides 库中的一个key 设定过期的时间 单位为秒(S)
async function timeSetRedis(key, time) {
  // 设定时间
  const result = await client.expire(key, time)
  if (result === 0)
    return null
  return result
}

async function setNx(key, value, expire) {
  // 存储
  return await client.setnx(key, value, (err, data) => {
    globalThis.console.log('data:', data)
    // 为key 设定一个时长 单位为S
    client.expire(key, expire)
    if (err)
      globalThis.console.log(err)
    return data // 成功会返回ok
  })
}

async function del(key) {
  await client.del(key, (err, data) => {
    if (err)
      globalThis.console.log(err)
    return data // 成功会返回ok
  })
}

const redix = {
  set,
  setNx,
  get,
  exists,
  del,
  redlock,
}

export { redix }
