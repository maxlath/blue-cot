{ expect } = require 'chai'
Cot = require '../src/cot.coffee'

describe 'Cot', ->
  it 'should include port in host header when port not default for protocol', ->
    c1 = new Cot
      port: 80
      hostname: 'foo'
    expect(c1.hostHeader).to.equal 'foo'
    c2 = new Cot
      port: 8080
      hostname: 'foo'
    expect(c2.hostHeader).to.equal 'foo:8080'
    c3 = new Cot
      port: 443
      hostname: 'foo'
      ssl: true
    expect(c3.hostHeader).to.equal 'foo'
    c4 = new Cot
      port: 8080
      hostname: 'foo'
      ssl: true
    expect(c4.hostHeader).to.equal 'foo:8080'
