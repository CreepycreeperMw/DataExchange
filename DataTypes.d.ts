import { PacketHandle, TypeHandle } from "./Handle";

/**
 * This Enumeration represents all the default types that are implemented in the protocol
 */
export enum DataTypes {
    // Base Type: Byte / Char
    Char = 0, // XXXX-XXXX

    // Signed Numbers
    Int8 = 1,
    Int16 = 2,
    Int32 = 3,
    SignedVarInt = 4,
    
    // Unsigned Numbers
    Unsigned = 5,
    UnsignedInt8 = 6,
    UnsignedInt16 = 7,
    UnsignedInt32 = 8,
    VarInt = 9, // XXXX-XXXC

    Float32 = 10,
    Float64 = 11,

    // Miscellanious
    Boolean = 12, // X000-0000
    BooleanGroup = 12, // ABCD-EFGH  |  Each bit is a bool value. If there are multiple bool values the system will automatically make it to a bool group // EDIT: Gave both values the same num as their impl can be identical
    StringLiteral = 13, // XXXX-XXXX XXXX-XXXX ...CCCC CCCC  |  X = 16 bit length indicator int, C = Character byte

    // Lists
    ByteArray = 14, // XXXX-XXXX CCCC-CCCC[?]  |  X = 8 bit integer element length declaration, C = Raw Byte data
    Array = 15, // XXXX-XXXX C[?]  |  X = 8 bit integer element length declaration, C = Bits of the respective data type
    BigArray = 16, // XXXX-XXXX XXXX-XXXX C[?]  |  X = 16 bit integer element length declaration, C = Bits of the respective data type
}

type DataType = DataTypes | TypeHandle | PacketHandle;
type DataTypeArray = ((DataType | DataTypeArray)[]|{[name: string]: DataType | DataTypeArray});

/* export let builtInDataTypes = [
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
    'bigarray'
] */