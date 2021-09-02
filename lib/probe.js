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

const readParitionUUIDsFromGPT = ({ gpt }) => {
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

const padZeros = ({ text, length }) => {
  let result = text;

  while (result.length < length) {
    result = `0${result}`;
  }

  return result;
};

const calcPTUUIDforMBR = ({ signature, partNumber }) => {
  const signaturePadded = padZeros({ text: signature.toString(16).toLowerCase(), length: 8 });
  const partNumberPadded = padZeros({ text: partNumber.toString(10), length: 2 });

  return `${signaturePadded}-${partNumberPadded}`;
};

const readPartitionUUIDsFromMBR = ({ mbr }) => {
  let partitions = [];

  mbr.partitions.forEach((partition, idx) => {
    if (partition.type !== 0) {
      const startInSectors = partition.firstLBA;
      const endInSectors = partition.firstLBA + partition.sectors - 1;

      const PARTUUID = calcPTUUIDforMBR({
        signature: mbr.signature,
        partNumber: idx + 1
      });

      partitions = [
        ...partitions,
        {
          startInSectors,
          endInSectors,
          PARTUUID
        }
      ];
    }
  });

  return {
    partitions
  };
};

export default async ({ device }) => {
  const mbr = await readMBR({ device });
  if (!mbr) {
    return {};
  }

  const efiPartition = mbr.getEFIPart();
  if (efiPartition) {
    const gpt = await readPrimaryGPT({ device, efiPartition });
    return readParitionUUIDsFromGPT({ gpt });
  } else {
    return readPartitionUUIDsFromMBR({ mbr });
  }
};
