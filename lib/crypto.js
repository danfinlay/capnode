const sigUtil = require('eth-sig-util')
const utils = sigUtil.TypedDataUtils
const ethUtil = require('ethereumjs-util')
const clone = require('clone-deep')
const cryptoRandomString = require('crypto-random-string');

const typedDataAction = require('./types/action')
const typedDataCapability = require('./types/capability')

class Crypto {

  constructor (key) {
    this.key = key
    this.privateKey = ethUtil.toBuffer(key.privateKey)
  }

  async authenticate (obj) {
    const bundle = clone(typedDataAction)
    const sig = obj.signature.signatureValue
    bundle.message = obj.message

    const opts = { data: obj.message, sig }
    return sigUtil.recoverTypedSignature({ data: bundle, sig })
  }

  async signCapability ({ message, domain }) {
    const bundle = clone(typedDataCapability)
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

  async signAction ({ message, domain }) {
    const bundle = clone(typedDataAction)
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

