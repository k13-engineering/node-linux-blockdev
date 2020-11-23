# node-linux-blockdev
Linux Bockdevice library for Node.js

## API

### `blockdev.findAll(options)` => Promise(`Array(BlockDevice)`)
List all block devices
- `options.probe` probe devices for PARTUUID and PTUUID

### `blockdev.findByName(options)` => Promise(`BlockDevice`)
Find information about block device
- `options.deviceName` device name, e.g. loop0
- `options.probe` probe device for PARTUUID and PTUUID

### `blockdev.findByDevicePath(options)` => Promise(`BlockDevice`)
Find information about block device
- `options.devicePath` device path, e.g. /dev/loop0
- `options.probe` probe device for PARTUUID and PTUUID

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

#### `BlockDevice.PTUUID` => String
Partition table UUID, if probed and available

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

#### `Partition.PARTUUID` => String
Partition UUID, if probed and available


## Minimal example

```javascript
import blockdev from "linux-blockdev";

const blockDevices = await blockdev.findAll();
console.log("blockDevices =", JSON.stringify(blockDevices, null, 2));
```
