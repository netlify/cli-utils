const test = require('ava')
const { getGlobalConfigstore } = require('.')
const tempy = require('tempy')
const path = require('path')

test('Testing basic exports', t => {
  const tmpDir = tempy.directory()
  const globalConfig = getGlobalConfigstore(null, { configPath: path.join(tmpDir, 'config.json') })
  t.pass('Able to create a global config file')

  t.is(globalConfig.get('telemetryDisabled'), false, 'defaults are set correctly')

  globalConfig.set('telemetryDisabled', true)
  t.is(globalConfig.get('telemetryDisabled'), true, 'can set values')
})
