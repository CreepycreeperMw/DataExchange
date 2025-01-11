import { config } from "./config";
import { DataTypes } from "./DataTypes";
import { Transcoder } from "./Transcoder"
import { decodeVarint, encodeVarint, randomId, sendMsg } from "./utils";
import { system } from "@minecraft/server"

const encoder = Transcoder // Named differently to avoid conflicts with native (or not) TextEncoder / TextDecoder interfaces
const decoder = Transcoder // but so that you could technically switch to them down the road

/** @type {{[packetId: string]: ((output: DecodedStruct)=>void)[]}} */ 
export const listeners = {}

export class TypeHandle {
    /**
     * A TypeHandle is an object that acts as an interface when you register your type to be send via communication protocol
     * @param {string} name 
     * @param {string} id 
     * @param {import("./DataTypes").DataTypeArray} datatypes 
     */
    constructor(name, id, datatypes) {
        datatypes.forEach((dataType,i)=>{ // Validation
            if(isNaN(dataType) && dataType instanceof TypeHandle) throw "Invalid Datatype recieved. Datatypes must either be a native from the datatypes enum or registered through the Type-/Packethandle API   Argument ["+i+"]"
        })

        this.name = name;
        this.id = id;
        /** @type {(PacketHandle | TypeHandle)[]} */
        this.datatypes = datatypes;
    }

    /**
     * Decodes an input bytearray using the Handle's Decoder interface and magically returns the type complex structure defined via the Types structure.
     * Try it!
     * @param {Uint8Array} byteArray The data payload
     * @param {number} [index=0] Rules which byte is to read next
     */
    decode(byteArray, index = 0) {
        const buffer = byteArray.buffer
        let view = new DataView(buffer)

        let output = Array.isArray(this.datatypes) ? [] : {}
        let booleanOcc = new Array(8);
        let skipDataType = false;

        // Loop over the array or the object (this method works with both)
        Object.keys(this.datatypes).forEach(key=>{
            if(skipDataType) return; skipDataType = true;

            const dataType = this.datatypes[key]
            if(isNaN(dataType)) {
                if(!(dataType instanceof TypeHandle)) throw "Error: type is neither a native datatype nor registered!"

                let {decodedParameters, index: i} = dataType.decode(byteArray, index);
                output[key] = decodedParameters;
                index = i;
            } else switch(dataType) {
                case DataTypes.Char:
                    // Get 1 byte at index and decode it using Textdecoder to char value
                    output[key] = encoder.encode(new Uint8Array([byteArray[index]]));
                    index++;
                    break;
                case DataTypes.Int8:
                    output[key] = view.getInt8(index)
                    index++;
                    break;
                case DataTypes.Int16:
                    output[key] = view.getInt16(index)
                    index+=2;
                    break;
                case DataTypes.Int32:
                    output[key] = view.getInt32(index)
                    index+=4;
                    break;
                case DataTypes.Float32:
                    output[key] = view.getFloat32(index)
                    index+=4;
                    break;
                case DataTypes.Float64:
                    output[key] = view.getFloat64(index)
                    index+=8;
                    break;
                case DataTypes.UnsignedInt8:
                    output[key] = view.getUint8(index)
                    index++;
                    break;
                case DataTypes.UnsignedInt16:
                    output[key] = view.getUint16(index)
                    index+=2;
                    break;
                case DataTypes.UnsignedInt32:
                    output[key] = view.getUint32(index)
                    index+=4;
                    break;
                case DataTypes.VarInt: {
                    let {decodedValue: value, index: i} = decodeVarint(view, index)
                    output[key] = value
                    index = i;
                    break;
                }
                case DataTypes.SignedVarInt: {
                    let {decodedValue: value, index: i} = decodeVarint(view, index)
                    output[key] = (value >>> 1) ^ -(value & 1); // Use zigzag en/decoding to make it signed
                    index = i;
                    break;
                }
                case DataTypes.Boolean:
                case DataTypes.BooleanGroup:
                    /*
                    Idea is to have each bool take up only 1 bit
                    A new byte is only created (or well as this is reading it assumed to be created at that point) when the previous byte housing bools is full
                    Otherwise the bits are stored just stored in the latest byte that has been dedicated

                    Implementation does just that, it saves all boolean locations basicly, up to 8 so thats one byte.
                    The list's first indexed is simultanously the position of the byte to save/get the bit for the boolean to/from
                    and while the list's length tells the code which bit in the byte to save to and when to create/move-to the next boolean byte
                    */
                    booleanOcc.push(index)

                    // Move to the next boolean byte in the data string
                    if(booleanOcc.length % 8 === 1) {
                        booleanOcc = [ index ];
                        index++;
                    }
                    
                    const bool = (byteArray[booleanOcc[0]] & (1 << (booleanOcc.length - 1))) !== 0
                    output[key] = bool
                    break;
                case DataTypes.StringLiteral: {
                    // Get the length of the int 16
                    const { decodedValue: length, index: i} = decodeVarint(view, index)
                    index = i;
                    const end = index + length;


                    
                    let stringByteArray = byteArray.subarray(index, end)
                    index = end
                    output[key] = decoder.unicodeEncode(stringByteArray)
                    break;
                }
                case DataTypes.Array: {
                    // Calculate the length and step to the next free byte
                    const {decodedValue: length, index: i} = decodeVarint(view, index)
                    index = i;
                    
                    const dataType = this.datatypes[key]
                    const array = []
                    for (let childI = 0; childI < length; childI++) {
                        let {decodedParameters, index: i} = dataType.decode(byteArray, index);
                        array.push(decodedParameters);
                        index = i;
                    }

                    output[key] = array
                    return;
                }
                case DataTypes.ByteArray: {
                    const {decodedValue: length, index: i} = decodeVarint(view, index)
                    index = i;

                    let arr = byteArray.subarray(index, index + length)
                    output[key] = arr
                    index += length;
                    break;
                }
                case DataTypes.Unsigned:
                default:
                    break;
            }
            skipDataType = false;
        })
        return { decodedParameters: output, index: index}
    }

