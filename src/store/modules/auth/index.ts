import { defineStore } from 'pinia'
import { getToken, getUsername, removeToken, setToken, setUsername } from './helper'
import { store } from '@/store'
import { fetchSession } from '@/api'

interface SessionResponse {
  auth: boolean
  model: 'ChatGPTAPI' | 'ChatGPTUnofficialProxyAPI'
}

export interface AuthState {
  token: string | undefined
  session: SessionResponse | null
  username: string | undefined
}

export const useAuthStore = defineStore('auth-store', {
  state: (): AuthState => ({
    token: getToken(),
    session: null,
    username: getUsername(),
  }),

  getters: {
    isChatGPTAPI(state): boolean {
      return state.session?.model === 'ChatGPTAPI'
    },
  },

  actions: {
    async getSession(token: string) {
      try {
        const { data } = await fetchSession<SessionResponse>(token)
        this.session = { ...data }
        return Promise.resolve(data)
      }
      catch (error) {
        return Promise.reject(error)
      }
    },

    setToken(token: string) {
      this.token = token
      setToken(token)
    },

    removeToken() {
      this.token = undefined
      removeToken()
    },

    getToken() {
      return getToken()
    },

    getUsername() {
      return getUsername()
    },

    setUsername(username: string) {
      this.username = username
      setUsername(username)
    },
  },
})

export function useAuthStoreWithout() {
  return useAuthStore(store)
}
