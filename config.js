export const config = {
    /**
     * Ticks until all packs are considered loaded
     * It is considered that Minecraft haults tickupdates until its done loading
     */
    moduleLoadTimeout: 20,
    /**
     * Determines wether registry requests are stored temporarely
     * 
     * If true, then registry requests are automatically disregarded and deleted
     * after a set amount of time to not save unnecessary & unused information
     */
    tempRegistryEntries: true,
    /**
     * Time until unused registry requests are forgotten
     */
    registryEntryTimeout: 60000,
    /**
     * Default Amount of space allocated for encoding data arguments into the
     * byte array
     */
    defaultEncodingBufferSize: 16384,
}