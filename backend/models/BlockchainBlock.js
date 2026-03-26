const mongoose = require("mongoose");

const blockchainBlockSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    timestamp: { type: Number, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    previous_hash: { type: String, required: true },
    hash: { type: String, required: true },
    source: { type: String, default: "embedded-fallback" },
    service_hash: { type: String, default: "" },
    service_index: { type: Number, default: null },
    service_timestamp: { type: Number, default: null },
  },
  {
    versionKey: false,
    collection: "blockchain_blocks",
  }
);

blockchainBlockSchema.index({ index: 1 }, { unique: true });
blockchainBlockSchema.index({ hash: 1 }, { unique: true });
blockchainBlockSchema.index({ service_hash: 1 }, { unique: true, sparse: true });

module.exports =
  mongoose.models.BlockchainBlock ||
  mongoose.model("BlockchainBlock", blockchainBlockSchema);
