import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TorahKnowledgeBaseAttributes {
  id: number;
  book: string;
  parasha: string | null;
  perek_start: number;
  pasuk_start: number;
  perek_end: number;
  pasuk_end: number;
  ref: string;
  chunk_content: string;
  embeddings_768?: number[] | null;
  created_at?: Date;
  updated_at?: Date;
}

interface TorahKnowledgeBaseCreationAttributes
  extends Optional<
    TorahKnowledgeBaseAttributes,
    'id' | 'created_at' | 'updated_at'
  > {}

class TorahKnowledgeBase
  extends Model<
    TorahKnowledgeBaseAttributes,
    TorahKnowledgeBaseCreationAttributes
  >
  implements TorahKnowledgeBaseAttributes
{
  public id!: number;
  public book!: string;
  public parasha!: string | null;
  public perek_start!: number;
  public pasuk_start!: number;
  public perek_end!: number;
  public pasuk_end!: number;
  public ref!: string;
  public chunk_content!: string;
  public embeddings_768?: number[] | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

TorahKnowledgeBase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    book: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    parasha: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    perek_start: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pasuk_start: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    perek_end: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pasuk_end: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ref: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    chunk_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    embeddings_768: {
      type: DataTypes.ARRAY(DataTypes.REAL),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'torah_knowledge_base',
    timestamps: true,
    underscored: true,
  }
);

export default TorahKnowledgeBase;
