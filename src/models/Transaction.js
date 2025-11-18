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
  credits: {
    type: Number,
    required: true,
    min: 0.5
  },
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
  anchoredAt: { type: Date }
  scheduledDate: Date,
  completedDate: Date,
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