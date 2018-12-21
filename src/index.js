const chalk = require('chalk')
const API = require('netlify')
const getConfigPath = require('./utils/get-config-path')
const readConfig = require('./utils/read-config')
const globalConfig = require('./global-config')
const State = require('./state')
const openBrowser = require('../utils/open-browser')
const projectRoot = require('./utils/project-root')
const { track, identify } = require('../utils/telemetry')
const merge = require('lodash.merge')

class BaseCommand {
  // ctx can be `this` of a oclif command instance
  constructor(ctx = {}, opts = {}) {
    this.clientId = opts.clientId

    const token = this.configToken

    // Get site config from netlify.toml
    const configPath = getConfigPath(projectRoot)
    // Get site id & build state
    const state = new State(projectRoot)

    this.api = new API(token)
    this.site = {
      rootPath: projectRoot,
      configPath,
      config: readConfig(configPath),
      cliState: state,
      get id() {
        return state.get('siteId')
      },
      set id(id) {
        state.set('siteId', id)
      }
    }
    this.global = {
      config: globalConfig
    }
  }

  get clientToken() {
    return this.netlify.api.accessToken
  }

  set clientToken(token) {
    this.netlify.api.accessToken = token
  }

  get configToken() {
    const userId = globalConfig.get('userId')
    return globalConfig.get(`users.${userId}.auth.token`)
  }

  async isLoggedIn() {
    try {
      await this.netlify.api.getCurrentUser()
      return true
    } catch (_) {
      return false
    }
  }

  async authenticate(authToken) {
    const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'
    const token = authToken || this.configToken
    const clientId = this.clientID
    if (token) {
      // Update the api client
      this.clientToken = token
      // Check if it works
      await this.netlify.api.getCurrentUser()
      return token
    }

    this.log(`Logging into your Netlify account...`)

    // Create ticket for auth
    const ticket = await this.netlify.api.createTicket({
      clientId
    })

    // Open browser for authentication
    const authLink = `${webUI}/authorize?response_type=ticket&ticket=${ticket.id}`
    this.log(`Opening ${authLink}`)
    await openBrowser(authLink)

    const accessToken = await this.netlify.api.getAccessToken(ticket)

    if (!accessToken) this.error('Could not retrieve access token')

    const user = await this.netlify.api.getCurrentUser()
    const userID = user.id
    const accounts = await this.netlify.api.listAccountsForUser()
    const account = accounts.find(account => account.type === 'PERSONAL')

    const userData = merge(this.netlify.globalConfig.get(`users.${userID}`), {
      id: userID,
      name: user.full_name,
      email: user.email,
      slug: account.slug,
      auth: {
        token: accessToken,
        github: {
          user: undefined,
          token: undefined
        }
      }
    })
    // Set current userId
    this.netlify.globalConfig.set('userId', userID)
    // Set user data
    this.netlify.globalConfig.set(`users.${userID}`, userData)

    const email = user.email
    await identify({
      name: user.full_name || account.name || account.billing_name,
      email: email
    }).then(() => {
      return track('user_login', {
        email: email
      })
    })
    // Log success
    this.log()
    this.log(`${chalk.greenBright('You are now logged into your Netlify account!')}`)
    this.log()
    this.log(`Run ${chalk.cyanBright('netlify status')} for account details`)
    this.log()
    this.log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
    this.log()
    return accessToken
  }
}

module.exports = BaseCommand
