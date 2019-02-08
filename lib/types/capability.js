module.exports = {
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

  },
  primaryType: 'Capability',
  domain: {
    name: 'Capnode',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    id: 4567,
    invoker: '0x0', // The permissioned party.
    parentCapability: '0x0', // A pointer to a delegating capability.
    caveats: '', // Currently undefined, but wooowie is this open ended. Jessie validator?
  },
}

