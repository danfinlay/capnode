const sig = require('eth-sig-util')
const IPFS = require('ipfs')
const Graph = require('ipld-graph-builder')
const ipfs = new IPFS()
const graph = new Graph(ipfs.dag)

class Crypto {

  constructor (key) {
    this.key = key
  }

  async authenticate (message) {
    if (!message.invoker) {
      throw new Error('nope!')
    }
    // Fake a signature verification:
    return message.invoker
  }

  async sign (message) {
    const obj = await graph.set(message, 'signature', {
      type: 'stub',
      proofPurpose: 'capabilityDelegation',
      created: Date.now(),
      creator: this.key.address,
    }, false)
    console.log('obj', obj)
    const hash = await graph.flush(obj)
    console.log('hash', hash)

    const result = { obj }
    obj.signature = {
      type: 'stub',
      proofPurpose: 'capabilityDelegation',
      created: Date.now(),
      creator: this.key.address,
      signatureValue: 'NaN',
    }
    return result
  }

}

module.exports = Crypto

