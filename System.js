import { config } from "./config";
import { DataTypes } from "./DataTypes";
import { world, system } from "@minecraft/server"
import { PacketHandle, TypeHandle, listeners, sendPackets } from "./Handle";
import { Transcoder, packetIdCharset } from "./Transcoder"
import * as utils from "./utils"

const encoder = Transcoder // Named differently to en/decoder to avoid conflicts with native (or not) TextEncoder / TextDecoder interfaces
const decoder = Transcoder // but so that you could technically switch to them or another transcoder down the road

/* --- Loading ---
 Ensure that all addons are loaded and all listeners have been attached before sending any data */

/**
 * Queue for requests that resolves when all addons are loaded
 *  @type {(()=>void)[]}
 */
let loadingPromises = []
let loaded = false // Keeps track of when things are loaded

// Remember the last time a module has loaded
let lastModuleLoaded = system.currentTick
const id = system.afterEvents.scriptEventReceive.subscribe(event=>{
    if(event.id=="registry:loaded") return lastModuleLoaded = system.currentTick;
},{namespaces:["registry"]})

// Wait until no more modules are loaded and then resolve the queue
system.runInterval(()=>{
    let timeElapsedSinceModuleLoad = system.currentTick - lastModuleLoaded
    if(timeElapsedSinceModuleLoad > config.moduleLoadTimeout) {
        // Modules are considered loaded
        loaded = true;

        system.afterEvents.scriptEventReceive.unsubscribe(id)
        loadingPromises.forEach(resolve=>{
            resolve(true)
        })
    }
},1)

system.run(()=>utils.sendMsg("registry:loaded", "")) // Report that system has loaded
// (Loading End)

// --- Main System Components ---
/**
 * Stack that houses all the packet registration requests
 * [ IN PROGRESS ]
 * @type {Map<string, ((id: string)=>void)[]>}
 */
let registerQueue = new Map()

/**
 * Caches all packet registration requests in case a packet
 * is registered at a later time than most other addons did
 * Key: datastring     Value: packetId encoded as string
 * [ CACHE ]
 * @type {Map<string, string>}
 */
let registerCache = new Map()

/**
 * Registration Stack
 * This houses all the PacketIds/Handles of the Types that have
 * successfully been registered
 * [ DONE ]
 * @type {{[packetId: string]: TypeHandle|PacketHandle}}
 */
let registerStack = {}

/**
 * The id of the next packet to be registered
 */
let packetId = 0;

const MAX_PACKET_ID = 4294967296

// Registry
system.afterEvents.scriptEventReceive.subscribe(event=>{
    if(event.id=="registry:register") {
        if(registerQueue.has(event.message)) {
            if(packetId === MAX_PACKET_ID) throw new Error("Max packet count exceeded. "+MAX_PACKET_ID)

            let res = "";
            let arr = new Uint8Array(4)
            let view = new DataView(arr.buffer)
            view.setUint32(0, packetId)
            
            arr.forEach(byte=>{res+=packetIdCharset.charAt(byte)});
            
            // Give each type its respective id based on the order Minecraft gave the packets out
            registerQueue.get(event.message).forEach(callback=>callback(res))
            if(!registerCache.has(event.message)) registerCache.set(event.message, res)
            packetId++;
        }
    }
}, {namespaces:["registry"]})
export let builtInDataTypes;

const REGISTRATION_TIMEOUT_TICKS = 1000

export class System {
    /**
     * Registers a Type to the system and returns a
     * TypeHandle that can be referenced and used in
     * other types or packets
     * @param {string} name
     * @param {DataTypes[]|{[name: string]: DataTypes}} packetInfoTypes
     * @returns {Promise<TypeHandle>}
     */
    static registerType(name, packetInfoTypes) {
        return this.#registerBase(name, packetInfoTypes, TypeHandle)
    }

    /**
     * Registers a Type to the system and returns a
     * PacketHandle that holds methods used to send and
     * manage the packet
     * @param {string} name
     * @param {DataTypes[]|{[name: string]: DataTypes}} packetInfoTypes
     * @returns {Promise<PacketHandle>}
     */
    static registerPacket(name, packetInfoTypes) {
        return this.#registerBase(name, packetInfoTypes, PacketHandle)
    }

    /**
     * Shared internal logic to register a type or packet
     * @param {string} name
     * @param {DataTypes[]|{[name: string]: DataTypes}} packetInfoTypes
     * @param {typeof TypeHandle | typeof PacketHandle} handleClass
     * @returns {Promise<TypeHandle | PacketHandle>}
     * @returns 
     */
    static async #registerBase(name, packetInfoTypes, handleClass) {
        // Only register the packet when all Script API scripts are wake
        await this.untilLoaded();

