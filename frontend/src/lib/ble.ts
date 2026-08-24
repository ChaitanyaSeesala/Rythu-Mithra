import { BleManager as BlePLX, Device, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const STATUS_CHAR_UUID = 'd74291c2-3e5f-463e-a89e-47347a4f7833';
const COMMAND_CHAR_UUID = '4d234454-cf6d-4a0f-adf2-f4911ba9ffa6';

export type BleData = {
  status: string;
  deviceId: number;
  locationId: number;
  parameterId?: number;
  value?: string;
  timestamp?: number;
};

class BleService {
  private manager: BlePLX;
  private device: Device | null = null;
  private onDataCallback: ((data: BleData) => void) | null = null;

  constructor() {
    this.manager = new BlePLX();
  }

  async startScan(onDeviceFound: () => void, onError?: (msg: string) => void) {
    try {
      const state = await this.manager.state();
      if (state !== State.PoweredOn) {
        onError?.("Please turn on Bluetooth");
        return;
      }

      this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan Error:', error);
          onError?.(error.message);
          return;
        }
        if (device?.name === 'SoilSmart_Node' || device?.name === 'ESP32_BT') {
          this.manager.stopDeviceScan();
          this.connect(device, onDeviceFound, onError);
        }
      });
    } catch (e: any) {
      onError?.(e.message || "Scanning failed");
    }
  }

  private async connect(device: Device, onConnected: () => void, onError?: (msg: string) => void) {
    try {
      this.device = await device.connect();
      await this.device.discoverAllServicesAndCharacteristics();
      onConnected();

      this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        STATUS_CHAR_UUID,
        (error, char) => {
          if (error) {
             console.error('Monitor Error:', error);
             return;
          }
          if (char?.value) {
            const rawData = Buffer.from(char.value, 'base64').toString();
            try {
              const parsed = JSON.parse(rawData);
              if (this.onDataCallback) this.onDataCallback(parsed);
            } catch (e) {
              console.error('Parse Error:', rawData);
            }
          }
        }
      );
    } catch (e: any) {
      console.error('Connection Error:', e);
      onError?.(e.message || "Connection failed");
    }
  }

  async sendCommand(command: string) {
    if (!this.device) return;
    try {
      const base64 = Buffer.from(command).toString('base64');
      await this.device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        COMMAND_CHAR_UUID,
        base64
      );
    } catch (e) {
      console.error('Send Command Error:', e);
    }
  }

  onData(cb: (data: BleData) => void) {
    this.onDataCallback = cb;
  }

  disconnect() {
    this.device?.cancelConnection().catch(() => {});
    this.device = null;
    this.manager.stopDeviceScan();
  }
}

export const ble = new BleService();
