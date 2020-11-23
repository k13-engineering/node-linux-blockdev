import fs from "fs";
import path from "path";
import devnode from "linux-devnode";

const blockDevice = ({ pathInBlock }) => {
  const readValue = async (property) => {
    const value = await fs.promises.readFile(path.resolve("/sys/block", pathInBlock, property), "utf8");
    return value.trim();
  };

  const readIntegralValue = async (property) => {
    const value = await readValue(property);
    return parseInt(value, 10);
  };

  const findInfo = async () => {
    const sizeInSectors = await readIntegralValue("size");
    // const serial = await readValue("serial");
    const devMajorMinor = await readValue("dev");
    const [strMajor, strMinor] = devMajorMinor.split(":");
    const major = parseInt(strMajor, 10);
    const minor = parseInt(strMinor, 10);

    const sizeInBytes = sizeInSectors * 512;

    const name = path.basename(pathInBlock);

    const deviceNode = {
      major,
      minor
    };

    const open = async ({ flags }) => {
      return devnode.open({
        "type": "block",
        major,
        minor,
        flags
      });
    };

    return {
      name,
      sizeInSectors,
      sizeInBytes,
      deviceNode,
      open
    };
  };

  const findPartitionInfo = async () => {
    const startInSectors = await readIntegralValue("start");
    const partition = await readIntegralValue("partition");

    const startInBytes = startInSectors * 512;

    return {
      startInSectors,
      startInBytes,
      partition
    };
  };

  return {
    findInfo,
    findPartitionInfo
  };
};

const findByName = async ({ deviceName }) => {
  const dev = blockDevice({ "pathInBlock": deviceName });

  const info = await dev.findInfo();

  const sysfsFiles = await fs.promises.readdir(path.resolve("/sys/block", deviceName));
  const partitionNames = sysfsFiles.filter((filename) => filename.startsWith(deviceName));

  const partitions = await Promise.all(partitionNames.map(async (partitionName) => {
    const part = blockDevice({
      "pathInBlock": `${deviceName}/${partitionName}`
    });

    return Object.assign({},
      await part.findInfo(),
      await part.findPartitionInfo()
    );
  }));

  return Object.assign({}, info, {
    partitions
  });
};

const findByDevicePath = async ({ devicePath }) => {
  const fullPath = path.resolve(devicePath);

  const expectedDevDir = path.dirname(fullPath);
  if (expectedDevDir !== "/dev") {
    throw new Error("currently only paths directly under /dev supported");
  }

  const deviceName = path.basename(fullPath);
  return await findByName({ deviceName });
};

const findAll = async () => {
  const deviceNames = await fs.promises.readdir("/sys/block");

  return await Promise.all(deviceNames.map((deviceName) => {
    return findByName({ deviceName });
  }));
};

export default {
  findByName,
  findByDevicePath,
  findAll
};
