import { config } from "./config";
import { DataTypes } from "./DataTypes";
import { world, system } from "@minecraft/server"
import { PacketHandle, TypeHandle, listeners } from "./Handle";
import { TextCoder } from "./Transcoder"
const encoder = TextCoder // Named differently to en/decoder to avoid conflicts with native (or not) TextEncoder / TextDecoder interfaces
const decoder = TextCoder // but so that you could technically switch to them or another transcoder down the road

/* - Loading Cycle -
 Ensure that all addons are loaded and all listeners have been attached before sending any data */

/**
 * Queue for requests that resolves when all addons are loaded
 *  @type {(()=>void)[]}
 */
let loadingPromises = []

// Remember the last time a module has loaded
let lastModuleLoaded = system.currentTick
const id = system.afterEvents.scriptEventReceive.subscribe(event=>{
    if(event.id=="registry:loaded") return lastModuleLoaded = system.currentTick;
},{namespaces:["registry"]})

// Wait until no more modules are loaded and then resolve the queue
system.runInterval(()=>{
    if(system.currentTick - lastModuleLoaded > config.moduleLoadTimeout) {
        // Modules are considered loaded
        system.afterEvents.scriptEventReceive.unsubscribe(id)
        loadingPromises.forEach(callback=>{
            callback(true)
        })
    }
},1)

System.sendMsg("registry:loaded", "") // Report that system has loaded
// (Loading End)

/**
 * Stack that houses all the packet registration requests
 * @type {Map<string, ((id: string)=>void)[]>}
 */
let registerQueue = new Map()
/** @type {{[packetId: string]: TypeHandle|PacketHandle}} */
let registerStack = {}
let packetId = 0;
const maxPacketId = 4294967296

// Charset specifically for the packet ids
const charset = '!"#$%&\'()*+,-./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃ';
// Registry
system.afterEvents.scriptEventReceive.subscribe(event=>{
    if(event.id=="registry:register") {
        if(registerQueue.has(event.message)) {
            if(packetId === maxPacketId) throw "I dont know how you did this, but you reached the maximum packet count of "+maxPacketId

            let res = "";
            let arr = new Uint8Array(4)
            let view = new DataView(arr.buffer)
            view.setUint32(0, packetId)
            
            arr.forEach(byte=>{res+=charset.charAt(byte)});
            
            // Give each type its respective id based on the order Minecraft gave the packets out
            registerQueue.get(event.message).forEach(callback=>callback(res))
            packetId++;
        }
    }
},{namespaces:["registry"]})

export class System {
    /**
     * Registers a Type to the system and returns an TypeHandle that can be
     * referenced and used in other types or packets
     * @param {string} name
     * @param {DataType[]|{[name: string]: DataType}} packetInfoTypes
     * @returns {Promise<TypeHandle>}
     */
    static async registerType(name, packetInfoTypes) {
        // Only register the types when all Script API scripts are wake
        await this.untilLoaded();

        // This code transfers the type into a string representing its structure, essential in the syncing process
        let typeArray = []

        let boolAmount = 0
        Object.keys(packetInfoTypes).forEach((key)=>{
            const dataType = packetInfoTypes[key]
            const typeId = typeof dataType === "number" ? builtInDataTypes[dataType].id : dataType.id
            if(typeId == '' || !typeId) return console.warn("[Illegal Type] reported for "+name+" at index "+key); // Illegal type, skip it
            
            if(dataType === DataTypes.Boolean) {
                // Check if the last bool wouldve been filled by now so that a new one would be needed
                if(boolAmount % 8 === 0) {
                    typeArray.push("bool")
                    boolAmount -= 8
                }
            }

            typeArray[key] = typeId // Add the type
        })

        // Data body containing all the necessary information for the packet type
        const data = name + ' ' + typeArray.join(";")

        // Send the register request
        this.sendMsg("registry:register", data)

        // Return a new promise that resolves once the packet type has got registered globally
        let typeId = await new Promise((res, rej)=>{
            if(registerQueue.has(data)) registerQueue.set(data, [res])
            else registerQueue.get(data).push(res)

            system.runTimeout(()=>{
                rej("Fatal error") // When the type seems to not be registered, throw an error after a certain amount of time
            }, 1000)
        })

        return new TypeHandle(name, typeId, packetInfoTypes)
    }
    /**
     * Registers a Type to the system and returns an PacketConstruct that holds methods that can be used to send the packet and manage it
     * @param {string} name
     * @param {DataTypes[]|{[name: string]: DataTypes}} packetInfoTypes
     * @returns {Promise<PacketHandle>}
     */
    static async registerPacket(name, packetInfoTypes) {
        // Only register the packet when all Script API scripts are wake
        await this.untilLoaded();

        // Data body containing all the necessary information for the packet type
        let data;
        if(!packetInfoTypes[0] || name === packetInfoTypes[0]) { // Check if its a native type without using the native type API. If its a native type it doesnt have any data body
            data = '';
        } else {
            data = name +' '+ getTypeString(packetInfoTypes)
        }

        // Send the register request
        this.sendMsg("registry:register", data)

        // Return a new promise that resolves once the packet type has got registered globally
        let typeId = await new Promise((res, rej)=>{
            if(registerQueue.has(data)) registerQueue.set(data, [res])
            else registerQueue.get(data).push(res)

            system.runTimeout(()=>{
                rej("Fatal error") // When the type seems to not be registered, throw an error after a certain amount of time
            }, 1000)
        })

        return new PacketHandle(name, typeId, packetInfoTypes)
    }

