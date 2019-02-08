const sigUtil = require('eth-sig-util')
const utils = sigUtil.TypedDataUtils
const ethUtil = require('ethereumjs-util')
const clone = require('clone-deep')
const cryptoRandomString = require('crypto-random-string');

class Crypto {

  constructor (key, domainTypes) {
    this.key = key
    this.privateKey = ethUtil.toBuffer(key.privateKey)
    this.domainTypes = domainTypes
  }

  async authenticate (message) {
    if (message.message.action) {
      return this.authenticateAction(message)
    } else {
      return this.authenticateCapability(message)
    }
  }

  async authenticateCapability (obj) {
    const bundle = clone(this.domainTypes.capability)
    const sig = obj.signature.signatureValue
    bundle.message = obj.message

    const opts = { data: bundle, sig }
    return sigUtil.recoverTypedSignature(opts)
  }

  async authenticateAction (obj) {
    const bundle = clone(this.domainTypes.action)
    const sig = obj.signature.signatureValue
    bundle.message = obj.message

    const opts = { data: bundle, sig }
    return sigUtil.recoverTypedSignature(opts)
  }

  async sign ( message ) {
    if (message.action) {
      return this.signAction(message)
    } else {
      return this.signCapability(message)
    }
  }

  async signCapability (message) {
    const bundle = clone(this.domainTypes.capability)
    bundle.message = message

    const sig = sigUtil.signTypedData(this.privateKey, { data: bundle })

    bundle.signature = {
      type: 'capnode-v1',
      proofPurpose: 'capabilityDelegation',
      created: Date.now(),
      creator: this.key.address,
      signatureValue: sig,
    }
    return bundle
  }

  async signAction (message) {
    const bundle = clone(this.domainTypes.action)
    message.id = cryptoRandomString(20)
    bundle.message = message

    const sig = sigUtil.signTypedData(this.privateKey, { data: bundle })

    bundle.signature = {
      type: 'capnode-v1',
      proofPurpose: 'capabilityDelegation',
      created: Date.now(),
      creator: this.key.address,
      signatureValue: sig,
    }
    return bundle
  }

  async random () {
    return cryptoRandomString()
  }

}

module.exports = Crypto

