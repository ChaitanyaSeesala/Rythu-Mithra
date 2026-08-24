import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../lib/db';

export const exportReadingsToCSV = async () => {
  try {
    const readings: any[] = await db.getAllAsync('SELECT * FROM sensor_readings ORDER BY timestamp DESC');

    const header = "ID,Device ID,Location ID,Sample ID,Field ID,Parameter ID,Parameter Name,Value,Timestamp,Is Synced\n";

    const getParamName = (id: number) => {
      const names: Record<number, string> = {
        1: "Nitrogen", 2: "Phosphorus", 3: "Potassium",
        4: "Moisture", 5: "pH", 6: "EC", 7: "Temperature"
      };
      return names[id] || `Param ${id}`;
    };

    const rows = readings.map(r => {
      const date = new Date(r.timestamp * 1000).toISOString().replace('T', ' ').split('.')[0];
      return `${r.id},${r.deviceId},${r.locationId},${r.sampleId},${r.fieldId},${r.parameterId},${getParamName(r.parameterId)},${r.value},${date},${r.isSynced}`;
    }).join('\n');

    const csvContent = header + rows;
    const fileName = `RythuMithra_Data_${Date.now()}.csv`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent);
    await Sharing.shareAsync(filePath);
  } catch (error) {
    console.error('CSV Export Error:', error);
  }
};
