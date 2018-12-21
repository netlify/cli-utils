const test = require('ava')
const CLIState = require('.')
const tempy = require('tempy')
const path = require('path')
const rimraf = require('rimraf')
const fs = require('fs')

test.beforeEach(t => {
  t.context.tmp = tempy.directory()
})

test.afterEach(t => {
  rimraf.sync(t.context.tmp)
})

test('Can initialize', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)
  t.truthy(state, 'initializes correctly')
})

test('set + get', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)
  state.set('foo', 'bar')
  t.pass('Set without throwing')

  t.is(state.get('foo'), 'bar', 'retrieves the value')

  state.set('fiz.bar.baz', 'biz')
  t.pass('Set dotprop style')

  t.is(state.get('fiz').bar.baz, 'biz', 'can get dotprop style')
})

test('All getter', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)

  const allObj = {
    biz: 'baz',
    foo: 'bar',
    bing: {
      bang: 'pow'
    }
  }

  state.all = allObj
  t.pass('set all')

  t.deepEqual(state.all, allObj, 'and we get it back')
})

test('Size Getter', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)

  const allObj = {
    biz: 'baz',
    foo: 'bar',
    bing: {
      bang: 'pow'
    }
  }

  state.all = allObj
  t.pass('we set our values')

  t.is(state.size, 3, 'correct size returned')
})

test('has', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)
  state.set('foo', 'bar')
  t.pass('Set without throwing')

  t.true(state.has('foo'), 'has returns an existing key as true')
  t.false(state.has('baz'), 'has returns a missing key as false')
})

test('delete', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)
  state.set('foo', 'bar')
  t.pass('Set without throwing')

  t.is(state.get('foo'), 'bar', 'value is set')
  state.delete('foo')

  t.is(state.get('foo'), undefined, 'value is deleted')

  state.delete('biz')
  t.pass('deleting a missing key is a noop')
})

test('clear', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp)

  const allObj = {
    biz: 'baz',
    foo: 'bar',
    bing: {
      bang: 'pow'
    }
  }

  state.all = allObj
  t.pass('set all')

  t.is(state.size, 3, 'correct size returned')

  state.clear()
  t.pass('we clear')

  t.is(state.size, 0, 'config is cleared')
})

test('file creation behavior', t => {
  const tmp = t.context.tmp
  const state = new CLIState(tmp, {
    statePath: path.join('.test', 'config.json')
  })

  t.is(state.path, path.join(tmp, '.test', 'config.json'), 'path is correctly set as a property')

  t.is(state.get('foo'), undefined, 'we look for a missing key')

  t.throws(() => fs.statSync(state.path), { code: 'ENOENT' }, 'file shouldnt be created on a get miss')

  state.set('foo', 'bar')

  t.notThrows(() => fs.statSync(state.path), 'file should exist after first set')
})
