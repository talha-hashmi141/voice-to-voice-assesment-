import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type HealthStatus } from '@voice-agent/contracts';
import { sql } from 'drizzle-orm';
import { AppConfigService, DATABASE, type Database } from '../../common';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Liveness + dependency checks' })
  async check(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = { database: 'down' };
    try {
      await this.db.execute(sql`select 1`);
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }
    const allUp = Object.values(checks).every((value) => value === 'up');
    return {
      status: allUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      provider: this.config.aiProvider,
      checks,
    };
  }
}
