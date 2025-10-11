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
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
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