/* global describe */
/* global it */

import blockdev from "../lib/index.js";
import assert from "assert";

const isRoot = process.getuid() === 0;

const assertDevice = ({ device }) => {
  assert.equal(typeof device.name, "string");
  assert(device.name.length > 0);

  assert.equal(typeof device.sizeInSectors, "number");
  assert.equal(typeof device.sizeInBytes, "number");

  assert.equal(typeof device.deviceNode, "object");
  assert.equal(typeof device.deviceNode.major, "number");
  assert.equal(typeof device.deviceNode.minor, "number");

  assert(Array.isArray(device.partitions));
};

describe("linux-blockdev", function () {
  it("should list block devices correclty", async () => {
    const allDevices = await blockdev.findAll();
    assert(Array.isArray(allDevices));
    assert(allDevices.length > 0);

    const firstDevice = allDevices[0];
    assertDevice({ "device": firstDevice });
  });

  it("should give infos by name correctly", async () => {
    const allDevices = await blockdev.findAll();
    const anyDevice = allDevices[0];

    const device = await blockdev.findByName({ "deviceName": anyDevice.name });
    assertDevice({ device });
  });

  it("should give infos by device path correctly", async () => {
    const allDevices = await blockdev.findAll();

    const device = await blockdev.findByDevicePath({ "devicePath": `/dev/${allDevices[0].name}` });
    assertDevice({ device });
  });

  it("should give an error when non-/dev paths are queried", async () => {
    await assert.rejects(async () => {
      await blockdev.findByDevicePath({ "devicePath": "/sys/any" });
    });
  });

  (isRoot ? it : it.skip)("should allow to open block devices", async () => {
    const allDevices = await blockdev.findAll();
    const anyDevice = allDevices[0];

    const fh = await anyDevice.open({ "flags": "r" });
    await fh.close();
  });
});
