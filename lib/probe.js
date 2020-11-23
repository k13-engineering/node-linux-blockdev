import MBR from "mbr";
import GPT from "gpt";

const readExactly = async ({ device, offset, length }) => {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await device.read(buffer, 0, buffer.length, offset);

  if (bytesRead !== buffer.length) {
    throw new Error("short read");
  }

  return buffer;
};

const readMBR = async ({ device }) => {
  const buffer = await readExactly({
    device,
    "offset": 0,
    "length": 512
  });

  return MBR.parse(buffer);
};

const readPrimaryGPT = async ({ device, efiPartition }) => {
  const gpt = new GPT({ "blockSize": 512 });

  const offset = efiPartition.type === 0xEE ?
    efiPartition.firstLBA * gpt.blockSize :
    gpt.blockSize;

  const buffer = await readExactly({
    device,
    offset,
    "length": 33 * gpt.blockSize
  });

  gpt.parse(buffer);
  return gpt;
};

export default async ({ device }) => {
  const mbr = await readMBR({ device });
  if (!mbr) {
    return {};
  }

  const efiPartition = mbr.getEFIPart();
  if (!efiPartition) {
    return {};
  }

  const gpt = await readPrimaryGPT({ device, efiPartition });

  const partitions = gpt.partitions.map((partition) => {
    const startInSectors = partition.firstLBA;
    const endInSectors = partition.lastLBA;

    const PARTUUID = partition.guid;

    return {
      startInSectors,
      endInSectors,
      PARTUUID
    };
  });

  const PTUUID = gpt.guid;

  return {
    PTUUID,
    partitions
  };
};
