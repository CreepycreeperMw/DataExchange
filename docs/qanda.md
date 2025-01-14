# Q & A
This file aims to explain some principles and questions as simple and indepth as possible without using any shortnames that might be hard to understand

## Why are Packet names not namespaced?
I can imagine not using namespaces can seem like quite a risky move but I think namespaces have many strings of problems or complications attached to them,
mainly because they do not describe the connection between addons but rather the addon itself that is trying to communicate to or from. <br>
I have an example situation below that describes this scenario more indepth: <br>
> User: A makes an Addon that can allow players andor creators to create certain Areas that have some type of flags which restrict pvp or building or gives an effect or whatever and has the Packets **CreateArea** **RemoveArea** builtin
> 
> Now User B: Made some sort of world edit addon or an editor extension and wants to add the ability to create to easily create area likes that with the selection tool available for their addon.
> 
> Now User: C has an addon called XzUtilities which includes an area manager algorythm built in, but if the packet would be prefixed with a namespace that would probably be something like `areamanagerplus` that would be kinda stupid because C would have to use A's namespace to make their addon compatible even when it doesnt even use A's addon and has nothing to do with it. C would rather use his namespace `xzutilities`
> 
and now there are 2 competing communication standarts who are imcompatible and leave other people to question wether they should implement both, the one they like more or none at all because of how messy the situation is. Some might even start and use another more general namespace as a try to resolve this but this only creates more division.
The problem is that in order to do something like this you need everyone to follow along, which with a quick glance at the current addon community is quite the problem already.
After all this is nothing that cant be resolved by human communication but this is an example of how namespacing the packets can create quite the complex problems down the road.
And at last you can still prepend your Packet names with whatever you want theres no one stopping you from doing that, but this leaves the choice up to you as oppose to building
another requirement that might cause more bad than good.

