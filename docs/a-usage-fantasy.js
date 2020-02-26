const root = await capnode.getIndex();

// Assume we have a two-of-three signature verifying func we like:
const verifyTwoOfThree = require('./two-of-three')

const verifyTwoOfThree = ${verifyTwoOfThree}
const twoOfThree = await root.eval(`
  return async (tx, proof) => {
    if (!verifyTwoOfThree(proof, tx)) {
      throw new Error('Authorization Error')
    } else {

      // The root eval has access to its own eval function:
      return eval(tx.data);
    }
  }
`)

// After this, only 2 of 3 messages will be valid!
await root.eval.revoke();

/**
 * We still have a fundamental benefit over a classical 2-of-3:
 * Transaction submission itself is a capability, so this network
 * has a fundamental web-of-trust DDoS resilience!
 */



