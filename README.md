# CapNode

Sharing capabillities as easy as passing around JS Promises.

Allows serializing objects that contain promise-returning functions into a crypto-hard JSON format whose chain of custody is verified during deserialization.

Aspires to make decentralized delegation of any computer function as easy as passing around JS Promises, as they were [originally intended](http://www.erights.org/talks/promises/).

## Status

Very experimental, basically a long night of play.

Syntax is Agoric/Jessie-like, I know it isn't normal classes, but it's deliberate, to potentially make a Jessie port easier, which reduces the number of quirky easy-to-miss JS side-effects.