    /**
     * Gets any Type and returns it if its defined
     * @param {string} id Id of the type you want to get
     * @throws if the type is not registered
     */
    static getTypeSync(id) {
        let type = registerStack[id]
        if(!type) throw "Error, this type is not loaded yet but you're referencing it"

        return type;
    }
    /**
     * Gets any Type and reliably returns its Handle.
     * [Warning] If the definition of the Type is beyond this getType statement
     * and you await this, it will wait indefinetly because it waits until
     * the type is defined
     * @param {string} id The id of the Type
     * @returns {Promise<TypeHandle | PacketHandle>}
     */
    static async getType(id) {
        let type = registerStack[id]
        if(!type) {
            // Type is not loaded make a temporare request tree
            return await new Promise(res=>{
                registerStack[id] = [res]
            })
        } else if(Array.isArray(type)) {
            return await new Promise(res=>{
                registerStack[id].push(res)
            })
        } else {
            return Promise.resolve(type)
        }
    }

    /**
     * Haults the process until the protcol listeners are globally loaded across all Packs
     * @returns {Promise<boolean>}
     */
    static async untilLoaded() {
        if(placeholder) {
            return Promise.resolve(true)
        } else {
            return new Promise(res=>{
                // Add the request to the queue
                loadingPromises.push(res)
            })
        }
    }

    /**
     * Sends a scriptevent message provided an id (namespaced) and msg
     * @param {string} id Id of the message. Has to have a namespace prefix and cant be minecraft:
     * @param {string} msg Data string of the message
     */
    static sendMsg(id, msg) {
        world.getDimension("minecraft:overworld").runCommand(`scriptevent "${id.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}" ${msg}`)
    }
}

system.afterEvents.scriptEventReceive.subscribe(async (event)=>{
    const packetId = event.id.replace("packet:","") // optional: .substring
    let packetHandle = await System.getType(packetId)

    // Decode the data from the string to all their respective data types
    let uint8arr = encoder.encode(event.message)
    let output = packetHandle.decode(uint8arr);

    listeners[packetId].forEach(listener=>{
        listener(output)
    })
}, {namespaces: ["packet"]})

// This registers the native types through the same api so that they always get a unique id. Ensures that types dont break across versions
export let builtInDataTypes = [
    await System.registerType('ch',[]),
    await System.registerType('int8', []),
    await System.registerType('int16', []),
    await System.registerType('int32', []),
    await System.registerType('varint', []),
    '', // this is the unsigned enum member
    await System.registerType('uint8', []),
    await System.registerType('uint16', []),
    await System.registerType('uint32', []),
    await System.registerType('uvarint', []),

    await System.registerType('float32', []),
    await System.registerType('float64', []),
    await System.registerType('bool', []),
    await System.registerType('string', []),
    await System.registerType('boolgroup', []),
    await System.registerType('array', []),
    await System.registerType('bigarray', [])
]