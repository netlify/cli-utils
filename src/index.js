const { Command } = require('@oclif/command')
const chalk = require('chalk')
const API = require('netlify')
const getConfigPath = require('./utils/get-config-path')
const readConfig = require('./utils/read-config')
const globalConfig = require('./global-config')
const StateConfig = require('./state')
const openBrowser = require('./utils/open-browser')
const findRoot = require('./utils/find-root')
const { track, identify } = require('./utils/telemetry')
const merge = require('lodash.merge')
const argv = require('minimist')(process.argv.slice(2))
const { NETLIFY_AUTH_TOKEN } = process.env

// Netlify CLI client id. Lives in bot@netlify.com
// Todo setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

class BaseCommand extends Command {
  constructor(...args) {
    super(...args)
  }
  // Initialize context
  async init(err) {
    const projectRoot = findRoot(process.cwd())
    // Grab netlify API token
    const [ token ] = this.getConfigToken(argv.auth)
    // Get site config from netlify.toml
    const configPath = getConfigPath(projectRoot)
    // TODO: https://github.com/request/caseless to handle key casing issues
    const config = readConfig(configPath)

    // Get site id & build state
    const state = new StateConfig(projectRoot)

    this.netlify = {
      // api methods
      api: new API(token),
      // current site context
      site: {
        root: projectRoot,
        configPath: configPath,
        get id() {
          return state.get('siteId')
        },
        set id(id) {
          state.set('siteId', id)
        }
      },
      // Configuration from netlify.[toml/yml]
      config: config,
      // global cli config
      globalConfig: globalConfig,
      // state of current site dir
      state: state
    }
  }

  async isLoggedIn() {
    try {
      await this.netlify.api.getCurrentUser()
      return true
    } catch (_) {
      return false
    }
  }

  parse(opts, argv = this.argv) {
    /* enrich parse with global flags */
    const globalFlags = {}
    if (opts.flags && !opts.flags.silent) {
      globalFlags['silent'] = {
        parse: (b, _) => b,
        description: 'Silence CLI output',
        allowNo: false,
        type: 'boolean'
      }
    }
    if (opts.flags && !opts.flags.json) {
      globalFlags['json'] = {
        parse: (b, _) => b,
        description: 'Output return values as JSON',
        allowNo: false,
        type: 'boolean'
      }
    }
    if (opts.flags && !opts.flags.auth) {
      globalFlags['auth'] = {
        parse: (b, _) => b,
        description: 'Netlify auth token',
        input: [],
        multiple: false,
        type: 'option'
      }
    }

    // enrich with flags here
    opts.flags = Object.assign({}, opts.flags, globalFlags)

    return require('@oclif/parser').parse(argv, Object.assign({}, {
      context: this,
    }, opts))
  }

  /**
   * Get user netlify API token
   * @param  {string} - [tokenFromFlag] - value passed in by CLI flag
   * @return {[string, string]} - tokenValue & location of resolved Netlify API token
   */
  getConfigToken(tokenFromFlag) {
    // 1. First honor command flag --auth
    if (tokenFromFlag) {
      return [ tokenFromFlag, 'flag' ]
    }
    // 2. then Check ENV var
    if (NETLIFY_AUTH_TOKEN && NETLIFY_AUTH_TOKEN !== 'null') {
      return [ NETLIFY_AUTH_TOKEN, 'env' ]
    }
    // 3. If no env var use global user setting
    const userId = globalConfig.get('userId')
    const tokenFromConfig = globalConfig.get(`users.${userId}.auth.token`)
    if (tokenFromConfig) {
      return [ tokenFromConfig, 'config' ]
    }
    return [ null, 'not found']
  }

  async authenticate(tokenFromFlag) {
    const [ token ] = this.getConfigToken(tokenFromFlag)
    if (!token) {
      return this.expensivelyAuthenticate()
    } else {
      return token
    }
  }

  async expensivelyAuthenticate() {
    const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'
    this.log(`Logging into your Netlify account...`)

    // Create ticket for auth
    const ticket = await this.netlify.api.createTicket({
      clientId: CLIENT_ID
    })

    // Open browser for authentication
    const authLink = `${webUI}/authorize?response_type=ticket&ticket=${ticket.id}`

    this.log(`Opening ${authLink}`)
    await openBrowser(authLink)

    const accessToken = await this.netlify.api.getAccessToken(ticket)

    if (!accessToken) {
      this.error('Could not retrieve access token')
    }

    const user = await this.netlify.api.getCurrentUser()
    const userID = user.id

    const userData = merge(this.netlify.globalConfig.get(`users.${userID}`), {
      id: userID,
      name: user.full_name,
      email: user.email,
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
      name: user.full_name,
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