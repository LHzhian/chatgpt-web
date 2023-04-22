class TokenError extends Error {
  constructor(msg: string) {
    super(msg)
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, TokenError.prototype)
  }
}

const tokenError = new TokenError('等待锁...')

export { tokenError }
