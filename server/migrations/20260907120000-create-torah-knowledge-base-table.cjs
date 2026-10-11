'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE torah_knowledge_base (
        id SERIAL PRIMARY KEY,
        book VARCHAR(255) NOT NULL,
        parasha VARCHAR(255),
        perek_start INTEGER NOT NULL,
        pasuk_start INTEGER NOT NULL,
        perek_end INTEGER NOT NULL,
        pasuk_end INTEGER NOT NULL,
        ref VARCHAR(255) NOT NULL UNIQUE,
        chunk_content TEXT NOT NULL,
        embeddings_768 vector(768),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX torah_knowledge_base_768_cosine_idx
      ON torah_knowledge_base USING ivfflat (embeddings_768 vector_cosine_ops)
      WITH (lists = 100);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('torah_knowledge_base');
  },
};
