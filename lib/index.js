import fs from "fs";
import path from "path";
import devnode from "linux-devnode";
import probeDevice from "./probe.js";

const blockDevice = ({ pathInBlock }) => {
  const readValue = async (property) => {
    const value = await fs.promises.readFile(path.resolve("/sys/block", pathInBlock, property), "utf8");
    return value.trim();
  };

  const readIntegralValue = async (property) => {
    const value = await readValue(property);
    return parseInt(value, 10);
  };

  const readDeviceNode = async (property) => {
    const devMajorMinor = await readValue(property);
    const [strMajor, strMinor] = devMajorMinor.split(":");
    const major = parseInt(strMajor, 10);
    const minor = parseInt(strMinor, 10);

    return {
      major,
      minor
    };
  };

  const findInfo = async ({ "probe": shouldProbe = false } = {}) => {
    const sizeInSectors = await readIntegralValue("size");
    const sizeInBytes = sizeInSectors * 512;
    // const serial = await readValue("serial");
    const { major, minor } = await readDeviceNode("dev");

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

    let probeData = {};

    if (shouldProbe) {
      const fh = await open({ "flags": "r" });
      try {
        probeData = await probeDevice({ "device": fh });
      } catch (ex) {
        probeData = {};
      } finally {
        await fh.close();
      }
    }

    return Object.assign({}, {
      name,
      sizeInSectors,
      sizeInBytes,
      deviceNode,
      open
    }, probeData);
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

const findByName = async ({ deviceName, probe = false }) => {
  const dev = blockDevice({ "pathInBlock": deviceName });

  const info = await dev.findInfo({ probe });

  const sysfsFiles = await fs.promises.readdir(path.resolve("/sys/block", deviceName));
  const partitionNames = sysfsFiles.filter((filename) => filename.startsWith(deviceName));

  const partitions = await Promise.all(partitionNames.map(async (partitionName) => {
    const part = blockDevice({
      "pathInBlock": `${deviceName}/${partitionName}`
    });

    const [
      partBlockInfo,
      partInfo
    ] = await Promise.all([
      part.findInfo(),
      part.findPartitionInfo()
    ]);

    const probedPartition = (info.partitions || []).find((probedPart) => {
      return probedPart.startInSectors === partInfo.startInSectors &&
        probedPart.endInSectors === (partInfo.startInSectors + partBlockInfo.sizeInSectors - 1);
    });

    let probedInfo = {};

    if (probedPartition) {
      probedInfo = {
        "PARTUUID": probedPartition.PARTUUID
      };
    }

    return Object.assign({}, partBlockInfo, partInfo, probedInfo);
  }));

  return Object.assign({}, info, {
    partitions
  });
};

const findByDevicePath = async ({ devicePath, probe = false }) => {
  const fullPath = path.resolve(devicePath);

  const expectedDevDir = path.dirname(fullPath);
  if (expectedDevDir !== "/dev") {
    throw new Error("currently only paths directly under /dev supported");
  }

  const deviceName = path.basename(fullPath);
  return await findByName({ deviceName, probe });
};

const findAll = async ({ probe = false } = {}) => {
  const deviceNames = await fs.promises.readdir("/sys/block");

  return await Promise.all(deviceNames.map((deviceName) => {
    return findByName({ deviceName, probe });
  }));
};

export default {
  findByName,
  findByDevicePath,
  findAll
};
