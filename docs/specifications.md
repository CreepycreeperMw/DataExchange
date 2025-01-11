# Specification Requirements
This file enlists set Norms and Values required by the protocol

## Encoding charsets
 To ensure error free string encoding and decoding the protocol requires you to use these charsets:
 - Head (.id): `!"#$%&\'()*+,./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_&#96;abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃń`
 - Body (.message): ` !"#$%&'()*+,-./0123456789;<=>?ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_&#96;abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃ`
 
 Both these charsets are
 - made up of the first 256 Safe to use (1 byte and 2 byte) unicode characters
 - excluding characters that arent supported in the id or message respectively
 This way the encoding and decoding of an Uint8Array
 (or any other type with an arraybuffer you may want to use)
 really performant as instant byte to char (& vice versa) matching is extremely fast
 and reliable.

 Note: The above text passage does not(!) escape characters like " or \, it is not a code snippet. <br>
 If you're looking to simply copy this charset into your own implementation take a look at [Transcoder/charset]()
