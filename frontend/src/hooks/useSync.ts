import { useEffect, useRef } from 'react';
import { db } from '../lib/db';
import { mqttService } from '../lib/mqtt';
import { store } from '../lib/api';

export function useSync() {
  const isSyncing = useRef(false);

  useEffect(() => {
    const syncLoop = setInterval(async () => {
      if (isSyncing.current || !store.user) return;

      const deviceId = store.user.device_id || '0';
      mqttService.connect(deviceId);

      const unsynced: any[] = await db.getAllAsync(
        'SELECT * FROM sensor_readings WHERE isSynced = 0 LIMIT 10'
      );

      if (unsynced.length === 0) return;

      isSyncing.current = true;
      for (const reading of unsynced) {
        // Ported Logic: Exponential Backoff & ACK
        let success = false;
        let attempt = 0;
        const maxAttempts = 3;

        while (!success && attempt < maxAttempts) {
          const messageId = reading.messageId || `MSG_${Date.now()}_${Math.random().toString(16).slice(2,6)}`;
          const timestamp = new Date(reading.timestamp * 1000).toISOString().replace('T', ' ').split('.')[0];

          // Format: Message_ID, Device_ID, Field_ID, Parameter_ID, Value, Sample_ID, Timestamp
          const payload = `${messageId}, ${reading.deviceId}, ${reading.fieldId}, ${reading.parameterId}, ${reading.value}, ${reading.sampleId}, ${timestamp}`;

          success = await mqttService.publishWithAck(messageId, payload);

          if (!success) {
            attempt++;
            const backoff = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, backoff));
          } else {
            await db.runAsync('UPDATE sensor_readings SET isSynced = 1 WHERE id = ?', [reading.id]);
          }
        }
      }
      isSyncing.current = false;
    }, 5000);

    return () => clearInterval(syncLoop);
  }, []);
}
