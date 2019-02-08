# CapNode

Sharing capabillities as easy as passing around JS Promises.

Allows serializing objects that contain promise-returning functions into a crypto-hard JSON format whose chain of custody is verified during deserialization.

Aspires to make decentralized delegation of any computer function as easy as passing around JS Promises, as they were [originally intended](http://www.erights.org/talks/promises/).

## Status

Very early, just building up some fundamental functions for now, does not work as a whole system yet.

## Direction

I tell a bit of the story of how I got here [in this thread on OcapJs](https://ocapjs.org/t/hi-there-brief-introduction/64).

The general serialization format is basically ocap-ld but with ethereum's signTypedData signature methods, intended to make some of these capabilities redeemable on the ethereum blockchain.

I was thinking it would be cool to use some of the early semantics from [Mark Miller and Hal Finney](https://ocapjs.org/t/abstracting-crypto-into-builtin-ocap-abstractions/55).

This module could have a `seal` and `unseal` method (ocap equivalents of serialize and deserialize).

Transport of the messages could be handled externally, which takes this a small step away from its `dnode`-inspired roots, although I sure wouldn't mind exposing stream interfaces once the seal/unseal is working correctly.


## Todo

Currently just serializing/deserializing. Will need to traverse chains of capabilities, not to mention `unseal` actually is tied to some transport details: The capability should encode suggested redemption methods, like a server to hit, and so those redemption methods will need to be tested as well.

The [ocap-ld spec](https://w3c-ccg.github.io/ocap-ld/#actions) suggests the `action` field can be used to direct the consumer how to redeem the capability, and yet it also seems to suggest the `action` field is only populated on invocations, not on capabilities...

Add support for Arrays to `signTypedData`, so we can have chains of caveats.

Define a caveat schema (for now it's just text. I was thinking use some Jessie run in a Realms shim to run it as invocation sanitation code).

Eventually, we are going to need a parser for these written for the ethereum blockchain. It would be great to integrate it into the test suite here, to make sure we're even serializing the data here in an actually useful way.


