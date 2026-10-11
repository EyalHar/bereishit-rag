'use strict';

// ivfflat built on an empty table gets meaningless centroids, and with
// lists=100 over ~100 rows a default probes=1 query scans a single list and
// can miss most relevant chunks. HNSW needs no training data and keeps
// near-exact recall at this size.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS torah_knowledge_base_768_cosine_idx;'
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX torah_knowledge_base_768_hnsw_idx
      ON torah_knowledge_base USING hnsw (embeddings_768 vector_cosine_ops);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS torah_knowledge_base_768_hnsw_idx;'
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX torah_knowledge_base_768_cosine_idx
      ON torah_knowledge_base USING ivfflat (embeddings_768 vector_cosine_ops)
      WITH (lists = 100);
    `);
  },
};