    /**
     * 
     * @param {(boolean | number | string)[]} data 
     * @param {number} [bI=0] Buffer Index, can be used to skip certain elements in the provided data
     * @returns {{ byteArray: Uint8Array, index: number }}
     */
    encode(data, bI = 0) {
        let arr = new Uint8Array(config.defaultEncodingBufferSize)
        let view = new DataView(arr.buffer)
        let length = arr.byteLength;

        function allMoreIfNeeded(sizeRequired) { // Allocates more bytes if it runs out of them and increases the index
            // Increase the index
            let oldI = bI;
            bI += sizeRequired;

            // Exit if array doesnt need to be enlarged
            if((sizeRequired + bI) <= length) return oldI;
            // Increase array size
            const biggerArray = new Uint8Array(arr.buffer, 0, length * 2);

            arr = biggerArray;
            view = new DataView(arr.buffer);
            length = arr.byteLength;

            return oldI;
        }
        
        // Bools Logic
        let latestBoolI = 0; // This keeps track of the byte to store the bool in
        let boolAmount = 0;

        const types = this.datatypes;
        let skipDataType = false;
        
        // Loop through each element and encode it
        for (let key in types) {
            if(skipDataType) continue;
            skipDataType = true;

            const dataType = types[key]
            let arg = data[key]

            // Native datatypes internally referenced as a number form, so you can check if its a native type by using isNaN
            if(isNaN(dataType)) {
                if(!(dataType instanceof TypeHandle)) throw "Error: type is neither a native datatype nor registered!"

                let {byteArray, index: i} = dataType.encode(arg, bI)
                arr.set(byteArray, bI)
                bI = i;
            } else switch (dataType) {
                case DataTypes.Char:
                    let value;
                    if(typeof arg === "string") {
                        value = decoder.decode(arg[0])[0]
                    } else if(!isNaN(arg)) {
                        if(value > 255 || value < 0) throw "Range Error at parameter ["+key+"]. Number must be in range from 0-255"
                        value = arg;
                    } else throw "Unexpected argument at parameter ["+key+"]. Expected a (string) char from the charset or a number"

                    view.setUint8(value)
                    break;
                case DataTypes.Int8:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setInt8(allMoreIfNeeded(1), arg)
                    break;
                case DataTypes.Int16:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setInt16(allMoreIfNeeded(2), arg)
                    break;
                case DataTypes.Int32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setInt32(allMoreIfNeeded(4), arg)
                    break;
                case DataTypes.Float32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setFloat32(allMoreIfNeeded(4), arg)
                    break;
                case DataTypes.Float64:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setFloat64(allMoreIfNeeded(8), arg)
                    break;
                case DataTypes.UnsignedInt8:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setUint8(allMoreIfNeeded(1), arg)
                    break;
                case DataTypes.UnsignedInt16:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setUint16(allMoreIfNeeded(2), arg)
                    break;
                case DataTypes.UnsignedInt32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";

                    view.setUint32(allMoreIfNeeded(4), arg)
                    break;
                case DataTypes.SignedVarInt:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";
                    arg = (arg << 1) ^ (arg >> 31);
                case DataTypes.VarInt: {
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected a number";
                    
                    let uint8arr = encodeVarint(arg);

                    arr.set(uint8arr, allMoreIfNeeded(uint8arr.byteLength));
                    break;
                }
                case DataTypes.Boolean:
                case DataTypes.BooleanGroup:
                    if(typeof arg !== "boolean") throw "Unexpected argument at parameter ["+key+"]. Expected a boolean";

                    // If the previous bool byte still has more bits for bools use those otherwise allocate new byte
                    if(boolAmount % 8 === 0) {
                        latestBoolI = bI;
                        allMoreIfNeeded(1);
                        arr[latestBoolI] = 0;
                    }
                    
                    // Set the bit equal to the bool of according byte
                    let byte = arr[latestBoolI];
                    if(arg) byte = byte | (1 << boolAmount) // true
                    else byte = byte & ~(1 << boolAmount) // false

                    boolAmount++;
                    view.setUint8(latestBoolI, byte);
                    break;
                case DataTypes.StringLiteral: {
                    if(typeof arg !== "string") throw "Unexpected argument at parameter ["+key+"]. Expected a string";

                    // Decode the string to byte array
                    let encodedString = Transcoder.unicodeDecode(arg)
                    
                    // Calculate length and add it as a var int
                    const length = encodedString.byteLength;
                    const encodedLengthNum = encodeVarint(length);

                    arr.set(encodedLengthNum, allMoreIfNeeded(encodedLengthNum.byteLength)) // Add the string length
                    arr.set(encodedString, allMoreIfNeeded(length)) // Add the string data
                    break;
                }
                case DataTypes.Array: {
                    if(!Array.isArray(arg)) throw "Unexpected argument at parameter ["+key+"]. Expected an array";
                    
                    // Length
                    const length = arg.length;
                    const encodedLengthNum = encodeVarint(length);

                    // Append the length varint and make sure there is space
                    arr.set(encodedLengthNum, allMoreIfNeeded(encodedLengthNum.byteLength))

                    // Encode the arrays children
                    const dataType = this.datatypes[key]
                    for (let childI = 0; bI < length; childI++) {
                        const {byteArray: encodedData, index: nextI} = dataType.encode(arg, bI);
                        
                        // Allocate the size needed for this byte size and add the elements data to the bytearray
                        arr.set(encodedData, allMoreIfNeeded(nextI - bI))
                    }

                    continue;
                }
                case DataTypes.ByteArray: {
                    if(!(arg instanceof Uint8Array)) throw "Unexpected argument at parameter ["+key+"]. Expected an Uint8Array";

                    // Length
                    const length = arg.byteLength;
                    const encodedLengthNum = encodeVarint(length);

                    arr.set(encodedLengthNum, allMoreIfNeeded(encodedLengthNum.byteLength))
                    arr.set(arg, allMoreIfNeeded(length))
                    break;
                }
                case DataTypes.Unsigned:
                    break; // just continue, this datatype should never actually occur as is as a type, so this is just a fallback
            }

            skipDataType = false;
        }
        return { byteArray: arr, index: bI };
    }
}

