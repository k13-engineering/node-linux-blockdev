# node-linux-blockdev
Linux Bockdevice library for Node.js

## API

### `blockdev.findAll()` => Promise(`Array(BlockDevice)`)

### `blockdev.findByName(options)` => Promise(`BlockDevice`)

### `blockdev.findByDevicePath(options)` => Promise(`BlockDevice`)

### `BlockDevice`

#### `BlockDevice.name` => String
Name of the block device, e.g. "loop0"

#### `BlockDevice.sizeInSectors` => Number
Size of block device in sectors (512-byte blocks)

#### `BlockDevice.sizeInBytes` => Number
Size of block device in bytes

#### `BlockDevice.deviceNode.major`
Major device number

#### `BlockDevice.deviceNode.minor`
Minor device number

#### `BlockDevice.open(params)` => Promise(`FileHandle`)

- `params.flags` open flags, can be either `"r"`, `"w"` or `"r+"`

#### `BlockDevice.partitions` => Array(`Partition`)

### `Partition`

A partition has all fields of a block device, but additionally following fields.

#### `Partition.startInSectors` => Number
Start offset of partition inside block device in sectors (512-byte blocks)

#### `Partition.startInBytes` => Number
Start offset of partition inside block device in bytes

#### `Partition.partition` => Number
Partition number

## Minimal example

```javascript
import blockdev from "linux-blockdev";

const blockDevices = await blockdev.findAll();
console.log("blockDevices =", JSON.stringify(blockDevices, null, 2));
```
