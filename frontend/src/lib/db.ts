import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('rythumithra.db');

export const initDatabase = async () => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS farmer_details (
      farmer_id INTEGER PRIMARY KEY,
      farmer_name TEXT,
      email_id TEXT,
      phone_number TEXT,
      location TEXT,
      district_id INTEGER,
      state_id INTEGER,
      holding_acres REAL,
      device_id TEXT
    );

    CREATE TABLE IF NOT EXISTS Farmers_Field (
      field_id INTEGER PRIMARY KEY AUTOINCREMENT,
      Field_Name TEXT,
      farmer_id INTEGER,
      soil_id INTEGER,
      area REAL,
      location TEXT,
      district_id INTEGER,
      state_id INTEGER,
      current_yielding_crop_name TEXT,
      longitude1 REAL, latitude1 REAL,
      longitude2 REAL, latitude2 REAL,
      longitude3 REAL, latitude3 REAL,
      longitude4 REAL, latitude4 REAL
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId INTEGER,
      locationId INTEGER,
      parameterId INTEGER,
      value TEXT,
      timestamp INTEGER,
      sampleId INTEGER DEFAULT 0,
      fieldId TEXT,
      isSynced INTEGER DEFAULT 0,
      messageId TEXT UNIQUE
    );
  `);
};

export const FarmerDb = {
  saveFarmer: async (farmer: any) => {
    await db.runAsync(
      `INSERT OR REPLACE INTO farmer_details
      (farmer_id, farmer_name, email_id, phone_number, location, district_id, state_id, holding_acres, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [farmer.farmer_id, farmer.farmer_name, farmer.email_id, farmer.phone_number, farmer.location, farmer.district_id, farmer.state_id, farmer.holding_acres, farmer.device_id]
    );
  },
  getFarmer: async () => {
    return await db.getFirstAsync('SELECT * FROM farmer_details LIMIT 1');
  }
};

export const FieldDb = {
  saveFields: async (fields: any[]) => {
    for (const field of fields) {
      await db.runAsync(
        `INSERT OR REPLACE INTO Farmers_Field
        (field_id, Field_Name, farmer_id, soil_id, area, location, district_id, state_id, current_yielding_crop_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [field.field_id, field.Field_Name, field.farmer_id, field.soil_id, field.area, field.location, field.district_id, field.state_id, field.current_yielding_crop_name]
      );
    }
  },
  getFields: async () => {
    return await db.getAllAsync('SELECT * FROM Farmers_Field');
  }
};
