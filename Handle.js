import { DataTypes } from "./DataTypes";
import { TextCoder } from "./TextEncoding"

const encoder = TextCoder // Named differently to avoid conflicts with native (or not) TextEncoder / TextDecoder interfaces
const decoder = TextCoder // but so that you could technically switch to them down the road

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
        /** @type {import("./DataTypes").DataTypeArray} */
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

        // Loop over the array or the object (this method works with both)
        Object.keys(this.datatypes).forEach(key=>{
            const dataType = this.datatypes[key]
            if(isNaN(dataType)) {
                if(!(dataType instanceof TypeHandle)) throw "Error: type is neither a native datatype nor registered!"

                let {decodedParameters, index: i} = dataType.decode(byteArray, index);
                output[key] = decodedParameters;
                index = i;
            } else switch(dataType) {
                case DataTypes.Char:
                    // Get 1 byte at index and decode it using Textdecoder to char value
                    output[key] = decoder.decode(new Uint8Array([byteArray[index]]));
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
                case DataTypes.VarInt:
                case DataTypes.SignedVarInt:
                    let value = 0;
                    let shift = 0;

                    while (true) {
                        let byte = view.getUint8(index);

                        // Extract the lower 7 bits and add them
                        value |= (byte & 0x7f) << shift;

                        // If highest bit = 0, then this is the end
                        if ((byte & 0x80) === 0) {
                            break;
                        }

                        shift += 7;
                        index++;
                    }

                    if(dataType===DataTypes.SignedVarInt) {
                        value = (value >>> 1) ^ -(value & 1);
                    }
                    output[key] = value
                    break;
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
                    const length = view.getUint16(index);
                    index+=2;
                    const end = index + length;

                    let stringByteArray = byteArray.subarray(index, end)
                    index = end
                    output[key] = decoder.decode(stringByteArray)
                    break;
                }
                
                case DataTypes.Array:
                case DataTypes.BigArray: {
                    const length = dataType === DataTypes.Array ? view.getUint8(index) : view.getUint16(index);

                    if(dataType === DataTypes.Array) index++;
                    else index+=2;
                    
                    const dataType = this.datatypes[key]
                    const array = []
                    for (let i = 0; i < length; i++) {
                        let {decodedParameters, index: i} = dataType.decode(byteArray, index);
                        array.push(decodedParameters);
                        index = i;
                    }
                
                    output[key] = array

                    break;
                }
                case DataTypes.ByteArray: {
                    const length = view.getUint16(index);
                    index += 2;

                    let arr = byteArray.subarray(index, index + length)
                    output[key] = arr
                    index += length;
                    break;
                }
                case DataTypes.Unsigned:
                default:
                    break;
            }
        })
        return { decodedParameters: output, index: index}
    }

    /**
     * 
     * @param {(boolean | number | string)[]} data 
     */
    encode(data) {
        let arr = new Uint8Array(16384)
        let view = new DataView(arr.buffer)
        let length = arr.byteLength;

        let i = 0;

        function allMoreIfNeeded(sizeRequired) {
            if((sizeRequired + index) <= length) return; 
            const biggerArray = new Uint8Array(arr.buffer, 0, length * 2);

            arr = biggerArray;
            view = new DataView(arr.buffer);
            length = arr.byteLength;

            // Increase the index
            i += sizeRequired;
        }
        
        let latestBoolI = 0; // This keeps track of the byte to store the bool in
        let boolAmount = 0;

        const types = Object.values(this.datatypes);

        data.forEach((arg, i) => {
            let index = i;
            const dataType = types[index];

            // Native datatypes internally referenced as a number form, so you can check if its a native type by using isNaN
            if(isNaN(dataType)) {

            } else switch (dataType) {
                case DataTypes.Char:
                    // TODO
                    encoder.encode()
                    break;
                case DataTypes.Int8:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(1);

                    view.setInt8(index, arg)
                    break;
                case DataTypes.Int16:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(2);

                    view.setInt16(index, arg)
                    break;
                case DataTypes.Int32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(4);

                    view.setInt32(index, arg)
                    break;
                case DataTypes.Float32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(4);

                    view.setFloat32(index, arg)
                    break;
                case DataTypes.Float64:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(8);

                    view.setFloat64(index, arg)
                    break;
                case DataTypes.UnsignedInt8:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(1);

                    view.setUint8(index, arg)
                    break;
                case DataTypes.UnsignedInt16:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(2);

                    view.setUint16(index, arg)
                    break;
                case DataTypes.UnsignedInt32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    allMoreIfNeeded(4);

                    view.setUint32(index, arg)
                    break;
                case DataTypes.SignedVarInt:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    arg = (arg << 1) ^ (arg >> 31);
                case DataTypes.VarInt:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected a number";
                    const bytes = [];
                    while (value > 127) {
                        bytes.push((value & 0x7F) | 0x80);
                        value >>>= 7;
                    }
                    bytes.push(value & 0x7F);

                    let uint8arr = Uint8Array.from(bytes);
                    
                    allMoreIfNeeded(uint8arr.byteLength);
                    arr.set(uint8arr, index);
                    break;
                case DataTypes.Boolean:
                case DataTypes.BooleanGroup:
                    if(typeof arg !== "boolean") throw "Unexpected argument at parameter ["+i+"]. Expected a boolean";

                    // If the previous bool byte still has more bits for bools use those otherwise allocate new byte
                    if(boolAmount % 8 === 0) {
                        latestBoolI = index;
                        allMoreIfNeeded(1);
                        bytes[latestBoolI] = 0;
                    }

                    // Set the bit equal to the bool of according byte
                    let byte = bytes[latestBoolI];
                    if(arg) byte = byte | (1 << boolAmount) // true
                    else byte = byte & ~(1 << boolAmount) // false

                    boolAmount++;
                    view.setUint8(index, byte);
                    break;
                case DataTypes.StringLiteral:

                    break;
                case DataTypes.Array:
                case DataTypes.BigArray:
                    if(!Array.isArray(arg)) throw "Unexpected argument at parameter ["+i+"]. Expected an array";
                    
                    const length = arg.length;
                    if(dataType === DataTypes.Array) {
                        if(length > 255) throw "Array provided is too large, please use a big array type if you need more space"
                        view.setUint8(index, length)
                    } else {
                        if(length > 65535) throw "(Big-) Array provided is too large. Please use multiple arrays if you manage to exceed the max size"
                        view.setUint16(index, length)
                    }

                    // TODO : ADD THE INDIVIDUAL ELEMENTS

                    break;
                case DataTypes.ByteArray:
                    // TODO : obv 

                    break;
                case DataTypes.Unsigned:
                    return; // just continue, this datatype should never actually occur as is as a type, so this is just a fallback
            }
        })
    }
}

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
        
    }

    /**
     * Adds an event listener for this Packet
     * @typedef {string | number | boolean | []} DecodedStruct
     * @param {(output: DecodedStruct)=>void} callback 
     */
    listen(callback) {
        if(listeners[this.id]) listeners[this.id] = [ callback ]
        else listeners[this.id].push(callback)
    }
}