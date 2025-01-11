import { world } from "@minecraft/server"
import { packetIdCharset } from "./Transcoder";

/**
 * Encodes a number to bits as a Varint
 * @param {number} value Number to encode
 * @returns {Uint8Array} The binary representation of the varint
 */
export function encodeVarint(value) {
    const bytes = [];
    while (value > 127) {
        bytes.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    bytes.push(value & 0x7f);

    return Uint8Array.from(bytes);
}

/**
 * Decodes to the number from a dataview of an Uint8Array
 * @param {DataView<ArrayBuffer>} view Dataview of an Uint8Array
 * @param {number} index Index to start reading the bytes from
 * @returns {{decodedValue: number, index: number}} The varint decoded as a js native number
 * and an index indicating how many bytes the varint took up
 */
export function decodeVarint(view, index=0) {
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

    return {decodedValue: value, index: index};
}

/**
 * Sends a scriptevent message provided an id (namespaced) and msg
 * @param {string} id Id of the message. Has to have a namespace prefix and cant be minecraft:
 * @param {string} msg Data string of the message
 */
export function sendMsg(id, msg) {
    world.getDimension("minecraft:overworld").runCommand(`scriptevent "${id.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}" ${msg}`)
}

/**
 * Generates a random id
 */
export function randomId(length=12) {
    const len = packetIdCharset.length;
    let res = "";
    for (let i = 0; i < length; i++) {
        res += packetIdCharset.charAt(Math.floor(Math.random() * 256))
    }
    return res;
}