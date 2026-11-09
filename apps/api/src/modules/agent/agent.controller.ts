import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { AgentService } from './agent.service';
import { TurnRequestDto, TurnResponseDto } from './dto';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('turn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run one text turn through the agent (non-streaming). The voice gateway streams the same pipeline over Socket.IO.' })
  @ApiOkResponse({ type: TurnResponseDto })
  @ZodSerializerDto(TurnResponseDto)
  turn(@Body() body: TurnRequestDto): Promise<TurnResponseDto> {
    return this.agent.runTextTurn(body);
  }
}
