const fetch = require('cross-fetch')
const discoveryKey = require('./discoveryKey')

module.exports = {
  list,
  add,
  remove
}

async function list ({ url }) {
  const toFetch = new URL('./projects/', url).href

  return processRequest(fetch(toFetch), url)
}

async function add ({ url, projectKey }) {
  const toFetch = new URL('./projects/', url).href

  return processRequest(fetch(toFetch, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectKey
    })
  }), url)
}

async function remove ({ url, projectKey }) {
  const toFetch = new URL(`./projects/${discoveryKey(projectKey)}`, url).href

  return processRequest(fetch(toFetch, { method: 'DELETE' }), url)
}

async function processRequest (request, url) {
  const response = await request

  await checkOK(response, url)

  return response.json()
}

async function checkOK (response, url) {
  if (!response.ok) {
    if (response.status === 401) {
      const parsed = new URL(url)
      parsed.username = 'digidem'
      parsed.password = 'password'
      throw new Error(`Try to add a username and password to the url\ne.g. ${parsed.href}`)
    } else {
      const message = `Error in response: ${await response.text()}`
      throw new Error(message)
    }
  }
}
