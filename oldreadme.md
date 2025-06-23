# DEX
Minecraft Bedrock DataExchange is a new approach to pack communication aimed to be easy to use while being advanced in terms of efficiency and performance.



Now before I get into the details I want to differentiate between the *Protocol* and the *Implementation* that back this System.
The goal was to move as much load as possible onto the API instead of the protocol so that the protocol can stay rather simple,
while you can enjoy a feature rich, easy to use and fast system but also allowing you to *easily get started without the library* [writing your own approach](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md#Protocol).

###### (All of the requirements of the protocol are listed [here](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/specifications.md))

**If you're looking to [get started with the API](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md#api) or you want to [implement the protocol](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md#protocol) yourself, look [here](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/gettingstarted.md)**

The central question this system revolves around is **How can I make a system that makes it as *simple as possible* for other addon creators to create a compatible data interchange, while being incredibly *efficient* __and__ with *good performance?*** <br>
The following article aims to explain on how this system looks, some of the concepts it uses and how it works under the hood
<br>

### Demos

To register a Type with the API you simply call [System::registerType()](https://github.com/CreepycreeperMw/DataExchange/blob/main/System.d.ts#L12)
and provide a name with an array of types that make up your data structure<br>
To register a Packet its essentially the same deal [System::registerPacket()](https://github.com/CreepycreeperMw/DataExchange/blob/main/System.d.ts#L22)
```js
import { DataTypes } from "../DataTypes";
import { System } from "../System";

const TestPacket = await System.registerPacket('Person', [DataTypes.StringLiteral, DataTypes.UnsignedInt8, DataTypes.Boolean])
```
System.registerXXXX Method returns a Promise that resolves once the type has been registered and then returns TypeHandle/PacketHandle

To listen to a packet you can use the [PacketHandle::listen()](https://github.com/CreepycreeperMw/DataExchange/blob/main/Handle.js#L211) method 
```js
TestPacket.listen(output=>{
    let [name, age, isMale] = output;
    
    if(isMale) console.log(`${name} is a ${age} year old man`)
    else console.log(`${name} is a ${age} year old woman`)
})
```

Sending the packet is even simpler, you just need to call the [PacketHandle::send()](https://github.com/CreepycreeperMw/DataExchange/blob/main/Handle.js#L179) method and give an array in which you can just dump all your arguments right in
```js
TestPacket.send(["Peter", 34, true])
```
### Object Syntax
Now you might have noticed that it can be though to keep track of which datatype does what and is stored where. The previous syntax shown to you was the array syntax, but there is also an alternative to this in which you can use an Object to preassign names to the properties. <br>
This works exactly the same under the hood, because the keys are never actually transmitted, instead they kind of only exist virtually within the API. <br>
The order in which the elements are decoded are still based on the order in which you added them in the original register method. If you provide them in a different order when using the `send` method the system will still automatically decode everything in the correct order.
```js
const TestPacket = await System.registerPacket('Person', [DataTypes.StringLiteral, DataTypes.UnsignedInt8, DataTypes.Boolean])

TestPacket.listen(output=>{
    let {name, age, isMale} = output;

    if(isMale) console.log(`${name} is a ${age} year old man`)
    else console.log(`${name} is a ${age} year old woman`)
})
TestPacket.send({
    name: "Peter",
    isMale: true,
    age: 34,
})
```
### Embedding another TypeHandle within another Type
Of course only sending native datatypes like that can be quite limiting, but dont worry, you can reference other types (and packets) to create deeply nested datastructures
```js
const Person = await System.registerType('Person', {name: DataTypes.StringLiteral, age: DataTypes.UnsignedInt8, isMale: DataTypes.Boolean})

const Parents = await System.registerType('Parents', {mother: DataTypes.StringLiteral, father: DataTypes.StringLiteral})

const Family = await System.registerPacket('Family', {
    parents: Parents,

    members: DataTypes.Array,
    memberType: Person
})

Family.send({
    parents: {
        father: "Peter",
        mother: "Emma"
    },
    members: [
        {name: "Peter", age: 34, isMale: true},
        {name: "Emma", age: 29, isMale: false},
        {name: "Henry", age: 9, isMale: true},
        {name: "Mia", age: 7, isMale: false},
    ]
})
```
More code examples can be found deeper down!

> Curious on how it works?
> You can take a look at the [source code](https://github.com/CreepycreeperMw/DataExchange) and/or
> Read an indepth guide about the API and Protocol below

## Transmitting the data (API)
First up is the idea on how to send this data. I didnt like the idea of just sending strings or large stringified JSON trees.
Instead this system works with so called Packet- and TypeHandles that hold information of the Data structure you want to send.
Then you can simply use the `send` and `listen` Method on this Handle to send and listen for this type.
Behind the scenes the system does everything for you now and basicly converts any type of datastructure into an array of bytes
that is then converted to a string and send over with script api scriptevent.

But that doesnt quite magically make Addons compatible does it?
## Syncing types (Protocol)
Now the idea of having certain channels to communicate on and possibly have complex requirements to build a connection with another is cool but it didnt quite catch me yet, as the 2 (or more) Addons are already in a closed system in an trusted enviroment, and there is no need for fancy encryption or complex handshake magic going on.
In my opinion this really just makes it harder for addons to be compatible with another, because it leaves more room for people to have their own opinion, use their own channel, own namespace etc. and also makes it harder for people , which I'm trying to avoid

Instead each Packet type has its own id, but this id is not decided by the user as that would kind of leave us where we started <br>
The system dumps all of the registration requests right when the addons are loaded & because Minecraft now acts as this kind of server and middle man,
it always gives the registration requests in the order in which it received it which this system makes use of by incrementing a number for each packet request that comes through and assigning that number to each packet type.

### Registration body (`registry:register`)
The body of the register request contains the name of the type (or packet) to register and the ids of the respective datatypes that make up this type/packet.

Now in the Packet/Type registry it just waits for the next registry scriptevent that matches this description/body, so Packets who have the exact same name and structure are considered to be the same.
(For now they dont have a namespace, you can read of as to why down below in the faq)

## More Code examples (API)
Sending a packet with a mix of the object and array register syntax
```js
import { System } from "./DataExchange/System"
import { DataTypes } from "./DataExchange/DataTypes"
import { world } from "@minecraft/server"

  // Types
const PosType = await System.registerType('Pos', { x: DataTypes.Int32, y: DataTypes.Int32, z: DataTypes.Int32 });
const Flag = await System.registerType("AreaFlag", {flagId: DataTypes.StringLiteral, enabled: DataTypes.Boolean})

  // Packets
const CreateAreaPacket = await System.registerPacket('CreateArea', {
    id: DataTypes.StringLiteral,
    start: PosType,
    end: PosType
})
const DeleteAreaPacket = await System.registerPacket('DeleteCreate', { id: DataTypes.StringLiteral })
const SetAreaFlagPacket = await System.registerPacket("SetAreaFlag", [DataTypes.StringLiteral, DataTypes.Array, Flag])

// Create the spawn area
CreateAreaPacket.send({id: "spawn", start: {x: -100, y: -64, z: -100}, end: {x: 100, y: 312, z: 100}})
SetAreaFlagPacket.send(["spawn", [
    {flagId: "pvp", enabled: false}
]])
```
Listening to Packets
```js
// Status Updates
const PlayerEnterAreaPacket = await System.registerPacket('PlayerEnterArea', {
    playerId: DataTypes.StringLiteral,
    areaId: DataTypes.StringLiteral
})
const PlayerLeaveAreaPacket = await System.registerPacket('PlayerLeaveArea', {
    playerId: DataTypes.StringLiteral,
    areaId: DataTypes.StringLiteral
})
PlayerEnterAreaPacket.listen(output=>console.log(`${world.getEntity(output.playerId).nametag} entered area ${output.areaId}`))
PlayerLeaveAreaPacket.listen(output=>console.log(`${world.getEntity(output.playerId).nametag} left area ${output.areaId}`))
```

Here is an example of what it looks like if took a type (in this case the [Experiments Packet](https://mojang.github.io/bedrock-protocol-docs/html/Experiments.html)) from the Minecraft Network Protocol and used it in this format
```js
const Experiment = await System.registerType("Experiment", {
    toggleName: DataTypes.StringLiteral,
    enabled: DataTypes.Boolean,
    alwaysOnName: DataTypes.StringLiteral,
    alwaysOnEnabled: DataTypes.Boolean
})

const ExperimentsPacket = await System.registerPacket("EXP",{ list: DataTypes.Array, listType: Experiment, everToggled: DataTypes.Boolean })

ExperimentsPacket.send({
    list: [
        { toggleName: "Custom biomes", enabled: false, alwaysOnName: "Custom biomes cannot be deactivated", alwaysOnEnabled: false },
        { toggleName: "Upcoming Creator Features", enabled: false, alwaysOnName: "Just ... Testing", alwaysOnEnabled: false },
        { toggleName: "Beta APIs", enabled: true, alwaysOnName: "Studies say experimental before chatSend makes 20% of the player base cry regularly (src: trust me bro)", alwaysOnEnabled: false },
        { toggleName: "Creator Cameras: Focus Target", enabled: true, alwaysOnName: "Creator Cameras are just that important that you cant deactivate them", alwaysOnEnabled: true },
        { toggleName: "HCF", enabled: false, alwaysOnName: "Holiday Creator Features are just the best", alwaysOnEnabled: false }, // hehe
    ],
    everToggled: false
})
```

## More Protocol specifics
### Packet Request
For actually sending the packet you will need the `packetId`,
followed by the `requestId` and optionally followed by an `orderId` incase. These are seperated by a dash (`-`) and they cannot include characters outside the `packetIdCharset`
- the `requestId` must be __unique__ and is used
    1. to know which packets have been send by the system themself and to confirm that they have been send
    2. for large packet bodies to know what parts belong together because they get split into to multiple requests (see orderId)
in the implementation they are 12 characters long but it would also work with other lengths
- the protocol supports request splitting if the payload is too large for one Minecraft scriptevent message (max is 2048 chars). The `orderId` specifies which element it is in descending order, so that 0 is always the last element and we dont have to add an additional bool to know wether its the last element
The body which contains the payload is wrapped in quotes
Read more about the encoding of the body [here](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/specifications.md#encoding)

### Native datatype ids
Native datatypes are not hardcoded, they are run and registered through the same system as all other types, this ensures that even when there are more datatypes added to the protocol older versions will still be compatible with newer versions as long as they dont use the unsupported datatypes

You can find full list of the details of the protocol on the github page at [docs/specification.md](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/specifications.md) <br>
You may also check out the FAQ if you have any questions. I will keep adding questions and answers on there in future :D