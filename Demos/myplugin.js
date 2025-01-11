import { world, system } from "@minecraft/server"

import { DataTypes } from "../DataTypes";
import { System } from "../System";

  // Types
const PosType = await System.registerType('Pos', { x: DataTypes.Int32, y: DataTypes.Int32, z: DataTypes.Int32 });

  // Packets
const AreaCreatePacket = await System.registerPacket('AreaCreate', {
    id: DataTypes.StringLiteral,
    start: PosType,
    end: PosType
})
const AreaDeletePacket = await System.registerPacket('AreaDelete', {
    id: DataTypes.StringLiteral
})


const PlayerEnterAreaPacket = await System.registerPacket('PlayerEnterArea', {
    playerId: DataTypes.StringLiteral,
    areaId: DataTypes.StringLiteral
})
const PlayerLeaveAreaPacket = await System.registerPacket('PlayerLeaveArea', {
    playerId: DataTypes.StringLiteral,
    areaId: DataTypes.StringLiteral
})

// Dummy code
let player;

let area = {
    id: "spawn",
    start: {x: 20, y: -64, z: 0},
    end: {x: 220, y: 312, z: 100}
}

PlayerEnterAreaPacket.send(player.typeId, area.start, area.end)
PlayerEnterAreaPacket.listen((output)=>{
    let { id, start, end } = output;
    let player = world.getEntity(id)
    world.sendMessage(`Player ${player.nameTag} is between XYZ ${start.x} ${start.y} ${start.z} and XYZ ${end.x} ${end.y} ${end.z} `)
})