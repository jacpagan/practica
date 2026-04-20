const POST_LOGIN_REDIRECT_KEY = 'practica.post_login_redirect.v1'

export const currentLocationPath = () => {
  return (window.location && (window.location.pathname + (window.location.search || ''))) || '/'
}

export const rememberPostLoginRedirect = (path) => {
  window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path)
}

export const readPostLoginRedirect = () => {
  return window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || ''
}

export const clearPostLoginRedirect = () => {
  window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
}
