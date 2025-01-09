// Charset consisting of all safe 1 byte chars and rest safe 2 byte chars for fast and reliable encoding
const charset = ' !"#$%&\'()*+,-./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁł'
let charMap = new Map()
for (let i = 0; i < charset.length; i++) {
    charMap.set(charset[i], i);
}
export class TextCoder {
    /**
     * Encodes text to a Uint8Array using the safe data transmittion charset
     * @param {string} text Text to encode
     * @param {number} [end=text.length] 
     */
    static encode(text, end = text.length) {
        const length = text.length
        const res = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
            res[i] = charMap.get(text[i])
        }
        return res;
    }
    unsafeEncode(text) {
        let bytes = [];
        for (let i = 0; i < text.length; i++) {
            let codePoint = text.charCodeAt(i);
    
            if (codePoint <= 0x7F) {
                // 1-byte character (ASCII)
                bytes.push(codePoint);
            } else if (codePoint <= 0x7FF) {
                // 2-byte character
                bytes.push(0xC0 | (codePoint >> 6));
                bytes.push(0x80 | (codePoint & 0x3F));
            } else if (codePoint <= 0xFFFF) {
                // 3-byte character
                bytes.push(0xE0 | (codePoint >> 12));
                bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
                bytes.push(0x80 | (codePoint & 0x3F));
            } else {
                // 4-byte character (surrogate pairs)
                codePoint -= 0x10000;
                let highSurrogate = (codePoint >> 10) + 0xD800;
                let lowSurrogate = (codePoint & 0x3FF) + 0xDC00;
                bytes.push(0xF0 | (highSurrogate >> 18));
                bytes.push(0x80 | ((highSurrogate >> 12) & 0x3F));
                bytes.push(0x80 | ((highSurrogate >> 6) & 0x3F));
                bytes.push(0x80 | (highSurrogate & 0x3F));
                bytes.push(0xF0 | (lowSurrogate >> 18));
                bytes.push(0x80 | ((lowSurrogate >> 12) & 0x3F));
                bytes.push(0x80 | ((lowSurrogate >> 6) & 0x3F));
                bytes.push(0x80 | (lowSurrogate & 0x3F));
            }
        }
        return new Uint8Array(bytes);
    }

    /**
     * Decodes an Uint8Array to text with transmittion safe charset
     * @param {Uint8Array} bytes 
     * @param {number} end 
     */
    static decode(bytes, end) {
        let res = "";
        // bytes.forEach(byte=>res+=charset.charAt(byte));

        const endD = end ?? bytes.length
        for (let i = 0; i < endD; i++) {
            res += charset.charAt(bytes[i])
        }
        return res;
    }
    unsafeDecode(bytes) {
        let text = '';
        let i = 0;
    
        while (i < bytes.length) {
            let byte1 = bytes[i++];
    
            if (byte1 <= 0x7F) {
                // 1-byte character (ASCII)
                text += String.fromCharCode(byte1);
            } else if (byte1 <= 0xDF) {
                // 2-byte character
                let byte2 = bytes[i++];
                text += String.fromCharCode(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
            } else if (byte1 <= 0xEF) {
                // 3-byte character
                let byte2 = bytes[i++];
                let byte3 = bytes[i++];
                text += String.fromCharCode(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
            } else if (byte1 <= 0xF7) {
                // 4-byte character (less common)
                let byte2 = bytes[i++];
                let byte3 = bytes[i++];
                let byte4 = bytes[i++];
                let codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
                // Surrogate pair conversion
                codePoint -= 0x10000;
                text += String.fromCharCode((codePoint >> 10) + 0xD800, (codePoint & 0x3FF) + 0xDC00);
            }
        }
    
        return text;
    }
}