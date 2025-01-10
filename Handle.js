import { config } from "./config";
import { DataTypes } from "./DataTypes";
import { TextCoder } from "./Transcoder"
import { decodeVarint, encodeVarint, sendMsg } from "./utils";

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
                    output[key] = decoder.unicodeDecode(stringByteArray)
                    break;
                }
                
                case DataTypes.Array: {
                    // Calculate the length and step to the next free byte
                    const {decodedValue: length, index: i} = decodeVarint(view, index)
                    index = i;
                    
                    const dataType = this.datatypes[key] // TODO : SKIP THE DATATYPE HERE AS WELL
                    const array = []
                    for (let childI = 0; childI < length; childI++) {
                        let {decodedParameters, index: i} = dataType.decode(byteArray, index);
                        array.push(decodedParameters);
                        index = i;
                    }
                
                    output[key] = array
                    break;
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
        })
        return { decodedParameters: output, index: index}
    }

    /**
     * 
     * @param {(boolean | number | string)[]} data 
     * @param {number} [bI=0] Buffer Index, can be used to skip certain elements in the provided data
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
        
        let latestBoolI = 0; // This keeps track of the byte to store the bool in
        let boolAmount = 0;

        const types = Object.values(this.datatypes);

        data.forEach((arg, argI) => {
            let index = bI; // TODO : Figure out this index problem
            const dataType = types[argI];

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
                        value = encoder.encode(arg[0])[0]
                    } else if(!isNaN(arg)) {
                        if(value > 255 || value < 0) throw "Range Error at parameter ["+bI+"]. Number must be in range from 0-255"
                        value = arg;
                    } else throw "Unexpected argument at parameter ["+bI+"]. Expected a (string) char from the charset or a number"

                    view.setUint8(value)
                    break;
                case DataTypes.Int8:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(1);

                    view.setInt8(index, arg)
                    break;
                case DataTypes.Int16:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(2);

                    view.setInt16(index, arg)
                    break;
                case DataTypes.Int32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(4);

                    view.setInt32(index, arg)
                    break;
                case DataTypes.Float32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(4);

                    view.setFloat32(index, arg)
                    break;
                case DataTypes.Float64:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(8);

                    view.setFloat64(index, arg)
                    break;
                case DataTypes.UnsignedInt8:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(1);

                    view.setUint8(index, arg)
                    break;
                case DataTypes.UnsignedInt16:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(2);

                    view.setUint16(index, arg)
                    break;
                case DataTypes.UnsignedInt32:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    allMoreIfNeeded(4);

                    view.setUint32(index, arg)
                    break;
                case DataTypes.SignedVarInt:
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    arg = (arg << 1) ^ (arg >> 31);
                case DataTypes.VarInt: {
                    if(isNaN(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected a number";
                    
                    let uint8arr = encodeVarint(arg);

                    allMoreIfNeeded(uint8arr.byteLength);
                    arr.set(uint8arr, index);
                    break;
                }
                case DataTypes.Boolean:
                case DataTypes.BooleanGroup:
                    if(typeof arg !== "boolean") throw "Unexpected argument at parameter ["+bI+"]. Expected a boolean";

                    // If the previous bool byte still has more bits for bools use those otherwise allocate new byte
                    if(boolAmount % 8 === 0) {
                        latestBoolI = index;
                        allMoreIfNeeded(1);
                        arr[latestBoolI] = 0;
                    }

                    // Set the bit equal to the bool of according byte
                    let byte = arr[latestBoolI];
                    if(arg) byte = byte | (1 << boolAmount) // true
                    else byte = byte & ~(1 << boolAmount) // false

                    boolAmount++;
                    view.setUint8(index, byte);
                    break;
                case DataTypes.StringLiteral: {
                    if(typeof arg !== "string") throw "Unexpected argument at parameter ["+bI+"]. Expected a string";

                    // Decode the string to byte array
                    let encodedString = TextCoder.unicodeEncode(arg)
                    
                    // Calculate length and add it as a var int
                    const length = encodedString.byteLength;
                    const encodedLengthNum = encodeVarint(length);

                    arr.set(encodedLengthNum, allMoreIfNeeded(encodedLengthNum.byteLength)) // Add the string length
                    arr.set(encodedString, allMoreIfNeeded(length)) // Add the string data
                    break;
                }
                case DataTypes.Array: {
                    if(!Array.isArray(arg)) throw "Unexpected argument at parameter ["+bI+"]. Expected an array";
                    
                    // Length
                    const length = arg.length;
                    const encodedLengthNum = encodeVarint(length);

                    // Append the length varint and make sure there is space
                    arr.set(encodedLengthNum, allMoreIfNeeded(encodedLengthNum.byteLength))

                    // Encode the arrays children
                    const dataType = this.datatypes[bI] // TODO : Change this when the index problem is solved
                    for (let childI = 0; bI < length; childI++) {
                        const {byteArray: encodedData, index: nextI} = dataType.encode(arg, bI);
                        
                        // Allocate the size needed for this byte size and add the elements data to the bytearray
                        arr.set(encodedData, allMoreIfNeeded(nextI - index))
                    }

                    // TODO : FIGURE OUT HOW TO SKIP PAST THE NEXT DATATYPE By 1 (as an array of a specific datatype takes up 1 js var but 2 datatypes )
                    break;
                }
                case DataTypes.ByteArray: {
                    if(!(arg instanceof Uint8Array)) throw "Unexpected argument at parameter ["+bI+"]. Expected an Uint8Array";

                    // Length
                    const length = arg.byteLength;
                    const encodedLengthNum = encodeVarint(length);

                    arr.set(encodedLengthNum, allMoreIfNeeded(encodedLengthNum.byteLength))
                    arr.set(arg, allMoreIfNeeded(length))
                    break;
                }
                case DataTypes.Unsigned:
                    return; // just continue, this datatype should never actually occur as is as a type, so this is just a fallback
            }
        })
        return { byteArray: arr, index: bI };
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
        // Encode the data arguments to binary
        const {byteArray, index} = data.length > 1 ? this.encode(data) : this.encode(data[0])
        const payload = decoder.decode(byteArray, index) // Convert the binary byte array to strings

        sendMsg(`packet:${this.id}`, payload)
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