import mqtt from 'mqtt';
import { EventEmitter } from 'events';

const BROKER_URL = 'wss://a33qzbzj8kkef5-ats.iot.eu-north-1.amazonaws.com/mqtt'; // AWS IoT WebSocket URL (preferred for RN)
const TOPIC_DATA = 'field/telemetry/gateway';

class MqttService extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private deviceId: string | null = null;

  connect(deviceId: string) {
    this.deviceId = deviceId;
    if (this.client?.connected) return;

    // Note: Mutual TLS in pure JS/React Native often uses WebSockets with AWS SigV4
    // or requires the certs to be provided in the options.
    this.client = mqtt.connect(BROKER_URL, {
      clientId: `RythuMithra_${deviceId}_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      console.log('MQTT Connected');
      this.client?.subscribe(`soilsmart/ack/${deviceId}`);
    });

    this.client.on('message', (topic, payload) => {
      if (topic === `soilsmart/ack/${deviceId}`) {
        const ack = JSON.parse(payload.toString());
        this.emit('ack', ack);
      }
    });
  }

  async publishWithAck(messageId: string, payload: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.client?.connected) return resolve(false);

      const timeout = setTimeout(() => {
        this.removeListener('ack', ackHandler);
        resolve(false);
      }, 10000);

      const ackHandler = (ack: any) => {
        if (ack.messageId === messageId && ack.status === 'success') {
          clearTimeout(timeout);
          this.removeListener('ack', ackHandler);
          resolve(true);
        }
      };

      this.on('ack', ackHandler);
      this.client.publish(TOPIC_DATA, payload, { qos: 1 });
    });
  }
}

export const mqttService = new MqttService();
