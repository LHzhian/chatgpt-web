import { ss } from '@/utils/storage'

const LOCAL_NAME = 'SECRET_TOKEN'

const LOCAL_USERNAME = 'LOCAL_USERNAME'

export function getToken() {
  return ss.get(LOCAL_NAME)
}

export function setToken(token: string) {
  return ss.set(LOCAL_NAME, token)
}

export function removeToken() {
  return ss.remove(LOCAL_NAME)
}

export function getUsername() {
  return ss.get(LOCAL_USERNAME)
}

export function setUsername(username: string) {
  return ss.set(LOCAL_USERNAME, username)
}
