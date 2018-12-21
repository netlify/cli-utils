const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const uuidv4 = require('uuid/v4')

exports.getGlobalConfigstore = getGlobalConfigstore
function getGlobalConfigstore(defaults, opts) {
  defaults = Object.assign(
    {
      /* disable stats from being sent to Netlify */
      telemetryDisabled: false,
      /* cliId */
      cliId: uuidv4()
    },
    defaults
  )

  opts = Object.assign(
    {
      // TODO: check oclif path to see if config can be found there, otherwise use ~/.netlify
      configPath: path.join(os.homedir(), '.netlify', 'config.json')
    },
    opts
  )

  return new Configstore(null, defaults, opts)
}
