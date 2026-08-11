import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMessagesTable1701234567890 implements MigrationInterface {
  name = 'CreateMessagesTable1701234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a products table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'message',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('messages');
  }
}
