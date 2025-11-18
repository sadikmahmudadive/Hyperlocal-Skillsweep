import mongoose from 'mongoose';

const topUpIntentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['bkash','nagad','bank'], required: true },
  credits: { type: Number, required: true, min: 1 },
  amountFiat: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'BDT' },
  idempotencyKey: { type: String, index: true },
  externalRef: { type: String }, // provider transaction ref (stubbed for now)
  status: { type: String, enum: ['initiated','pending','confirmed','failed','cancelled'], default: 'initiated' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  confirmedAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.TopUpIntent || mongoose.model('TopUpIntent', topUpIntentSchema);
