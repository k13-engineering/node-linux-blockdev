import blockdev from "../lib/index.js";

const blockDevices = await blockdev.findAll();
console.log("blockDevices =", JSON.stringify(blockDevices, null, 2));
