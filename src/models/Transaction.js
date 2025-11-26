import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skill: {
    name: String,
    category: String,
    description: String
  },
  duration: {
    type: Number, // in hours
    required: true,
    min: 0.5
  },
  // Legacy: pure credit swap cost.
  // New: points used for discount.
  credits: {
    type: Number,
    default: 0,
    min: 0
  },
  // Money fields
  amount: { type: Number, default: 0 }, // Base price
  currency: { type: String, default: 'BDT' },
  discount: { type: Number, default: 0 }, // Fiat amount saved
  finalAmount: { type: Number, default: 0 }, // amount - discount
  
  escrowAmount: {
    type: Number,
    default: 0
  },
  heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  audit: [
    {
      actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      action: String,
      note: String,
      ts: { type: Date, default: Date.now }
    }
  ],
  idempotencyKey: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'held', 'in-progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  // Blockchain anchoring (optional)
  chainName: { type: String },
  onChainTxHash: { type: String },
  onChainProof: { type: String },
  anchoredAt: { type: Date },
  scheduledDate: { type: Date },
  completedDate: { type: Date },
  providerRating: Number,
  receiverRating: Number,
  providerReview: String,
  receiverReview: String
}, {
  timestamps: true
});

transactionSchema.index({ provider: 1, receiver: 1 });
transactionSchema.index({ status: 1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);