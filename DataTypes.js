import { Transcoder } from "./Transcoder"
import { TypeHandle } from "./Handle"
import { encodeVarint, decodeVarint } from "./utils"
const encoder = Transcoder
const decoder = Transcoder

/**
 * @enum {number}
 */
export const DataTypes = {
    /** 
     * A one byte character.
     * Note : Only supports characters from the charset. If you need complex utf characters use strings.
     * @readonly
     */
    Char: 0,
    /** 
     * An 8-bit signed Integer
     * Range -128 to 127
     * @readonly
     */
    Int8: 1,
    /** 
     * An 16-bit signed Integer
     * Range -32768 to 32767
     * @readonly
     */
    Int16: 2,
    /** 
     * An 32-bit signed Integer
     * Range -2,147,483,648 to 2,147,483,647
     * @readonly
     */
    Int32: 3,
    /** 
     * A signed varint
     * Supports negative value, dynamic range
     * @readonly
     */
    SignedVarInt: 4,
    /** 
     * Unsigned modifier. Add this to any signed type to make it unsigned.
     * @readonly
     */
    Unsigned: 5,
    /** 
     * An unsigned 8-bit Integer
     * Range 0 - 255
     * @readonly
     */
    UnsignedInt8: 6,
    /** 
     * An unsigned 16-bit Integer
     * Range 0 - 65535
     * @readonly
     */
    UnsignedInt16: 7,
    /** 
     * An unsigned 32-bit Integer
     * Range 0 - 4,294,967,295
     * @readonly
     */
    UnsignedInt32: 8,
    /** 
     * An (unsigned) varint
     * Dynamic range, does not support negative values
     * @readonly
     */
    VarInt: 9,
    /** 
     * A 32-bit float
     * Supports decimal and negative numbers, has a wide range, lacks precision for really complex numbers
     * @readonly
     */
    Float32: 10,
    /** 
     * A 64-bit float
     * Supports decimal and negative numbers and has a wider range, even better precision than float32
     * @readonly
     */
    Float64: 11,
    /** 
     * A boolean
     * @readonly
     */
    Boolean: 12,
    /** 
     * A boolgroup, merges multiple booleans into one bool, currently same functionality as boolean
     * @readonly
     */
    BooleanGroup: 12,
    /** 
     * String, supports all Unicode Characters and has a dynamic length
     * @readonly
     */
    StringLiteral: 13,
    /** 
     * Array of bytes, usually decoded as an unsigned 8-bit integer
     * @readonly
     */
    ByteArray: 14,
    /** 
     * Array of any other type. Prepend this type by the type you want the array to have.
     * @readonly
     */
    Array: class GenericArrayDataType {
        constructor(elementType) {
            this.elementType = elementType
        }

        toString() {
            return "15"
        }

        static number = 15
    },

    /**
     * Make an Array of any other type.
     * Accepts one argument to dictate the type of the Array's children.
     * @param {import("./DataTypes").DataType} elementType The type for the arrays elements
     * @returns {DataTypes.Array}
     */
    ArrayOf: function (elementType) {
        return new this.Array(elementType)
    },

    /**
     * Decodes native datatypes, reads directly from the datastream and returns the value
     * @param {DataTypes} dataType Datatype of the value to decode
     * @param {DataTypes} extraType Datatype of the next value to decode, useful for arrays because they require 2 types
     * @param {number} index Index of the next unread byte
     * @param {DataView} view Dataview to access the datastream
     * @param {Uint8Array} byteArray Bytearray to access the arraybuffer
     * @param {number} latestBoolI The index of the last bool byte to keep track of where to put the bools
     * @param {number} boolAmount The amount of bools stored in the latest bool byte so it can allocate a new one if needed
     * @returns {{value: any, index: number, skipNextType: boolean, latestBoolI: number, boolAmount: number}}} the decoded value and the index of the next unread byte
     */
    decodeNative: function (dataType, extraType, index, view, byteArray, latestBoolI, boolAmount) {
        let value;

        // Support for new DataTypes.ArrayOf() Syntax (converts to regular DataTypes.Array Syntax)
        let skipNextType = true;
        if(dataType instanceof this.Array) {
            extraType = dataType.elementType
            dataType = DataTypes.Array
            skipNextType = false
        }
        switch(dataType) {
            case DataTypes.Char:
                // Get 1 byte at index and decode it using Textdecoder to char value
                value = encoder.encode(new Uint8Array([byteArray[index]]));
                index++;
                break;
            case DataTypes.Int8:
                value = view.getInt8(index)
                index++;
                break;
            case DataTypes.Int16:
                value = view.getInt16(index)
                index+=2;
                break;
            case DataTypes.Int32:
                value = view.getInt32(index)
                index+=4;
                break;
            case DataTypes.Float32:
                value = view.getFloat32(index)
                index+=4;
                break;
            case DataTypes.Float64:
                value = view.getFloat64(index)
                index+=8;
                break;
            case DataTypes.UnsignedInt8:
                value = view.getUint8(index)
                index++;
                break;
            case DataTypes.UnsignedInt16:
                value = view.getUint16(index)
                index+=2;
                break;
            case DataTypes.UnsignedInt32:
                value = view.getUint32(index)
                index+=4;
                break;
            case DataTypes.VarInt: {
                let {decodedValue: value, index: i} = decodeVarint(view, index)
                value = value
                index = i;
                break;
            }
            case DataTypes.SignedVarInt: {
                let {decodedValue: value, index: i} = decodeVarint(view, index)
                value = (value >>> 1) ^ -(value & 1); // Use zigzag en/decoding to make it signed
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
    
                // Move to the next boolean byte in the data string
                if(boolAmount % 8 === 0) {
                    latestBoolI = index
                    index++;
                }
                
                const bool = (byteArray[latestBoolI] & (1 << (boolAmount))) !== 0
                value = bool
                boolAmount++;
                break;
            case DataTypes.StringLiteral: {
                // Get the length of the int 16
                const { decodedValue: length, index: i} = decodeVarint(view, index)
                index = i;
                const end = index + length;
    

                let stringByteArray = byteArray.subarray(index, end)
                index = end
                value = decoder.unicodeEncode(stringByteArray)
                break;
            }
            case DataTypes.Array: {
                // Calculate the length and step to the next free byte
                const {decodedValue: length, index: newIndex} = decodeVarint(view, index)
                index = newIndex;
                
                const array = []

                // Decoding of the arrays children
                if(!this.isNative(extraType)) {
                    if(!(extraType instanceof TypeHandle)) throw new Error("Error: Invalid Datatype received, type is neither a native datatype nor registered!")

                    // Custom datatype
                    for (let childI = 0; childI < length; childI++) {
                        const {decodedParameters, index: i} = extraType.decode(byteArray, index);
                        array.push(decodedParameters);
                        index = i;
                    }
                } else {
                    if(extraType === DataTypes.Array) throw new Error("Array of type array found. If you want to nest arrays you need to register another type that holds an array.")

                    // Native datatype
                    for (let childI = 0; childI < length; childI++) {
                        const result = this.decodeNative(extraType, null, index, view, byteArray)
                        array.push(result.value);
                        index = result.index;
                        // boolAmount = result.boolAmount;
                        // latestBoolI = result.latestBoolI
                    }
                }
    
                return {value: array, index, skipNextType: skipNextType, latestBoolI, boolAmount};
            }
            case DataTypes.ByteArray: {
                const {decodedValue: length, index: i} = decodeVarint(view, index)
                index = i;
    
                value = byteArray.subarray(index, index + length)
                index += length;
                break;
            }
            case DataTypes.Unsigned:
            default:
                break;
        }
        return {value, index, skipNextType: false, latestBoolI, boolAmount}
    },

    /**
     * Encodes native datatypes, writes directly to the provided datastream at the index returned by the index callback
     * @param {(boolean | number | string)[]} arg The argument to encode
     * @param {number} dataType The datatype to encode the argument to
     * @param {DataTypes | TypeHandle} extraType The next type for types like Array, who require an datatype for their children
     * @param {Uint8Array} byteArray The byteArray
     * @param {DataView} view A dataview of the byteArray
     * @param {(length: number)=>number} index Returns the index of the next byte to write and
     * takes in an argument (length) which steps the index the next time this function is invoked.
     * Also makes sure there is always enough space allocated
     * @param {number} latestBoolI The index of the last bool byte to keep track of where to put the bools
     * @param {number} boolAmount The amount of bools stored in the latest bool byte so it can allocate a new one if needed
     * @returns {{ skipNextType: boolean, booleanIndex: number, newBoolAmount: number }} An object detailing wether the extra datatype was 'consumed', the index of the last allocated byte for a boolean and the amount of booleans currently stored in that byte
     */
    encodeNative: function(arg, dataType, extraType, byteArray, view, index, latestBoolI, boolAmount) {
        if(dataType instanceof this.Array) {
            extraType = dataType.elementType
            dataType = DataTypes.Array
        }
        switch (dataType) {
            case DataTypes.Char:
                let value;
                if(typeof arg === "string") {
                    value = decoder.decode(arg[0])[0]
                } else if(!isNaN(arg)) {
                    if(value > 255 || value < 0) throw new Error("Range Error, number must be in range from 0-255")
                    value = arg;
                } else throw new Error("Unexpected argument, expected a (string) char from the charset or a number")
    
                view.setUint8(value)
                break;
            case DataTypes.Int8:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setInt8(index(1), arg)
                break;
            case DataTypes.Int16:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setInt16(index(2), arg)
                break;
            case DataTypes.Int32:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setInt32(index(4), arg)
                break;
            case DataTypes.Float32:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setFloat32(index(4), arg)
                break;
            case DataTypes.Float64:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setFloat64(index(8), arg)
                break;
            case DataTypes.UnsignedInt8:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setUint8(index(1), arg)
                break;
            case DataTypes.UnsignedInt16:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setUint16(index(2), arg)
                break;
            case DataTypes.UnsignedInt32:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
    
                view.setUint32(index(4), arg)
                break;
            case DataTypes.SignedVarInt:
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
                arg = (arg << 1) ^ (arg >> 31);
            case DataTypes.VarInt: {
                if(isNaN(arg)) throw new Error("Unexpected argument, expected a number");
                
                let uint8arr = encodeVarint(arg);
    
                byteArray.set(uint8arr, index(uint8arr.byteLength));
                break;
            }
            case DataTypes.Boolean:
            case DataTypes.BooleanGroup:
                if(typeof arg !== "boolean") throw new Error("Unexpected argument, expected a boolean");
    
                // If the previous bool byte still has more bits for bools use those otherwise allocate new byte
                if(boolAmount % 8 === 0) {
                    latestBoolI = index(1);
    
                    byteArray[latestBoolI] = 0;
                }
                
                // Set the bit equal to the bool of according byte
                let byte = byteArray[latestBoolI];
                if(arg) byte = byte | (1 << boolAmount) // true
                else byte = byte & ~(1 << boolAmount) // false
    
                boolAmount++;
                view.setUint8(latestBoolI, byte);
                break;
            case DataTypes.StringLiteral: {
                if(typeof arg !== "string") throw new Error("Unexpected argument, expected a string");
    
                // Decode the string to byte array
                let encodedString = Transcoder.unicodeDecode(arg)
                
                // Calculate length and add it as a var int
                const length = encodedString.byteLength;
                const encodedLengthNum = encodeVarint(length);
                
                byteArray.set(encodedLengthNum, index(encodedLengthNum.byteLength)) // Add the string length
                byteArray.set(encodedString, index(length)) // Add the string data
                break;
            }
            case DataTypes.Array: {
                if(!Array.isArray(arg)) throw new Error("Unexpected argument, expected an array");
                
                // Length
                const length = arg.length;
                const encodedLengthNum = encodeVarint(length);
    
                // Append the length varint and make sure there is space
                byteArray.set(encodedLengthNum, index(encodedLengthNum.byteLength))
    
                // Encode the arrays children
                if(!this.isNative(extraType)) { // custom datatype
                    if(!(extraType instanceof TypeHandle)) throw new Error("Error: Invalid Datatype received, type is neither a native datatype nor registered!")
    
                    for (let childI = 0; childI < length; childI++) {
                        let passedArg = arg[childI];
                        const {byteArray: encodedData, index: len} = extraType.encode(passedArg);
                        
                        // Allocate the size needed for this byte size and add the elements data to the bytearray
                        byteArray.set(encodedData, index(len))
                    }
                } else { // native datatype
                    if(extraType === this.Array) throw new Error("Array of type array found. If you want to nest arrays you need to register another type that holds an array.")
                    
                    for (let childI = 0; childI < length; childI++) {
                        // native datatypes directly write to the datastream so there is no need to get the byte array and concatenate them
                        const {booleanIndex, newBoolAmount} = this.encodeNative(arg[childI], extraType, null, byteArray, view, index, latestBoolI, boolAmount)
                        latestBoolI = booleanIndex;
                        boolAmount = newBoolAmount;
                    }
                }
    
                return {booleanIndex: latestBoolI, newBoolAmount: boolAmount, skipNextType: true}
            }
            case DataTypes.ByteArray: {
                if(!(arg instanceof Uint8Array)) throw new Error("Unexpected argument, expected an Uint8Array");
    
                // Length
                const length = arg.byteLength;
                const encodedLengthNum = encodeVarint(length);
    
                byteArray.set(encodedLengthNum, index(encodedLengthNum.byteLength))
                byteArray.set(arg, index(length))
                break;
            }
            case DataTypes.Unsigned:
            default:
                break; // just continue, this datatype should never actually occur as a type, so this is just a fallback
        }
        return {booleanIndex: latestBoolI, newBoolAmount: boolAmount, skipNextType: false}
    },

    /**
     * Returns true if the datatype provided is a native datatype
     * @param {DataTypes} dataType 
     * @returns {boolean}
     */
    isNative: function(dataType) {
        // return Object.values(this).includes(dataType) // cleaner
        return !isNaN(dataType) || dataType === this.Array
    }
}

/*  This is deprecated and was long replaced by the respective var in System.js */
export let builtInDataTypes = [
    'ch',
    'int8',
    'int16',
    'int32',
    'varint',
    '',
    'uint8',
    'uint16',
    'uint32',
    'uvarint',

    'float32',
    'float64',
    'bool',
    'string',
    'boolgroup',
    'array',
]