/** Stores all the outgoing packet requests until its confirmed they have been send */
export const sendPackets = {};
export class PacketHandle extends TypeHandle {
    /**
     * The Packet Handle holds methods to send this packet type
     * add event listeners and acts as an easy way to identify and
     * reference this Packettype across code.
     * 
     * @param {string} name 
     * @param {string} id 
     * @param {import("./DataTypes").DataTypeArray} datatypes 
     */
    constructor(name, id, datatypes) {
        super(name, id, datatypes)
    }

    /**
     * Sends the packet
     * @param {(string|boolean|number)[]} data 
     */
    send(...data) {
        // Encode the data arguments to binary
        const {byteArray, index} = data.length > 1 ? this.encode(data) : this.encode(data[0])
        const payload = encoder.encode(byteArray, index) // Convert the binary byte array to strings

        const requestId = randomId(12);
        const length = payload.length;

        if(length > config.maxMessageSize) {
            // Send payload in portions
            let portionCountDec = length / config.maxMessageSize;
            let portionCount = Math.floor(portionCountDec)
            if(portionCount != portionCountDec) portionCount++; // This is for the rest result which isnt an entire portion
            if(portionCount > 255) throw "Packet length too long! You cannot send this much data at once."

            for (let i = 0; i < portionCount; i++) {
                /* The orderNumber is the reverse number of the order they were decoded in.
                 * This way the algorhytm knows which element is the last (0) without any additional information
                 * and the length of the array in which the requests are cached in */
                const orderNumber = portionCount - i;
                const orderId = encoder.encodeId(orderNumber);
                
                this.sendRequest(`packet:${this.id}-${requestId}-${orderId}`, `"${payload.substring(i*config.maxMessageSize, (i+1)*config.maxMessageSize)}"`, requestId + orderId)
            }

        } else this.sendRequest(`packet:${this.id}-${requestId}`, `"${payload}"`, requestId)
    }

    /**
     * Adds an event listener for this Packet
     * @typedef {string | number | boolean | []} DecodedStruct
     * @param {(output: DecodedStruct)=>void} callback 
     */
    listen(callback) {
        if(!listeners[this.id]) listeners[this.id] = [ callback ]
        else listeners[this.id].push(callback)
    }

    /**
     * Sends off the packet and ensures it got send.
     * @param {string} head The encoded data string of the head
     * @param {string} body The encoded data string of the body
     * @param {string} id Id of the request. In this implementation this id is the requestId + orderId
     */
    async sendRequest(head, body, id) {
        // Try to send the request as much times as configured before giving up
        let success = false
        for (let tries = 0; tries < config.maxSendTries; tries++) {
            // Send the request
            sendMsg(head, body)

            success = await new Promise((res)=>{
                sendPackets[id] = res // Wait for the system to confirm that the request has been send
                system.waitTicks(40).then(res) // Wait for Minecraft to "timeout" the request attempt. waitTicks() returns void which makes the success check false
            })
            // Check if the packet has been send
            if(success) break;
        }
        if(!success) throw "Fatal Error: Unable to send packet request <[ "+head+" ]>.\nBody: "+body
    }
}