const sigUtil = require('eth-sig-util')
const utils = sigUtil.TypedDataUtils
const ethUtil = require('ethereumjs-util')
const clone = require('clone-deep')

const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],

    // Essentially a crypto-hard delegatable function reference.
    Capability: [
      { name: 'id', type: 'uint256' },
      { name: 'invoker', type: 'address' }, // The address this is granted to.
      { name: 'parentCapability', type: 'uint256' },
      { name: 'caveats', type: 'string' }, // mvp is just string caveats
    ],

    // Essentially an individual call to a capability's function.
    Action: [
      { name: 'id', type: 'uint256' },
      { name: 'action', type: 'string' },
      { name: 'capability', type: 'Capability' },
      { name: 'arguments', type: 'string' }, // Ideally an array of arbitrary objects.
    ],
  },
  primaryType: 'Action',
  domain: {
    name: 'Capnode',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    id: 12345, // unique identifier
    action: 'Do Things', // Method name/description
    arguments: '[]', // JSON array for now? Can contain capabilities.
                     // Should name "JSON with capabilities". JSON-cap?
    capability: {
      id: 4567,
      invoker: '0x0', // The permissioned party.
      parentCapability: '0x0', // A pointer to a delegating capability.
      caveats: '', // Currently undefined, but wooowie is this open ended. Jessie validator?
    },
  },
}

class Crypto {

  constructor (key) {
    this.key = key
    this.privateKey = ethUtil.toBuffer(key.privateKey)
  }

  async authenticate (obj) {
    const bundle = clone(typedData)
    const sig = obj.signature.signatureValue
    bundle.message = obj.message

    const opts = { data: obj.message, sig }
    console.log('attempting to recover with', opts)
    return sigUtil.recoverTypedSignature({ data: bundle, sig })
  }

  async sign (message) {
    const bundle = clone(typedData)
    bundle.message = message

    console.log('initial bundle is', { data: bundle })
    console.log('==================')
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

}

module.exports = Crypto

