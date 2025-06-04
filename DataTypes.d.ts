import { PacketHandle, TypeHandle } from "./Handle";

/**
 * This Enumeration represents all the default types that are implemented in the protocol
 */
export enum DataTypes {
    /** 
     * A one byte character.
     * Note : Only supports characters from the charset. If you need complex utf characters use strings.
     */
    Char = 0,
    /** 
     * An 8-bit signed Integer
     * Range -128 to 127
     */
    Int8 = 1,
    /** 
     * An 16-bit signed Integer
     * Range -32768 to 32767
     */
    Int16 = 2,
    /** 
     * An 32-bit signed Integer
     * Range -2,147,483,648 to 2,147,483,647
     */
    Int32 = 3,
    /** 
     * A signed varint
     * Supports negative value, dynamic range
     */
    SignedVarInt = 4,
    /** 
     * Unsigned modifier. Add this to any signed type to make it unsigned.
     */
    Unsigned = 5,
    /** 
     * An unsigned 8-bit Integer
     * Range 0 - 255
     */
    UnsignedInt8 = 6,
    /** 
     * An unsigned 16-bit Integer
     * Range 0 - 65535
     */
    UnsignedInt16 = 7,
    /** 
     * An unsigned 32-bit Integer
     * Range 0 - 4,294,967,295
     */
    UnsignedInt32 = 8,
    /** 
     * An (unsigned) varint
     * Dynamic range, does not support negative values
     */
    VarInt = 9,
    /** 
     * A 32-bit float
     * Supports decimal and negative numbers, has a wide range, lacks precision for really complex numbers
     */
    Float32 = 10,
    /** 
     * A 64-bit float
     * Supports decimal and negative numbers and has a wider range, even better precision than float32
     */
    Float64 = 11,
    /** 
     * A boolean
     */
    Boolean = 12,
    /** 
     * A boolgroup, merges multiple booleans into one bool, currently same functionality as boolean
     */
    BooleanGroup = 12,
    /** 
     * String, supports all Unicode Characters and has a dynamic length
     */
    StringLiteral = 13,
    /** 
     * Array of bytes, usually decoded as an unsigned 8-bit integer
     */
    ByteArray = 14,
    /** 
     * Array of any other type. Prepend this type by the type you want the array to have.
     */
    Array = 15
}

type DataType = DataTypes | TypeHandle | PacketHandle;
type DataTypeArray = ((DataType | DataTypeArray)[]|{[name: string]: DataType | DataTypeArray});

namespace DataTypes {
    /**
     * Decodes native datatypes, reads directly from the datastream
     * @param dataType Datatype of the value to decode
     * @param extraType Datatype of the next value to decode, useful for arrays because they require 2 types
     * @param index Index of the next unread byte
     * @param view Dataview to access the datastream
     * @param byteArray Bytearray to access the arraybuffer
     * @param latestBoolI The index of the last bool byte to keep track of where to put the bools
     * @param boolAmount The amount of bools stored in the latest bool byte so it can allocate a new one if needed
     * @returns the decoded value and the index of the next unread byte
     */
    export function decodeNative (dataType: DataTypes, extraType: DataTypes | TypeHandle, index: number, view: DataView, byteArray: Uint8Array, latestBoolI: number, boolAmount: number): { value: any; index: number; skipNextType: boolean, latestBoolI: number, boolAmount: number}
    /**
     * Encodes native datatypes, writes directly to the provided datastream at the index returned by the index callback
     * @param arg The argument to encode
     * @param dataType The datatype to encode the argument to
     * @param extraType The next type for types like Array, who require an datatype for their children
     * @param byteArray The byteArray
     * @param view A dataview of the byteArray
     * @param index Returns the index of the next byte to write and
     * takes in an argument (length) which steps the index the next time this function is invoked.
     * Also makes sure there is always enough space allocated
     * @param latestBoolI The index of the last bool byte to keep track of where to put the bools
     * @param boolAmount The amount of bools stored in the latest bool byte so it can allocate a new one if needed
     * @returns An object detailing wether the extra datatype was 'consumed', the index of the last allocated byte for a boolean and the amount of booleans currently stored in that byte
     */
    export function encodeNative(arg: (boolean | number | string)[], dataType: DataTypes, extraType: DataTypes | TypeHandle, byteArray: Uint8Array, view: DataView, index: (length: number) => number, latestBoolI: number, boolAmount: number): { skipNextType: boolean, booleanIndex: number, newBoolAmount: number }
    export function ArrayOf(elementType: DataType): DataType
}