# MB-DEX
Minecraft Bedrock DEX _(short for Data Exchange)_ is both an API and Protocol
to efficiently **communicate data** between addons using Script API.

The API is built to be
- ⚡ **blazingly fast**
- ⚙️ **efficient**
- 🧠 **straight forward**
- 🔁 **backwards compatible**
- 🪽 **lightweight**

## Features & Key aspects
- Really fast encoding & decoding
- Only 3 Methods required to start sending packets (register/listen/send)
- Lightweight API (no bloatware & unnecessary features)
- Low level control so that you can build your own protocols on top of this
- Automatic Synchronisation with other Addons (no key or handshake protocol required)
- Wastes little to no bytes in transmittion
- Has a minimalistic approach to the specification \(= rules to follow in the implementation to make this protocol work with other implementations\)
- Has a dynamic API for native datatypes so that future versions can add, change and refactor datatypes without them breaking if addons use different API Versions
- Actively maintained and open for suggestions
- Does not waste to send any sort of structure in the payload (unlike json does e.g.)
- Future proof and reliable (All of the protocol and API is built in a way that it does not break and minimalized the programmers effort to keep protocol or api up to date)

> [!NOTE]
> Click here to [get started](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md#getting-started)

## Usage
### 1. Registering
```js
import { DataTypes } from "./DataExchange/DataTypes";
import { System } from "./DataExchange/System";

// A Custom DataType
const Person = await System.registerType('Person', {
    name: DataTypes.StringLiteral,
    age: DataTypes.UnsignedInt8,
    isMale: DataTypes.Boolean
})
// A Packet DataType
const FamilyFoundedPacket = await System.registerPacket('FamilyFounded', {
    dad: Person,
    mom: Person,
    members: DataTypes.ArrayOf(Person)
})
```
### 2. Sending
```js
let peter = { name: "Peter Wilson", age: 30, isMale: true }
let rosie = { name: "Rosie Wilson", age: 28, isMale: false }

FamilyFoundedPacket.send({
    name: "Wilsons",
    dad: peter,
    mom: rosie,
    members: [
        peter,
        rosie,
        { name: "Liam Wilson", age: 7, isMale: true }
    ]
})
```
### 3. Listening
```js
FamilyFoundedPacket.listen(output=>{
    let {name: familyname, dad, mom, members} = output

    console.log(`${mom.name} and ${dad.name} founded the ${familyName} Family together.
This family consists of the following people:`)
    members.forEach(member=>{
        console.log(` - ${member.name} (${member.age} years old)`)
    })
})
```
> [!TIP]
> If you wanna know the details on how to use the API, you can take a look at this in-depth [guide](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md#api)
## Protocol
Quick Links
- How to [implement the protocol](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md#Protocol)
- [Protocol Specification](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/specifications.md)