        // Data body containing all the necessary information for the packet type
        const data = utils.getDataStructString(name, packetInfoTypes, builtInDataTypes)

        // Send the register request
        utils.sendMsg("registry:register", data)

        // Return a new promise that resolves once the packet type has got registered globally
        const typeId = await new Promise((res, rej)=>{
            if(registerCache.has(data)) return res(registerCache.get(data)) // if already registered return the id

            if(!registerQueue.has(data)) {
                registerQueue.set(data, [])
            }
            registerQueue.get(data).push(res)

            // When the type seems to not be registered, throw an error
            system.runTimeout(()=>{
                rej(new Error(`Packet registration for "${name}" timed out (after ${REGISTRATION_TIMEOUT_TICKS})`))
            }, REGISTRATION_TIMEOUT_TICKS)
        })

        // Create the Handle and return it
        const handle = new handleClass(name, typeId, packetInfoTypes)
        registerStack[typeId] = handle
        return handle;
    }


    /**
     * Gets any Type and returns it if its defined
     * @param {string} id Id of the type you want to get
     * @throws if the type is not registered
     */
    static getType(id) {
        let type = registerStack[id]
        if(!type) throw new Error("Error, this type is not loaded yet but you're referencing it")

        return type;
    }


    /**
     * Haults the process until the protcol listeners are globally loaded across all Packs
     * @returns {Promise<boolean>}
     */
    static async untilLoaded() {
        if(loaded) {
            return Promise.resolve(true)
        } else {
            return new Promise(res=>{
                // Add the request to the queue
                loadingPromises.push(res)
            })
        }
    }

    /**
     * Haults the process if the native datatypes are not fully registered yet
     * and returns the native datatypes
     * @returns {Promise<TypeHandle[]>}
     */
    static async getNativeTypes() {
        if(!builtInDataTypes) builtInDataTypes = [
            await System.registerType('ch', []),
            await System.registerType('int8', []),
            await System.registerType('int16', []),
            await System.registerType('int32', []),
            await System.registerType('svarint', []),
            '', // this is the unsigned enum member
            await System.registerType('uint8', []),
            await System.registerType('uint16', []),
            await System.registerType('uint32', []),
            await System.registerType('varint', []),
        
            await System.registerType('float32', []),
            await System.registerType('float64', []),
            await System.registerType('bool', []),
            await System.registerType('string', []),
            await System.registerType('boolgroup', []),
            await System.registerType('array', []),
            await System.registerType('bytearray', []),
        ];
        return builtInDataTypes;
    }
}

await System.getNativeTypes(); // Registers the native types and keeps any external module from using native types before they are registered

/** @type {{[requestId: string]: string[]}} */
let multiRequestPackets = {}
system.afterEvents.scriptEventReceive.subscribe(async (event)=>{
    const packetHeader = event.id.replace("packet:","")
    const [packetId, requestId, orderId] = packetHeader.split("-")
    
    if(sendPackets[requestId+(orderId??'')]) return sendPackets[requestId+(orderId??'')](true); // Check if the packet has been send by this addon (the callback is relevant in the future as I want to implement it resending the data incase it got dismissed for some reason, and running that callback tells the code that it got send)
    if(!listeners[packetId]) return; // return if there are no listeners registered for this packet

    let payload = '';

    // Check if payload is split into multiple payloads
    if(orderId && orderId != '') {
        let orderNumber = decoder.decodeId(orderId);
        
        // Add the payload to the stack
        const stack = multiRequestPackets[requestId];

        if(!stack) {
            // If there are no other fragments then init the stack and insert the first fragment
            multiRequestPackets[requestId] = []
            multiRequestPackets[requestId][orderNumber] = event.message.substring(1, event.message.length-1)
            return;
        }
        // Add the fragment
        stack[orderNumber] = event.message.substring(1, event.message.length-1)
        
        // Get the stack of all the payload pieces
        const len = stack.length

        // Check if all the payload pieces have been collected
        for (let i = 0; i < len; i++) if(!stack[i]) return; // Because the orderId is descending when we loop we first check the elements that are added last so we dont waste time on looping over huge stacks

        // Concatenate all the payload pieces
        for (let i = len - 1; i > 0; i--) {
            payload += stack[i];
        }

        // Delete the fragmentation collection
        delete multiRequestPackets[requestId]
    } else {
        payload = event.message.substring(1, event.message.length-1) // Get everything between the ""
    }

    let packetHandle = await System.getType(packetId);

    // Decode the data from the string to all their respective data types
    let uint8arr = decoder.decode(payload);
    let output = packetHandle.decode(uint8arr).decodedParameters;

    listeners[packetId].forEach(listener=>{
        listener(output)
    })
}, {namespaces: ["packet"]})

// This registers the native types through the same api so that they always get a unique id. Ensures that types dont break across versions
export default builtInDataTypes;