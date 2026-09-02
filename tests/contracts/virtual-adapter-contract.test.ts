import { describeDeviceAdapterContract } from "./device-adapter.contract";
import { VirtualDeviceAdapter } from "@/domain/device/virtual-adapter";

describeDeviceAdapterContract("VirtualDeviceAdapter", {
  createAdapter: () => new VirtualDeviceAdapter(),
});
