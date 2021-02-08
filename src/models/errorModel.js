import Sequelize from "sequelize";

/**
 * Class Error Model
 */
class ErrorModel {
  /**
   * Constructor
   * @return {Object}
   * Instance of this class
   */
  constructor(db) {
    this.db = db;
    this.errorModel = this.defineSchema();
  }

  /**
   * Create the Error Log schema
   *
   * @return {Object}
   * Model of Error Logs
   */
  defineSchema() {
    const model = this.db.define(
      "errorLogs",
      {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          default: Sequelize.UUIDV4,
        },
        service: {
          type: Sequelize.STRING,
          field: "service",
        },
        processDate: {
          type: Sequelize.DATE,
          field: "process_date",
        },
        message: {
          type: Sequelize.STRING,
        },
        errorCode: {
          type: Sequelize.STRING,
          field: "error_code",
        },
        errorId: {
          type: Sequelize.STRING,
          field: "error_id",
        },
        stackTrace: {
          type: Sequelize.TEXT,
          field: "stack_trace",
        },
        innerException: {
          type: Sequelize.TEXT,
          field: "inner_exception",
        },
        action: {
          type: Sequelize.ENUM(
            "Critical",
            "Major",
            "Minor",
            "Blocker",
            "Neutral"
          ),
          field: "action",
        },
        createdAt: {
          allowNull: false,
          field: "created",
          defaultValue: Sequelize.NOW,
          type: Sequelize.DATE,
        },
        modifiedAt: {
          allowNull: false,
          field: "modified",
          defaultValue: Sequelize.NOW,
          type: Sequelize.DATE,
        },
      },
      {
        tableName: "errorLogs",
      }
    );
    return model;
  }
}

export default ErrorModel;
