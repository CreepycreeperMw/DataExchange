# Getting started
Hey now! If you're looking to get started with this API or Protocol you're at the right place to look!

If you're looking to get into how to use the API start [here](#api)! <br>
If you want to implement the protocol yourself you may start [here](#protocol)

## API
### 1. Installing the API
First you need to [download the Library](https://github.com/CreepycreeperMw/DataExchange/releases/latest) in order to embed it into your code. After you did that, just drop the main folder into your scripts folder and you're good to go.

Then you need to import the Library from the local path, in my case my script is sitting inside the `scripts` folder and the System is sitting in `scripts/DataExchange` folder in which you'll find the `System.js` and `DataTypes.js` modules.
```js
import { DataTypes } from "./DataExchange/DataTypes";
import { System } from "./DataExchange/System";
```
---

### 2. Registering a Packet
Now before doing anything with your Packets you first need to register them to the System, so that the API knows how to serialize your Datatype and so that other Addons can sync up their types with yours.

<!-- To do this you need to use the System.registerType and System.registerPacket respectively. -->
To do this you need to use the [System.registerPacket()](https://github.com/CreepycreeperMw/DataExchange/blob/main/System.d.ts#L22) method, first give it a **name** and then an **array of datatypes** that you want to encode
```js
let MyCustomPacket = await System.registerPacket("SimpleTest", [DataTypes.StringLiteral])
```
In this example we register a type called "SimpleTest" and specify that it holds one string type.
The `registerPacket` method returns an `PacketHandle` which you can store in a variable (like MyCustomPacket), we'll need this later on.

---
### 3. Sending a Packet
To send a packet now, use the `.send()` method on the `PacketHandle` that the System.registerPacket method returned
```js
MyCustomPacket.send(["I just send my first packet!"])
```
This will send the 'SimpleTest' Packet with the string of "I just send my first packet!".

---
### 4. Listening for a Packet
Now to receive a Packet its a similar game, you need to call the `.listen` method on your `PacketHandle` and pass a callback which will be your event listener.
```js
MyCustomPacket.listen(output=>{
    let [text] = output
    console.log(`Received "${text}" from the ${MyCustomPacket.name} Packet!`)
})
```
---
### 5. Naming the properties
Now as you can see we previously used an array to define all the datatypes we need, but this can get a bit messy for complexer types as we dont really know what each datatype is for. <br>
You can also register a type by giving the register method an object instead of an array
```js
let MyCustomPacket = await System.registerPacket("SimpleTest", {
    text: DataTypes.StringLiteral
})
MyCustomPacket.send({text: "I just send my first packet with my datatypes being indexed by a key!"})
```
Under the hood this works the same as if you just gave it an array, but your output of the listener will come in the same format and keys that you specified in the register method. <br>
> Keep in mind that the order you add your keys in still dictates the order the Packet is serialized in tho,
the keys you give it only exist in the API. However if you provide the properties in a wrong order **in the send method** the System will still encode your properties in the right order, so no worries about that, only the registry has to be correct.

---
### 6. The Datatypes Enum
The `DataTypes` Enumeration holds all native datatypes in this API that you can use. <br>
It includes things like `Strings` (DataTypes.StringLiteral),
`Booleans` for true/false (DataTypes.Boolean),
Numbers like `Integer`, `Floats` and `Varint`, and Iterable types like
`Arrays`, `ByteArrays` and more. <br>

#### What do these different number types mean?
<details>
    <summary>Now for everyone that does not know the difference between these Number types I explain them down here (Click to expand)</summary>

An `Integer` is a number that has **no decimal point**, there are different types of integers such as the
 - **Unsigned 8 Bit Integer**. This integer takes up 1 byte (or 8 bits/1's and 0's) on your computer and therefore only ranges from 0 to 255, meaning you cant have any higher or lower numbers than that stored in this type.
 - An **Unsigned 32 Bit Integer** is like the previous but instead of 1 it takes up 4 bytes (or 32 bits) on your computer and has a higher number range from 0 to 4.294.967.296. This is plenty for almost any numbers you want to send. Now you might have noticed that these dont support negative numbers, thats because they are **Unsigned**.
 - An signed **8 Bit Integer** also takes up 8 bits but supports negative numbers. This essentially halfs the maximum number it can have, because they also have to cover the negative range now. For an 8bit int, this is from
 -128 to 127
 - So an signed **32 Bit Integer** respectively would range from -2,147,483,648 to 2,147,483,647.

There are also other integers who take up 16 bits. The main thing you need to worry about when choosing one of these integers is how much space it takes up, at best you may choose the smallest integer you can fit based on what the largest number is you need to support. Are you only sending a number thats very small and goes from 0-30? Use an U Int 8, need to send a number that may be negative and up to 30.000 big? Use an 16 bit (signed) integer.

However maybe you **dont know how big** the numbers you want to transmitt really are or maybe your numbers are mostly low and only sometimes need to have a bigger size. In that case you may want to use a `Varint`! <br>
A Varint is an unsigned integer with a variable size meaning that depending on how large your number is it scales its range automatically. <br>
This is done by wasting one bit each byte telling the decoder wether the number still needs 7 more bits in order to represent the number. "Wasting" this one bit like that is often a valuable compromise in a case like this.
Varints are usually unsigned however there is also a signed variant of this type called an signed varint.

If you want to send numbers **with decimal points** however then you may want to use a `float`.
These have a more complex encoding pattern so I wont go into too much detail here but they support *a wide number range*, *decimal point numbers like 10.258* and *negative numbers*. <br>
There are 2 types of floats, a 32-bit and a 64-bit float. The main difference between those floats is that the 64-bit float is more accurate as you loose accuracy beyond numbers that take up more than 7 digits with 32bit and 15-16 decimal digits for the 64bit float. The 64 bit float also supports an even higher number range.

If you're unsure about the differences with these number types you can also read the description each enum member has when using the DataTypes enum in the API!
</details>

---
### 7. Building complex types
Now you may want to build more complex packets than a Packet with just one string, and now that you're aware what each type does (look above) its time to start building some complexer types.
```js
// Types
const Person = await System.registerType('Person', {
    name: DataTypes.StringLiteral,
    age: DataTypes.UnsignedInt8,
    isMale: DataTypes.Boolean
})
const Crowd = await System.registerType('Crowd', [DataTypes.Array, Person])

// Packet Types
const Family = await System.registerPacket('Family', {
    dad: Person,
    mom: Person,
    members: Crowd
})
const FriendGroup = await System.registerPacket('FriendGroup', {
    friendList: Crowd
})
```
In this dummy code example we define a type and packet for a family and friendgroup and make use of building sub-types which we can reference and reuse within our other types. <br>
As you can see, to do this, you can just drop in the `TypeHandle` (that is returned by the registerType method) to tell the API that you want to reference this type in the one you're registering.

Sending this data structure is also just as easy as with the example above.
You dont need to use any intermediate methods to decode the pieces individually,
you can just send your data tree straight like that
```js
let dad = { name: "Peter Wilson", age: 30, isMale: true }
let mom = { name: "Rosie Wilson", age: 28, isMale: false }

Family.send({
    name: "Wilson",
    dad: dad,
    mom: mom,
    members: [[
        dad,
        mom,
        { name: "Liam Wilson", age: 7, isMale: true }
    ]]
})

FriendGroup.send({
    name: "Minecraft Redstoners",
    friendList: [[
        { name: "Mumbo Jumbo", age: 29, isMale: true },
        { name: "Ilmango", age: 26, isMale: true },
        { name: "EthosLab", age: 38, isMale: true },
        { name: "SethBling", age: 37, isMale: true },
    ]]
})
```
Listening is essentially the same but in reverse so I wont demonstrate it here again :)

---
<br>

## Protocol
In this tutorial we will stick to the [specification](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/specifications) and step by step
fullfill everything that is needed to make this protocol work. Of course this will be more of a minimalistic implementation and doesnt feature any extra optimizations or API features.

> In order to follow along I recommend you should have a basic understandment of data structures. Incase you need a refresh there is also an explanation [here](#the-datatypes-enum)

To keep this a little bit organized, we'll keep all our code in 2 files
`index.js` and `utils.js` which we will use to drop in handy functions etc.

---
**1.** First up, lets start by creating a simple sendMsg() function in our utils file so we dont have to call the APIs to send a scriptevent everytime.

`util.js`
```js
await null;
let overworld = world.getDimension("overworld")

export function sendMsg(id, msg) {
    overworld.runCommand(`scriptevent "${id.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}" ${msg}`)   
}
```
For simplicity sake we used `await null;` to gain access to the "required privileges" of world.getDimension()
Then we defined a simple function that takes in an ID and a Message and properly escapes the quotes and backslashes in the ids, since because we are using runCommand, these would otherwise cause an error if we used them in the id.
You also need to put quotes around the id since the CommandArg parser of the id in the command may exit parsing early for certain special characters

---
**2.** Now lets continue by implementating the loading protocol.
The loading protocol requires you to send a "register:loaded" request and then wait until no more "register:loaded" requests are coming through. This is when all addon packs are considered loaded.

`index.js`
```js
let loaded; // The callback to call when all packs are loaded
let lastModuleLoaded = system.currentTick // Note the last time a loaded request was send
let temp = system.runInterval(()=>{
    if(system.currentTick - lastModuleLoaded > 60) {loaded()}
},1)
await new Promise(res=>loaded=res) // (a)wait here until all modules are loaded
system.clearRun(temp) // stop the loading loop as its no longer needed
```
Here we make use of a neat technique which we'll use more times throughout this tutorial: <br>
We make a top level variable and create a Promise and then put the resolve function of that promise in the top level variable, so we can use it in other methods and functions and resolve the method from anywhere in the code.

---
**3.** After that we need the core part of this protocol, the ***registry*** which automatically assigns the ids to the packet based on this protocol

First we'll create 3 variables: ___a register stack___ in which all the packets that have been registered are stored, of which the key is the name of the packet stored and the value is its id, then a ___queue___ for all packets that are currently waiting to get their id and the next ___packetId___ to be assigned
```js
/** @type {{[name: string]: string}} */
let registerStack = {}
/** @type {Map<string, (id: string)=>void>} */
let queue = new Map()
let packetId = 0;
```
then we'll make a listener for the scriptEventReceive and put our registration logic in it.
```js
system.afterEvents.scriptEventReceive.subscribe(event=>{
    if(event.id!="registry:register") return; // if its not a register request exit

    // encode the packetId number to string
    let id = (...) // Todo

    // Check if there is a callback for this packet in the queue
    if(queue.has(event.message)) {
        let callback = queue.get(event.message)
        if(typeof callback === "function") callback(id)
    }
    else queue.set(event.message, id) // Cache the packet id incase it is registered later
    packetId++;
}, {namespaces:["registry"]})
```
Now you might have noticed that I have left out the encoding of the id, because for that we'll first need a proper encoder!

---
**4.** To implement the encoder properly we first need to define our charsets in utils.js

`utils.js`
```js
export const charset = ' !"#$%&\'()*+,-./0123456789;<=>?ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃ'
export const packetIdCharset = '!"#$%&\'()*+,./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃń';
```
These charsets are made of the first 256 unicode characters that are safe to use in the scriptevent id or message respectively.
See why they're 256? Because that means we can map any of our `Bytes` that we want to decode directly to a char and vice versa, which is extremely fast and sufficiently efficient.

This 3 line implementation does just that.
```js
/**
 * Encodes a Uint8Array to text using the safe data transmittion charset
 * @param {Uint8Array} bytes Bytes to encode
 * @param {string} [characterSet=charset] Character set to use for encoding
 * @returns {string}
 */
export function encode(bytes, characterSet=charset) {
    let res = "";
    for (let i = 0; i < bytes.byteLength; i++) res += characterSet.charAt(bytes[i])
    return res;
}
```
Now back in index.js you can now convert the packetId to bytes and then to string properly

`index.js`
```js
    ...
    let bytes = new Uint8Array(4) // allocate 4 bytes/32 bits for the 32bit int
    let view = new DataView(arr.buffer) // create a Dataview to access the buffer
    view.setUint32(0, packetId) // convert the packetId to bytes
    let id = encode(bytes, packetIdCharset); // convert bytes to string
    ...
```
Though, because this includes the registration listener, we should actually put this code above our loading sequence so that when loading finishes we dont miss early requests coming through while we're still subscribing to scriptevent
> Incase you dont want to go through the middlestep of converting the id to bytes, I also wrote a small function that converts numbers like that straight to strings [here](https://github.com/CreepycreeperMw/DataExchange/blob/main/Transcoder.js#L39), but if you use this, make sure to add padding to the result string with `.paddingStart(8, packetIdCharset[0])` in order to fill in the bytes that are 0

---
**5.** Now we create a simple register function that generates the [datastring](https://github.com/CreepycreeperMw/DataExchange/blob/main/docs/qanda.md#whats-the-data-string) and sends it off and then returns the id of the packet. 
```js
async function register(name, types) {
    if(registerStack[name]) throw new Error("You already registeredt this "+name)
    let dataStr = name+" "+types.map(type=>registerStack[type]).join("-") // generate datastring
    if(queue.has(dataStr)) return queue.get(dataStr) // See if there already is a cached value

    return await new Promise(res=>{
        queue.set(dataStr, res) // Otherwise put the callback into the queue
        sendMsg("registry:register", dataStr) // and send off the request
    })
}
```
Like previously mentioned, this uses the same technique we used at the start, passing the res callback around so that other parts of the code can resolve the Promise.

> Good job! You've got the biggest part done :) Take a quick breath, a break or continue right away below

---
**6.** Now that we have all our registration logic done, we can implement the native types. By protocol, these types are also just normal types registered through the system so the code to get this working is pretty simple:
```js
// native datatypes
let natives = ['ch','int8','int16','int32','svarint','uint8','uint16','uint32','varint','float32','float64','bool','string','array']
for (const type in natives) register(type, []); // you provide no types because its a base type
```
We just create an array of native types and loop over it, because they're native they dont actually have an type array, so we can just pass an empty array for the types.
