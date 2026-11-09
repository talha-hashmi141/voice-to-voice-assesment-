import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { ToolUsageRepository } from './tool-usage.repository';
import { ToolRegistry } from './tool.registry';
import { ToolListResponseDto, ToolUsageResponseDto } from './tools.dto';

@ApiTags('tools')
@Controller('tools')
export class ToolsController {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly usage: ToolUsageRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Catalogue of the tools the agent can call, with their argument schemas',
  })
  @ApiOkResponse({ type: ToolListResponseDto })
  @ZodSerializerDto(ToolListResponseDto)
  list(): ToolListResponseDto {
    const definitions = this.registry.toLlmDefinitions();
    return {
      tools: this.registry.list().map((tool) => ({
        name: tool.name,
        description: tool.description,
        mutating: tool.mutating,
        timeoutMs: tool.timeoutMs,
        parameters: definitions.find((d) => d.name === tool.name)?.parameters ?? {},
      })),
    };
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Tool call statistics and recent invocations aggregated from stored agent traces',
  })
  @ApiOkResponse({ type: ToolUsageResponseDto })
  @ZodSerializerDto(ToolUsageResponseDto)
  async usageStats(): Promise<ToolUsageResponseDto> {
    const [usage, recent] = await Promise.all([this.usage.usage(), this.usage.recent()]);
    return { usage, recent };
  }
}
