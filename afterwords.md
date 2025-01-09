# Afterwords
If you've looked at the code base and you found it odd that instead of pushing <br>
or appending elements to the end of an array like `typeArray.push(typeId)` you find
```js
typeArray[key] = typeId
```
But this has a very good reason to be this way. This is actually so that objects can <br>
be registered the same way type arrays are without any tradeoffs, extra protocols or <br>
wonky spaghetti code. And besides, this is still very much readable.

-----
