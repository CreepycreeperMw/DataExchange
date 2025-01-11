# Q & A
This file aims to explain some principles and questions as simple and indepth as possible without using any shortnames that might be hard to understand

### (Deprecated) - What is that virtual Index?
Note: The need for this virtual index has been replaced by a more sophisticated/simpler and less confusing approach to the problem described here.

The index variable isnt live updated to point to the next free byte in the array buffer.

Why? Because using the allocateMoreSpace function (which ensures you're not trying to access elements that lay beyond the size of the arraybuffer) would offset your index before writing your bytes to the array.
This is to reduce duplicate code as you would one have to tell the allocate function what size you need
as well as at the end of each encoder you would have to add this number again to the index.

Thats why at the start of each datatype iteration the index is cloned which the individual encoders can make use of instead without risking this offset when allocating more space