import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['home', 'tech', 'creative', 'education', 'health', 'other']
  },
  description: {
    type: String,
    maxlength: 200
  },
  experience: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'intermediate'
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }
}, { timestamps: true });

// NOTE: No `username` field here. If a previous version had a unique index on `username`,
// drop it (see /api/test/fix-username-index). Keeping schema free of `username` avoids null dup errors.
const savedSearchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  filters: {
    query: { type: String, default: '' },
    category: { type: String, default: 'all' },
    distance: { type: Number, default: 10 },
    sort: { type: String, default: 'relevance' },
    withinRadius: { type: Boolean, default: false },
    autoFit: { type: Boolean, default: true }
  }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    public_id: String,
    url: {
      type: String,
      default: 'https://ui-avatars.com/api/?name=U&background=0ea5e9&color=fff&size=128&bold=true'
    }
  },
  bio: {
    type: String,
    maxlength: 500
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    address: String,
    city: String,
    country: String
  },
  skillsOffered: [skillSchema],
  skillsNeeded: [skillSchema],
  credits: {
    type: Number,
    default: 2,
    min: 0
  },
  heldCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  ledger: [
    {
      type: {
        type: String,
        enum: ['hold', 'release', 'refund', 'topup', 'spend'],
        required: true
      },
      amount: { type: Number, required: true },
      balanceAfter: { type: Number, required: true },
      txRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
      note: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [reviewSchema],
  isVerified: {
    type: Boolean,
    default: false
  },
  preferences: {
    maxDistance: {
      type: Number,
      default: 10
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedSearches: [savedSearchSchema]
}, {
  timestamps: true
});

userSchema.index({ location: '2dsphere' });
userSchema.index({ 'skillsOffered.name': 'text', 'skillsNeeded.name': 'text' });

export default mongoose.models.User || mongoose.model('User', userSchema);