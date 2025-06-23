# Specification
This is an overview of all the strict rules / requirements your implementation needs to fullfill as specified by this protocol

Note: Head refers to the id in the scriptevent command, body to the message

## Registry
### 1. Loading
In the loading stage you need to send a request with the `register:loaded` header to report that you loaded

### 2. Packet/Type ID
32-bit integer encoded with the [head-charset](#2-charsets)

### 3. Registering
Head must be `registry:register` and body has to contain
 - the packet name
 - a joined string of the ids for the respective datatype

### 4. Packet request
Sending the packet requires the `packetId`, 
followed by the `requestId` and optionally followed by an `orderId`.
These are seperated by a dash (`-`) and they cannot include characters outside the `packetIdCharset`

- for **packetId** details see [above](#2-packettype-id)
- the **requestId** must be __unique__ and is used
    1. to know which packets have been send by the system themself
    2. to confirm that they have been send
    3. for large packet bodies to know what parts belong together because they get split into to multiple requests (see orderId)
in the implementation they are 12 characters long but it would also work with other lengths
- the **orderId** is only needed when the packet is split into multiple requests because it exceeds the size limit of the scriptevent message

the scriptevent message is wrapped in quotes (can be any one character) in order to prevent Minecraft from trimming spaces out of the body in the front or back
(Escaping spaces or using a different char in the charset would be more expensive in terms of byte size and speed)

## Encoding
### 1. Native Datatypes
 - `Integers`, `Varints` and `Floats` are encoded and decoded with the conventional patterns (big endian)
 - `Strings` have varint indicating their length and are decoded to bytes (and vice versa) using the Unicode format
 - `Bools` are stored in a regular uint8 (0-255) and use the [bool optimization](#3-bool-optimization) that dedicates each bool a bit in a byte and only dedicates a new one when that byte is filled up
 - `Arrays` have a varint indicating their length and the individual bytes allocated to it are depending on the type the array is holding
 - `ByteArrays` also have a varint indicating their length and the rest are just bytes (no brainer) (Uint8's)
 - A char is simply a byte thats encoded with the charset (so you could do `charset[charValue]` to encode it)

The resulting bytes from encoding/decoding these types are then converted to string form using the respective charset (see below)
### 2. Charsets
 The charsets are not used to encode/decode the string type (as you can see that is encoded with UTF), rather they are used to quickly encode/decode the byteArray to safe string (utf8 characters) to avoid any data being trimmed out when passing the string around in scriptevent
 - Head (.id): `!"#$%&\'()*+,./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_&#96;abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃń`
 - Body (.message): ` !"#$%&'()*+,-./0123456789;<=>?ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_&#96;abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃ`

 Details: These charsets are
 - made up of the first 256 Safe to use (1 byte and 2 byte) unicode characters
 - excluding characters that arent supported in the id or message respectively

 > [!IMPORTANT]
 > The above text passage with the chars is not a code snippet, and if you want to paste it to your code you first need to escape the characters properly.
 > If you're looking to simply copy this charset into your own implementation take a look at [Transcoder/charset](https://github.com/CreepycreeperMw/DataExchange/blob/main/Transcoder.js#L2)

### 3. Bool optimization
When you specify in your type enlistment that your type contains a bool,
that bool is dedicated 1 bit (1 = true, 0 = false).

However it does not
allocate a new byte each time. If there was another bool in the type, then
following the bool optimization, it grabs that byte and instead of placing
it at the right most bit it would place it at the 2nd bit or basicly the
next one that was not dedicated yet.

And if all 8 bits of one byte are already used up, meaning you have more
than 8 booleans in your type, then it allocates a new byte at the very end
to place bool bits in and starts all over with the right most bool.