import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

// Pick-line statuses, in workflow order (LISTS!D2:D7 minus OPEN, which the
// sheet only used on the demand row before it reached the issue plan).
export const LINE_STATUSES = ['PENDING', 'READY', 'LOADING', 'VERIFIED', 'DISPATCHED'];
// Unit stages that are set by hand once every line is picked.
export const UNIT_STAGES = ['LOADING', 'VERIFIED', 'DISPATCHED'];

const unitSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  priority: { type: String, enum: ['Normal', 'Urgent'], default: 'Normal' },
  bay: { type: Number, required: true, min: 1 },
  remarks: { type: String, default: '' },
  active: { type: Boolean, default: true },
  // null while picking; then LOADING → VERIFIED → DISPATCHED
  stage: { type: String, enum: [null, ...UNIT_STAGES], default: null },
  loadingAt: Date,
  verifiedAt: Date,
  dispatchedAt: Date,
});

const itemSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: String,
  uom: { type: String, required: true },
  pack: String,
  shed: Number,
  rack: Number,
  level: { type: String, enum: ['G', 'L1', 'L2'] },
  pallet: String,
  reorderLevel: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
});

const locationSchema = new Schema({
  locationId: { type: String, required: true, unique: true },
  shed: Number,
  rack: Number,
  level: { type: String, enum: ['G', 'L1', 'L2'] },
  pallet: String,
  status: { type: String, enum: ['AVAILABLE', 'HOLD', 'QUARANTINE'], default: 'AVAILABLE' },
  preferredItem: { type: String, default: '' },
  capacity: Number,
  remarks: { type: String, default: '' },
});

const stockLotSchema = new Schema({
  stockId: { type: String, required: true, unique: true },
  itemCode: { type: String, required: true, index: true },
  locationId: String,
  lot: String,
  openingQty: { type: Number, default: 0 },
  receipts: { type: Number, default: 0 },
  issueQty: { type: Number, default: 0 },
  expiry: Date,
  remarks: { type: String, default: '' },
});

const demandSchema = new Schema({
  demandId: { type: String, required: true, unique: true },
  unitCode: { type: String, required: true, index: true },
  issueDate: { type: Date, required: true },
  itemCode: { type: String, required: true },
  requiredQty: { type: Number, required: true, min: 0 },
  status: { type: String, enum: LINE_STATUSES, default: 'PENDING' },
  remarks: { type: String, default: '' },
});

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
});

export const Unit = models.Unit || model('Unit', unitSchema);
export const Item = models.Item || model('Item', itemSchema);
export const Location = models.Location || model('Location', locationSchema);
export const StockLot = models.StockLot || model('StockLot', stockLotSchema);
export const Demand = models.Demand || model('Demand', demandSchema);
export const User = models.User || model('User', userSchema);
